import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFILE_GENERATION_MODEL = Deno.env.get("STRATEGIST_PROFILE_MODEL") ?? "gpt-4o-mini";

interface ProjectRecord {
  id: string;
  user_id: string;
  name: string | null;
  one_liner: string | null;
  audience: string | null;
  positioning: string | null;
  constraints: string | null;
  project_profile: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed." }, 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ error: "Unauthorized." }, 401);
    }

    const { projectId } = await req.json();
    if (!projectId) {
      return respond({ error: "project_id is required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // 1. Fetch Project Details - Filter by projectId
    const { data: projectData, error: projectError } = await supabaseClient
      .from("projects")
      .select("id, user_id, name, one_liner, audience, positioning, constraints, project_profile")
      .eq("id", projectId) // Ensure project is the one requested
      .maybeSingle<ProjectRecord>();

    if (projectError || !projectData) {
      return respond({ error: "Project not found or accessible." }, 404);
    }

    const project = projectData;

    // 2. Resolve OpenAI API Key
    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, project.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    // 3. Fetch Published Documents and Extract Key Decisions from foundational steps
    // Filter by project_id to ensure data isolation
    const { data: documents, error: documentsError } = await supabaseClient
      .from("documents")
      .select("document_name, summary, key_decisions, tags")
      .eq("project_id", projectId) // Ensure documents belong to the project
      .eq("status", "published");

    if (documentsError) {
      console.error("Failed to fetch published documents:", documentsError);
      // Continue even if no documents, profile can still be generated from project info
    }

    const foundationalKeyDecisions: string[] = [];
    // Define a broader set of tags that indicate foundational strategic documents
    const relevantTags = ['audience', 'positioning', 'constraints', 'vision', 'mission', 'values', 'strategy', 'brief'];

    documents?.forEach(doc => {
      if (doc.tags && doc.key_decisions) {
        const hasRelevantTag = doc.tags.some(tag => relevantTags.includes(tag));
        if (hasRelevantTag) {
          foundationalKeyDecisions.push(...doc.key_decisions);
        }
      }
    });

    // 4. Generate a compact project profile summary using OpenAI
    const profilePrompt = buildProfileGenerationPrompt(project, foundationalKeyDecisions);

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKeyResult.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PROFILE_GENERATION_MODEL,
        temperature: 0.2,
        max_tokens: 200, // Enough for 4-6 lines
        messages: [
          { role: "system", content: profileSystemPrompt },
          { role: "user", content: profilePrompt },
        ],
      }),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error("OpenAI profile generation error", errorText);
      return respond({ error: "AI profile generation failed." }, chatResponse.status);
    }

    const completion = await chatResponse.json();
    const generatedProfile = completion?.choices?.[0]?.message?.content?.trim();

    // Log AI usage
    await logAiUsage(
      supabaseClient,
      project.id,
      project.user_id,
      "update-project-profile",
      PROFILE_GENERATION_MODEL,
      profilePrompt.length,
      generatedProfile?.length ?? 0
    );

    if (!generatedProfile) {
      return respond({ error: "AI did not return a profile summary." }, 500);
    }

    // 5. Save to the Project's project_profile field - Filter by projectId
    const { error: updateError } = await supabaseClient
      .from("projects")
      .update({
        project_profile: generatedProfile,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId); // Ensure project is the one requested

    if (updateError) {
      console.error("Failed to update project profile:", updateError);
      return respond({ error: "Failed to save generated project profile." }, 500);
    }

    return respond({ success: true, project_profile: generatedProfile });

  } catch (error) {
    console.error("update-project-profile error", error);
    return respond({ error: "Unexpected error while updating project profile." }, 500);
  }
});

function respond(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveOpenAIApiKey(
  client: ReturnType<typeof createClient>,
  userId: string
): Promise<{ ok: true; key: string } | { ok: false; error: string; status?: number }> {
  const { data, error } = await client
    .from("user_settings")
    .select("openai_api_key, ai_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load user settings", error);
  }

  if (data && data.ai_enabled === false) {
    return { ok: false, error: "AI features are disabled for this account.", status: 403 };
  }

  const envKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const userKey = data?.openai_api_key?.trim();

  const key = userKey || envKey;
  if (!key) {
    return { ok: false, error: "OpenAI API key not configured. Add a key in AI Settings." };
  }

  return { ok: true, key };
}

function sanitizeLine(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

const profileSystemPrompt = [
  "You are StrategistAI, an expert brand strategist.",
  "Your task is to create a concise, 4-6 line project profile summary.",
  "Focus on the brand's core identity, target audience, unique positioning, and key strategic decisions.",
  "Do not include a title or introductory phrase. Start directly with the summary.",
  "Ensure the summary is coherent and flows naturally.",
].join(" ");

function buildProfileGenerationPrompt(project: ProjectRecord, foundationalKeyDecisions: string[]): string {
  const parts = [
    `Project Name: ${sanitizeLine(project.name, "Not specified")}`,
    `One-liner: ${sanitizeLine(project.one_liner, "Not specified")}`,
    `Target Audience: ${sanitizeLine(project.audience, "Not specified")}`,
    `Positioning: ${sanitizeLine(project.positioning, "Not specified")}`,
    `Constraints: ${sanitizeLine(project.constraints, "None recorded")}`,
  ];

  if (foundationalKeyDecisions.length > 0) {
    parts.push(`Key Foundational Decisions:\n- ${foundationalKeyDecisions.join("\n- ")}`);
  } else {
    parts.push("Key Foundational Decisions: None recorded yet.");
  }

  return parts.join("\n");
}

async function logAiUsage(
  supabaseClient: ReturnType<typeof createClient>,
  projectId: string,
  userId: string,
  functionName: string,
  model: string,
  inputLength: number,
  outputLength: number,
) {
  const { error } = await supabaseClient.from("ai_usage_log").insert({
    project_id: projectId,
    user_id: userId,
    function_name: functionName,
    model: model,
    input_length: inputLength,
    output_length: outputLength,
  });
  if (error) {
    console.error("Failed to log AI usage:", error);
  }
}