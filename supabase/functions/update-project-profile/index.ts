import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFILE_MODEL = Deno.env.get("STRATEGIST_PROFILE_MODEL") ?? "gpt-4o-mini";

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

    const { data: projectData, error: projectError } = await supabaseClient
      .from("projects")
      .select("id, user_id, name, one_liner, audience, positioning, constraints, project_profile")
      .eq("id", projectId)
      .maybeSingle<ProjectRecord>();

    if (projectError || !projectData) {
      return respond({ error: "Project not found or accessible." }, 404);
    }

    const project = projectData;

    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, project.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    const { data: documentSummaries, error: summaryError } = await supabaseClient
      .from("documents")
      .select("document_name, summary")
      .eq("project_id", projectId)
      .not("summary", "is", null);

    if (summaryError) {
      console.error("Failed to load document summaries:", summaryError);
    }

    const summaryPayload = buildSummaryPayload(documentSummaries || []);

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKeyResult.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PROFILE_MODEL,
        temperature: 0.25,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content: [
              "You are StrategistAI, an expert brand strategist.",
              "You are asked to write a 4-6 line project profile that compiles the key essence of the project.",
              "Each line should flow naturally, describe the brand’s positioning and priorities, and stay grounded in the supplied summaries.",
              "Do not add headings, just return the 4-6 lines.",
            ].join("\n"),
          },
          {
            role: "user",
            content: summaryPayload.prompt,
          },
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

    if (!generatedProfile) {
      return respond({ error: "AI did not return a profile summary." }, 500);
    }

    const timestamp = new Date().toISOString();

    const { error: updateError } = await supabaseClient
      .from("projects")
      .update({
        project_profile: generatedProfile,
        project_profile_summary: generatedProfile,
        updated_at: timestamp,
      })
      .eq("id", projectId);

    if (updateError) {
      console.error("Failed to update project profile:", updateError);
      return respond({ error: "Failed to save generated project profile." }, 500);
    }

    console.log(`[update-project-profile] Updated ${projectId} at ${timestamp}`);

    return respond({ success: true, project_profile_summary: generatedProfile, updated_at: timestamp });

  } catch (error) {
    console.error("update-project-profile error", error);
    return respond({ error: "Unexpected error while updating project profile." }, 500);
  }
});

function buildSummaryPayload(documents: { document_name: string | null; summary: string | null }[]) {
  const relevantSummaries = documents
    .filter((doc) => doc.summary?.trim())
    .map((doc, index) => `Document ${index + 1} (${doc.document_name || "Untitled"}): ${doc.summary?.trim()}`);
  if (!relevantSummaries.length) {
    relevantSummaries.push("No document summaries yet; describe the project from the stored fields.");
  }
  return {
    prompt: [
      "Project Details:",
      "- Name: " + (documents.length ? documents[0].document_name || "Unnamed" : "Unnamed"),
      "- Provided summaries:",
      relevantSummaries.join("\n"),
      "Use the available information to write a 4-6 line profile for this brand project.",
    ].join("\n\n"),
  };
}

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