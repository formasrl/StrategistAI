import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHAT_MODEL = Deno.env.get("STRATEGIST_CHAT_MODEL") ?? "gpt-4o-mini";
const EMBEDDING_MODEL = Deno.env.get("STRATEGIST_EMBEDDING_MODEL") ?? "text-embedding-3-small";

interface ProjectRecord {
  id: string;
  user_id: string;
  name: string | null;
  one_liner: string | null;
  audience: string | null;
  positioning: string | null;
  constraints: string | null;
}

interface StepRecord {
  id: string;
  step_name: string | null;
  description: string | null;
  why_matters: string | null;
  timeline: string | null;
  phases?: {
    phase_name: string | null;
    phase_number: number | null;
  } | null;
}

interface MemoryMatch {
  document_id: string;
  step_id: string | null;
  title: string;
  summary: string;
  key_decisions: string[] | null;
  tags: string[] | null;
  distance: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const {
      message,
      projectId,
      stepId,
      documentId,
      recentMessages,
    }: {
      message?: string;
      projectId?: string;
      stepId?: string;
      documentId?: string;
      recentMessages?: { sender: string; text: string }[];
    } = body ?? {};

    if (!message || !projectId || !stepId) {
      return respond({ error: "message, projectId, and stepId are required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: projectData, error: projectError } = await supabaseClient
      .from("projects")
      .select("id, user_id, name, one_liner, audience, positioning, constraints")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !projectData) {
      return respond({ error: "Project not found." }, 404);
    }

    const project = projectData as ProjectRecord;

    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, project.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    const profileText = await fetchProjectProfileText(supabaseClient, project);

    const { data: stepData, error: stepError } = await supabaseClient
      .from("steps")
      .select("id, step_name, description, why_matters, timeline, phases(phase_name, phase_number)")
      .eq("id", stepId)
      .maybeSingle();

    if (stepError || !stepData) {
      return respond({ error: "Step details not found." }, 404);
    }

    const step = stepData as StepRecord;

    let documentContent = "";
    let documentSummary: string | undefined;
    if (documentId) {
      const { data: documentData } = await supabaseClient
        .from("documents")
        .select("content, summary")
        .eq("id", documentId)
        .maybeSingle();

      if (documentData) {
        documentContent = (documentData.content ?? "").toString();
        documentSummary = typeof documentData.summary === "string" ? documentData.summary : undefined;
      }
    }

    const embeddingVector = await createQueryEmbedding(openAIKeyResult.key, buildEmbeddingPrompt(message, step));
    const memoryMatches = await retrieveMemories(supabaseClient, projectId, embeddingVector);

    const draftedContext = buildDraftSegment(documentContent, documentSummary);
    const memoriesText = formatMemories(memoryMatches);
    const conversationSnippet = formatRecentConversation(recentMessages ?? []);
    const stepDefinition = formatStepDefinition(step);

    const userPromptSections = [
      `PROJECT PROFILE:\n${profileText}`,
      `CURRENT STEP:\n${stepDefinition}`,
      `RELEVANT PAST DECISIONS:\n${memoriesText}`,
    ];

    if (conversationSnippet) {
      userPromptSections.push(`RECENT CONVERSATION:\n${conversationSnippet}`);
    }

    if (draftedContext) {
      userPromptSections.push(draftedContext);
    }

    userPromptSections.push(`USER QUESTION:\n${message}`);

    const systemPrompt = [
      "You are StrategistAI, a senior brand strategist and coach.",
      "The user writes their own brand materials. Do NOT create full documents.",
      "Focus on guidance, critique, and strategic alignment.",
      "Always respect previously published decisions and call out conflicts politely.",
      "If information is missing, ask clarifying questions instead of guessing.",
    ].join(" ");

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKeyResult.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.5,
        max_tokens: 500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPromptSections.join("\n\n") },
        ],
      }),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error("Chat completion error", errorText);
      return respond({ error: "AI coach request failed." }, chatResponse.status);
    }

    const completion = await chatResponse.json();
    const reply = completion?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return respond({ error: "AI response was empty." }, 500);
    }

    return respond({
      response: reply,
      memories: memoryMatches.map((memory) => ({
        documentId: memory.document_id,
        title: memory.title,
        summary: memory.summary,
        keyDecisions: memory.key_decisions ?? [],
        tags: memory.tags ?? [],
      })),
    });
  } catch (error) {
    console.error("chat-ai-assistant error", error);
    return respond({ error: "Unexpected error while generating AI response." }, 500);
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

async function fetchProjectProfileText(
  client: ReturnType<typeof createClient>,
  project: ProjectRecord
): Promise<string> {
  const { data: profile } = await client
    .from("project_profiles")
    .select("compressed_text")
    .eq("project_id", project.id)
    .maybeSingle();

  if (profile?.compressed_text) {
    return profile.compressed_text;
  }

  return [
    "PROJECT SUMMARY:",
    `- Brand: ${sanitizeLine(project.name, "Untitled Project")}`,
    `- One-line: ${sanitizeLine(project.one_liner, "To be defined.")}`,
    `- Audience: ${sanitizeLine(project.audience, "Not specified.")}`,
    `- Positioning: ${sanitizeLine(project.positioning, "Not specified.")}`,
    `- Constraints: ${sanitizeLine(project.constraints, "None recorded.")}`,
    "RECENT DECISIONS:",
    "- No published steps yet.",
  ].join("\n");
}

async function createQueryEmbedding(apiKey: string, text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Embedding error", errorText);
    throw new Error("Failed to generate embedding.");
  }

  const payload = await response.json();
  const vector = payload?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error("Embedding vector missing in response.");
  }

  return vector.map((value: number) => Number(value));
}

async function retrieveMemories(
  client: ReturnType<typeof createClient>,
  projectId: string,
  embedding: number[]
): Promise<MemoryMatch[]> {
  const { data, error } = await client.rpc("match_project_memories", {
    input_project_id: projectId,
    query_embedding: embedding,
    match_count: 4,
    similarity_threshold: 1.6,
  });

  if (error) {
    console.error("Memory retrieval error", error);
    return [];
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data as MemoryMatch[];
}

function buildEmbeddingPrompt(message: string, step: StepRecord): string {
  return [
    message,
    step.step_name ?? "",
    step.description ?? "",
    step.why_matters ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatMemories(memories: MemoryMatch[]): string {
  if (!memories.length) {
    return "No relevant published decisions found.";
  }

  return memories
    .map((memory, index) => {
      const keyDecisions = (memory.key_decisions ?? []).slice(0, 2);
      const decisionsText = keyDecisions.length
        ? keyDecisions.map((decision) => `  • ${decision}`).join("\n")
        : "  • Key decisions not recorded.";
      const summary = memory.summary.length > 220 ? `${memory.summary.slice(0, 217)}...` : memory.summary;
      const score = convertDistanceToScore(memory.distance);
      return [
        `${index + 1}. ${memory.title} (relevance ${score})`,
        `  Summary: ${summary}`,
        decisionsText,
      ].join("\n");
    })
    .join("\n");
}

function formatStepDefinition(step: StepRecord): string {
  const lines = [
    `Name: ${sanitizeLine(step.step_name, "Untitled Step")}`,
    step.phases?.phase_name ? `Phase: ${step.phases.phase_name}` : undefined,
    step.description ? `Goal: ${step.description}` : undefined,
    step.why_matters ? `Why it matters: ${step.why_matters}` : undefined,
    step.timeline ? `Timeline: ${step.timeline}` : undefined,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildDraftSegment(content: string, summary?: string): string | null {
  const trimmed = content.trim();

  if (summary) {
    return `CURRENT DRAFT SUMMARY:\n${summary}`;
  }

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 800) {
    return `CURRENT DRAFT EXCERPT:\n${trimmed}`;
  }

  return `CURRENT DRAFT EXCERPT:\n${trimmed.slice(0, 800)}...`;
}

function formatRecentConversation(messages: { sender: string; text: string }[]): string | null {
  if (!messages.length) return null;

  const recent = messages.slice(-4);
  return recent
    .map((entry) => {
      const speaker = entry.sender === "ai" ? "Assistant" : "User";
      return `${speaker}: ${entry.text}`;
    })
    .join("\n");
}

function convertDistanceToScore(distance: number): string {
  if (Number.isNaN(distance) || distance <= 0) return "high";
  if (distance < 0.6) return "high";
  if (distance < 1.0) return "medium";
  if (distance < 1.4) return "low";
  return "very low";
}

function sanitizeLine(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}