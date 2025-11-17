import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getEncoding } from "https://esm.sh/js-tiktoken@1.0.11";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: inline HTML stripper (replaces external import)
function stripHtmlTags(htmlContent: string | null | undefined): string {
  if (!htmlContent) return "";
  return htmlContent.replace(/<[^>]*>/g, " ").trim();
}

const REVIEW_MODEL = Deno.env.get("STRATEGIST_REVIEW_MODEL") ?? "gpt-4o-mini";
const EMBEDDING_MODEL = Deno.env.get("STRATEGIST_EMBEDDING_MODEL") ?? "text-embedding-3-small";

// Initialize encoding for common models
const encoding = getEncoding("cl100k_base");

function countTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return encoding.encode(text).length;
}

// Limits
const TRUNCATION_CHAR_LIMIT = 3000;
const GPT_3_5_MAX_TOKENS = 6000;
const GPT_4_MAX_TOKENS = 30000;

function getModelTokenLimit(modelName: string): number {
  if (modelName.includes("gpt-4")) {
    return GPT_4_MAX_TOKENS;
  }
  return GPT_3_5_MAX_TOKENS;
}

function truncateToChars(text: string, maxChars: number): string {
  if (!text || maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
}

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

interface StepRecord {
  id: string;
  step_name: string | null;
  description: string | null;
  why_matters: string | null;
  timeline: string | null;
  phases?: {
    phase_name: string | null;
    phase_number: number | null;
    project_id: string;
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
      documentId,
      projectId,
      stepId,
      draftText,
    }: {
      documentId?: string;
      projectId?: string;
      stepId?: string;
      draftText?: string;
    } = body ?? {};

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    let effectiveProjectId = projectId;
    let effectiveStepId = stepId;
    let currentDraftContent = draftText ?? "";
    let documentSummaryForQuery: string | undefined;

    if (documentId) {
      const { data: documentData, error: documentError } = await supabaseClient
        .from("documents")
        .select("project_id, step_id, content, summary")
        .eq("id", documentId)
        .maybeSingle();

      if (documentError || !documentData) {
        return respond({ error: "Document not found or accessible." }, 404);
      }

      effectiveProjectId = documentData.project_id;
      effectiveStepId = documentData.step_id ?? effectiveStepId;
      currentDraftContent = stripHtmlTags(draftText ?? documentData.content ?? "");
      documentSummaryForQuery = typeof documentData.summary === "string" ? documentData.summary : undefined;

      if (documentData.project_id !== effectiveProjectId || documentData.step_id !== effectiveStepId) {
        return respond({ error: "Document does not belong to the provided project or step." }, 403);
      }
    }

    if (!effectiveProjectId || !effectiveStepId) {
      return respond({ error: "projectId and stepId are required for reviews." }, 400);
    }

    const trimmedDraft = currentDraftContent.trim();
    if (!trimmedDraft) {
      return respond({ error: "Draft content is required for review." }, 400);
    }

    // Fetch project profile
    const { data: projectData, error: projectError } = await supabaseClient
      .from("projects")
      .select("id, user_id, name, one_liner, audience, positioning, constraints, project_profile")
      .eq("id", effectiveProjectId)
      .maybeSingle();

    if (projectError || !projectData) {
      return respond({ error: "Project not found or accessible." }, 404);
    }

    const project = projectData as ProjectRecord;

    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, project.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    let currentProjectProfile = fetchProjectProfileText(project);

    // Fetch step details
    const { data: stepData, error: stepError } = await supabaseClient
      .from("steps")
      .select("id, step_name, description, why_matters, timeline, phases(phase_name, phase_number, project_id)")
      .eq("id", effectiveStepId)
      .maybeSingle();

    if (stepError || !stepData) {
      return respond({ error: "Step details not found or accessible." }, 404);
    }
    if (stepData.phases?.project_id !== effectiveProjectId) {
      return respond({ error: "Step does not belong to the provided project." }, 403);
    }
    const step = stepData as StepRecord;
    let currentStepDefinition = formatStepDefinition(step);

    // Decide query text for relevant decisions
    const queryTextForDecisions = documentSummaryForQuery && documentSummaryForQuery.trim() !== ""
      ? documentSummaryForQuery
      : trimmedDraft;

    const { data: relevantDecisionsData, error: relevantDecisionsError } = await supabaseClient.functions.invoke('retrieve-relevant-decisions', {
      body: { projectId: effectiveProjectId, queryText: queryTextForDecisions },
      headers: {
        Authorization: authHeader,
      },
    });

    let memoryMatches: MemoryMatch[] = [];
    if (relevantDecisionsError) {
      console.error("Error invoking retrieve-relevant-decisions:", relevantDecisionsError);
    } else if (relevantDecisionsData?.results) {
      memoryMatches = relevantDecisionsData.results as MemoryMatch[];
    }
    let currentMemoriesText = formatMemories(memoryMatches);

    const reviewSystemPrompt = [
      "You are StrategistAI, a senior brand strategist reviewer.",
      "The user writes their own documents; you review and coach.",
      "Stay consistent with provided project profile and previous decisions.",
      "Never invent facts outside the context.",
      "Deliver precise, actionable, and concise feedback.",
    ].join(" ");

    const modelTokenLimit = getModelTokenLimit(REVIEW_MODEL);
    const reviewSystemPromptTokens = countTokens(reviewSystemPrompt);

    // Calculate initial tokens
    let totalPromptTokens =
      reviewSystemPromptTokens +
      countTokens(currentProjectProfile) +
      countTokens(currentStepDefinition) +
      countTokens(currentMemoriesText) +
      countTokens(trimmedDraft);

    console.log(`[generate-ai-review] Initial prompt token count: ${totalPromptTokens} for model: ${REVIEW_MODEL}`);

    if (totalPromptTokens > modelTokenLimit) {
      console.log(`[generate-ai-review] Prompt exceeds ${modelTokenLimit} tokens. Attempting truncation.`);
      if (trimmedDraft && trimmedDraft.length > TRUNCATION_CHAR_LIMIT) {
        currentDraftContent = truncateToChars(trimmedDraft, TRUNCATION_CHAR_LIMIT);
        totalPromptTokens =
          reviewSystemPromptTokens +
          countTokens(currentProjectProfile) +
          countTokens(currentStepDefinition) +
          countTokens(currentMemoriesText) +
          countTokens(currentDraftContent);
        console.log(`[generate-ai-review] Draft content truncated to ${TRUNCATION_CHAR_LIMIT} chars. New token count: ${totalPromptTokens}`);
      }

      if (totalPromptTokens > modelTokenLimit) {
        return respond(
          {
            error: `Your review request is too long (${totalPromptTokens} tokens). Even after truncating document content, it exceeds the model's ${modelTokenLimit} token limit. Please shorten your document content.`,
          },
          400,
        );
      }
    }

    const reviewPrompt = buildReviewPrompt({
      projectProfile: currentProjectProfile,
      step,
      draft: currentDraftContent,
      memories: memoryMatches,
    });

    console.log(
      `[generate-ai-review] Final prompt token count after all truncations: ${countTokens(reviewSystemPrompt + reviewPrompt)}`
    );

    const reviewResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKeyResult.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REVIEW_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: "system", content: reviewSystemPrompt },
          { role: "user", content: reviewPrompt },
        ],
      }),
    });

    if (!reviewResponse.ok) {
      const errorText = await reviewResponse.text();
      console.error("AI review error", errorText);
      return respond({ error: "Failed to generate AI review." }, reviewResponse.status);
    }

    const reviewPayload = await reviewResponse.json();
    const rawContent = reviewPayload?.choices?.[0]?.message?.content ?? "{}";

    let parsedReview: {
      summary?: unknown;
      strengths?: unknown;
      issues?: unknown;
      consistency_issues?: unknown;
      suggestions?: unknown;
      readiness?: unknown;
      readiness_reason?: unknown;
    };
    try {
      parsedReview = JSON.parse(rawContent);
    } catch (error) {
      console.error("Review parsing error:", error);
      console.error("Raw AI response:", rawContent);
      console.error("Raw AI response chunk size:", rawContent.length);
      return respond({ error: "AI review output was malformed. Please try again." }, 500);
    }

    const normalized = normalizeReview(parsedReview);

    await supabaseClient.from("ai_reviews").delete().eq("document_id", documentId ?? "");

    const insertPayload = {
      document_id: documentId ?? null,
      strengths: normalized.strengths,
      suggestions: normalized.suggestions,
      issues: normalized.issues,
      consistency_issues: normalized.consistencyIssues,
      summary: normalized.summary,
      readiness: normalized.readiness,
      readiness_reason: normalized.readinessReason,
      review_timestamp: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseClient.from("ai_reviews").insert(insertPayload);
    if (insertError) {
      console.error("Failed to store review", insertError);
      return respond({ error: "Failed to store AI review." }, 500);
    }

    return respond({
      review: {
        summary: normalized.summary,
        strengths: normalized.strengths,
        issues: normalized.issues,
        consistency_issues: normalized.consistencyIssues,
        suggestions: normalized.suggestions,
        readiness: normalized.readiness,
        readiness_reason: normalized.readinessReason,
      },
    });
  } catch (error) {
    console.error("generate-ai-review error", error);
    return respond({ error: "Unexpected error while generating review." }, 500);
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

function fetchProjectProfileText(project: ProjectRecord): string {
  if (project.project_profile && project.project_profile.trim()) {
    return project.project_profile;
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

function buildEmbeddingPrompt(draft: string, step: StepRecord): string {
  return [
    step.step_name ?? "",
    step.description ?? "",
    step.why_matters ?? "",
    draft.slice(0, 2000),
  ]
    .filter(Boolean)
    .join("\n");
}

const reviewSystemPrompt = [
  "You are StrategistAI, a senior brand strategist reviewer.",
  "The user writes their own documents; you review and coach.",
  "Stay consistent with provided project profile and previous decisions.",
  "Never invent facts outside the context.",
  "Deliver precise, actionable, and concise feedback.",
].join(" ");

function buildReviewPrompt({
  projectProfile,
  step,
  draft,
  memories,
}: {
  projectProfile: string;
  step: StepRecord;
  draft: string;
  memories: MemoryMatch[];
}): string {
  const parts = [
    `PROJECT PROFILE:\n${projectProfile}`,
    `CURRENT STEP:\n${formatStepDefinition(step)}`,
    `PREVIOUS BRAND DECISIONS TO CONSIDER:\n${formatMemories(memories)}`,
    `CURRENT DRAFT:\n${draft}`,
    "TASK:\nReview the draft against the project profile, the current step's goal, and the previous brand decisions.",
    "Specifically flag any inconsistencies or conflicts between the current draft and the 'PREVIOUS BRAND DECISIONS TO CONSIDER' section.",
    "Return strict JSON with keys:",
    `{
  "summary": string (<=40 words),
  "strengths": string[] (each <=15 words),
  "issues": string[] (each <=20 words, gaps or weaknesses),
  "consistency_issues": string[] (conflicts with prior decisions, empty if none),
  "suggestions": string[] (practical improvements, <=18 words),
  "readiness": "ready" | "not_ready",
  "readiness_reason": string (<=25 words, why you chose the readiness state)
}`,
    "Do not add extra keys. Do not repeat the instructions.",
  ];

  return parts.join("\n\n");
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

function convertDistanceToScore(distance: number): string {
  if (Number.isNaN(distance) || distance <= 0) return "high";
  if (distance < 0.6) return "high";
  if (distance < 1.0) return "medium";
  if (distance < 1.4) return "low";
  return "very low";
}

function limitDraftLength(draft: string): string {
  return draft;
}

function sanitizeLine(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeReview(raw: {
  summary?: unknown;
  strengths?: unknown;
  issues?: unknown;
  consistency_issues?: unknown;
  suggestions?: unknown;
  readiness?: unknown;
  readiness_reason?: unknown;
}) {
  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim().slice(0, 400)
      : "No summary generated.";

  const strengths = sanitizeStringArray(raw.strengths, 7, 120);
  const issues = sanitizeStringArray(raw.issues, 7, 140);
  const consistencyIssues = sanitizeStringArray(raw.consistency_issues, 6, 140);
  const suggestions = sanitizeStringArray(raw.suggestions, 7, 140);

  let readiness = typeof raw.readiness === "string" ? raw.readiness.toLowerCase().trim() : "not_ready";
  readiness = readiness === "ready" ? "ready" : "not_ready";

  const readinessReason =
    typeof raw.readiness_reason === "string" && raw.readiness_reason.trim()
      ? raw.readiness_reason.trim().slice(0, 220)
      : "Reason not provided.";

  return { summary, strengths, issues, consistencyIssues, suggestions, readiness, readinessReason };
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const cleaned: string[] = value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const title = typeof record.title === "string" ? record.title.trim() : "";
        const detail = typeof record.detail === "string" ? record.detail.trim() : "";
        const description = typeof record.description === "string" ? record.description.trim() : "";
        const combined = [title, detail || description].filter(Boolean).join(": ");
        if (combined) {
          return combined;
        }
      }
      return "";
    })
    .filter((item) => item.length > 0)
    .slice(0, maxItems)
    .map((item) => (item.length > maxLength ? `${item.slice(0, maxLength - 3)}...` : item));

  return cleaned;
}