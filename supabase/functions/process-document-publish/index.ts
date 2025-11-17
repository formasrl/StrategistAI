import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUMMARIZATION_MODEL = Deno.env.get("STRATEGIST_SUMMARY_MODEL") ?? "gpt-4o-mini";
const EMBEDDING_MODEL = Deno.env.get("STRATEGIST_EMBEDDING_MODEL") ?? "text-embedding-3-small";

interface ProjectInfo {
  id: string;
  user_id: string;
  name: string | null;
  one_liner: string | null;
  audience: string | null;
  positioning: string | null;
  constraints: string | null;
}

interface MemoryEntry {
  title: string;
  summary: string;
  key_decisions: string[] | null;
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

    const { documentId, action } = await req.json();
    if (!documentId || (action !== "publish" && action !== "disconnect")) {
      return respond({ error: "documentId and valid action are required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: documentData, error: documentError } = await supabaseClient
      .from("documents")
      .select(
        `
        id,
        project_id,
        step_id,
        document_name,
        content,
        status,
        summary,
        key_decisions,
        tags,
        steps!inner(
          id,
          phase_id,
          step_name
        ),
        projects!inner(
          id,
          user_id,
          name,
          one_liner,
          audience,
          positioning,
          constraints
        )
      `
      )
      .eq("id", documentId)
      .maybeSingle();

    if (documentError || !documentData) {
      return respond({ error: "Document not found." }, 404);
    }

    const projectInfo = extractSingle<ProjectInfo>(documentData.projects);
    if (!projectInfo) {
      return respond({ error: "Project information is missing." }, 404);
    }

    const stepRelation = extractSingle<{ phase_id: string | null; step_name: string | null }>(documentData.steps);

    if (action === "publish") {
      if (documentData.status !== "published") {
        return respond({ error: "Document must be published before syncing memory." }, 409);
      }

      const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, projectInfo.user_id);
      if (!openAIKeyResult.ok) {
        return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
      }

      const trimmedContent = (documentData.content ?? "").trim();
      const fallbackTags = buildFallbackTags(stepRelation?.step_name);
      const timestamp = new Date().toISOString();

      let summaryData: { summary: string; keyDecisions: string[]; tags: string[] };
      if (!trimmedContent) {
        summaryData = {
          summary: "The document was published without substantive content. Add details to capture key decisions.",
          keyDecisions: ["No key decisions captured yet."],
          tags: fallbackTags,
        };
        await supabaseClient.from("project_document_embeddings").delete().eq("document_id", documentId);
      } else {
        summaryData = await generateSummary(openAIKeyResult.key, documentData.document_name, trimmedContent, fallbackTags);
        const embeddingVector = await createEmbedding(openAIKeyResult.key, summaryData.summary, summaryData.keyDecisions);

        const { error: upsertError } = await supabaseClient
          .from("project_document_embeddings")
          .upsert(
            {
              project_id: documentData.project_id,
              document_id: documentData.id,
              phase_id: stepRelation?.phase_id ?? null,
              step_id: documentData.step_id,
              title: documentData.document_name,
              summary: summaryData.summary,
              key_decisions: summaryData.keyDecisions,
              tags: summaryData.tags,
              embedding: embeddingVector,
              updated_at: timestamp,
            },
            { onConflict: "document_id" }
          );

        if (upsertError) {
          console.error("Failed to upsert memory entry", upsertError);
          return respond({ error: "Failed to update project memory entry." }, 500);
        }
      }

      const { error: updateDocError } = await supabaseClient
        .from("documents")
        .update({
          summary: summaryData.summary,
          key_decisions: summaryData.keyDecisions,
          tags: summaryData.tags,
          last_published_at: timestamp,
        })
        .eq("id", documentId);

      if (updateDocError) {
        console.error("Failed to update document metadata", updateDocError);
        return respond({ error: "Failed to store summary data on document." }, 500);
      }

      await updateProjectProfile(supabaseClient, projectInfo, documentData.project_id);

      return respond({
        success: true,
        summary: summaryData.summary,
        key_decisions: summaryData.keyDecisions,
        tags: summaryData.tags,
      });
    }

    // Disconnect branch
    await supabaseClient.from("project_document_embeddings").delete().eq("document_id", documentId);

    const { error: clearDocError } = await supabaseClient
      .from("documents")
      .update({
        summary: null,
        key_decisions: null,
        tags: null,
        last_published_at: null,
      })
      .eq("id", documentId);

    if (clearDocError) {
      console.error("Failed to clear document metadata", clearDocError);
      return respond({ error: "Failed to clear document memory metadata." }, 500);
    }

    await updateProjectProfile(supabaseClient, projectInfo, documentData.project_id);

    return respond({ success: true, message: "Document removed from project memory." });
  } catch (error) {
    console.error("process-document-publish error", error);
    return respond({ error: "Unexpected error while syncing project memory." }, 500);
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
    console.error("Failed to fetch user settings", error);
  }

  if (data && data.ai_enabled === false) {
    return { ok: false, error: "AI features are disabled. Enable AI assistance to sync memory.", status: 403 };
  }

  const envKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const userKey = data?.openai_api_key?.trim();

  const key = userKey || envKey;
  if (!key) {
    return { ok: false, error: "OpenAI API key not configured. Add a key in AI Settings." };
  }

  return { ok: true, key };
}

async function generateSummary(
  apiKey: string,
  title: string,
  content: string,
  fallbackTags: string[]
): Promise<{ summary: string; keyDecisions: string[]; tags: string[] }> {
  const prompt = [
    "You summarize brand strategy documents for StrategistAI.",
    "Rules:",
    "- Summary: max 3 sentences, <= 80 tokens.",
    "- Key decisions: 3-7 bullets, each <= 15 words.",
    "- Tags: 2-5 lowercase tags, max 2 words each.",
    "- Only reflect information present in the document.",
    "- Respond in strict JSON with keys summary, key_decisions, tags.",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SUMMARIZATION_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Document Title: ${title}\n\nDocument Content:\n${content}`,
        },
      ],
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("OpenAI summarization error", errorBody);
    throw new Error("Failed to generate summary.");
  }

  const completion = await response.json();
  const rawContent = completion?.choices?.[0]?.message?.content ?? "{}";
  let parsed: { summary?: unknown; key_decisions?: unknown; tags?: unknown };
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    console.error("Failed to parse summary JSON", error, rawContent);
    throw new Error("Summary response was malformed.");
  }

  const summary = sanitizeSummary(parsed.summary, title);
  const keyDecisions = sanitizeStringList(parsed.key_decisions, 7, 120, ["Clarify next draft steps."]);
  const tags = sanitizeTags(parsed.tags, fallbackTags);

  return { summary, keyDecisions, tags };
}

async function createEmbedding(apiKey: string, summary: string, keyDecisions: string[]): Promise<number[]> {
  const embeddingText = [
    summary,
    "Key Decisions:",
    ...keyDecisions.map((decision) => `- ${decision}`),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: embeddingText,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("OpenAI embedding error", errorBody);
    throw new Error("Failed to generate embedding.");
  }

  const embeddingPayload = await response.json();
  const vector = embeddingPayload?.data?.[0]?.embedding;

  if (!Array.isArray(vector)) {
    throw new Error("Embedding response missing vector data.");
  }

  return vector.map((value: number) => Number(value));
}

async function updateProjectProfile(
  client: ReturnType<typeof createClient>,
  project: ProjectInfo,
  projectId: string
) {
  const { data: memories, error } = await client
    .from("project_document_embeddings")
    .select("title, summary, key_decisions")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(3);

  if (error) {
    console.error("Failed to fetch memories for profile", error);
    return;
  }

  const profileText = buildProjectProfileText(project, memories ?? []);
  const { error: upsertError } = await client
    .from("project_profiles")
    .upsert({
      project_id: projectId,
      compressed_text: profileText,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    console.error("Failed to upsert project profile", upsertError);
  }
}

function buildProjectProfileText(project: ProjectInfo, memories: MemoryEntry[]): string {
  const lines: string[] = [
    "PROJECT SUMMARY:",
    `- Brand: ${sanitizeLine(project.name, "Untitled Project")}`,
    `- One-line: ${sanitizeLine(project.one_liner, "To be defined.")}`,
    `- Audience: ${sanitizeLine(project.audience, "Not specified.")}`,
    `- Positioning: ${sanitizeLine(project.positioning, "Not specified.")}`,
    `- Constraints: ${sanitizeLine(project.constraints, "None recorded.")}`,
  ];

  if (memories.length > 0) {
    lines.push("RECENT DECISIONS:");
    memories.forEach((memory) => {
      const keySnippet = (memory.key_decisions ?? [])
        .slice(0, 2)
        .map((decision) => decision.replace(/\.$/, ""))
        .join("; ");

      const summary = memory.summary.length > 220 ? `${memory.summary.slice(0, 217)}...` : memory.summary;
      const decisionLine = keySnippet ? `${summary} | Key: ${keySnippet}` : summary;

      lines.push(`- ${memory.title}: ${decisionLine}`);
    });
  } else {
    lines.push("RECENT DECISIONS:");
    lines.push("- No published steps yet.");
  }

  return lines.join("\n");
}

function sanitizeSummary(value: unknown, title: string): string {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return trimmed.length > 400 ? `${trimmed.slice(0, 397)}...` : trimmed;
  }
  return `Summary pending for "${title}".`;
}

function sanitizeStringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
  fallback: string[]
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const cleaned: string[] = value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
        return item.text.trim();
      }
      return "";
    })
    .filter((item) => item.length > 0)
    .slice(0, maxItems)
    .map((item) => (item.length > maxLength ? `${item.slice(0, maxLength - 3)}...` : item));

  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeTags(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const tags = value
    .map((tag) => {
      if (typeof tag === "string") {
        return tag.trim().toLowerCase();
      }
      return "";
    })
    .filter((tag) => tag.length > 0 && tag.length <= 24 && /^[a-z0-9\- ]+$/.test(tag))
    .map((tag) => tag.replace(/\s+/g, "-"))
    .slice(0, 5);

  return tags.length > 0 ? tags : fallback;
}

function buildFallbackTags(stepName?: string | null): string[] {
  if (!stepName) {
    return ["brand", "strategy"];
  }
  return stepName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 1)
    .slice(0, 3);
}

function sanitizeLine(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function extractSingle<T>(relation: unknown): T | null {
  if (!relation) return null;
  if (Array.isArray(relation)) {
    return (relation[0] as T) ?? null;
  }
  return relation as T;
}