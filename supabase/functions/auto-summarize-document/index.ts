import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: inline HTML stripper
function stripHtmlTags(htmlContent: string | null | undefined): string {
  if (!htmlContent) return "";
  return htmlContent.replace(/<[^>]*>/g, " ").trim();
}

const SUMMARY_MODEL = Deno.env.get("STRATEGIST_SUMMARY_MODEL") ?? "gpt-4o-mini";
const TRUNCATION_CHAR_LIMIT = 3000; // Max characters to send to AI

interface DocumentRecord {
  id: string;
  project_id: string;
  content: string | null;
  projects: {
    id: string;
    user_id: string;
  } | null;
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

    const { document_id, project_id } = await req.json();

    if (typeof document_id !== "string" || typeof project_id !== "string") {
      return respond({ error: "document_id and project_id are required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // Fetch document content and associated project user_id
    const { data: documentData, error: documentError } = await supabaseClient
      .from("documents")
      .select("id, project_id, content, projects(id, user_id)")
      .eq("id", document_id)
      .eq("project_id", project_id) // Ensure document belongs to the project
      .maybeSingle<DocumentRecord>();

    if (documentError || !documentData) {
      return respond({ error: "Document not found or accessible within this project." }, 404);
    }

    // Additional validation: ensure document's project_id matches the provided project_id
    if (documentData.project_id !== project_id) {
      return respond({ error: "Document does not belong to the provided project." }, 403);
    }

    const project = documentData.projects;
    if (!project) {
      return respond({ error: "Associated project information is missing." }, 404);
    }

    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, project.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    const sanitizedContent = stripHtmlTags(documentData.content);
    const trimmedContent = sanitizedContent.trim();

    let summary = "Summary not available. Add content to this document to generate insights.";
    let keyDecisions: string[] = ["No key decisions captured yet."];

    if (trimmedContent.length > 0) {
      const contentToSend = trimmedContent.length > TRUNCATION_CHAR_LIMIT
        ? `${trimmedContent.slice(0, TRUNCATION_CHAR_LIMIT - 3)}...`
        : trimmedContent;

      try {
        const generated = await generateSummaryAndDecisions(
          openAIKeyResult.key,
          contentToSend,
        );
        summary = generated.summary;
        keyDecisions = generated.keyDecisions;
      } catch (error) {
        console.error("OpenAI summary generation failed", error);
        return respond({ error: "Failed to generate summary from OpenAI." }, 502);
      }
    }

    const timestamp = new Date().toISOString();

    const { error: updateError } = await supabaseClient
      .from("documents")
      .update({
        summary,
        key_decisions: keyDecisions,
        last_summarized_at: timestamp,
      })
      .eq("id", documentData.id);

    if (updateError) {
      console.error("Failed to update document summary", updateError);
      return respond({ error: "Failed to store summary on document." }, 500);
    }

    // Trigger chunk-document after successful summary update
    try {
      const { error: chunkError } = await supabaseClient.functions.invoke('chunk-document', {
        body: {
          document_id: documentData.id,
          project_id: documentData.project_id,
        },
        headers: {
          Authorization: authHeader, // Pass the original Authorization header
        },
      });

      if (chunkError) {
        console.error('Failed to trigger chunk-document:', chunkError);
        // Log the error but don't fail the summary function, as summary is already done.
      }
    } catch (invokeError) {
      console.error('Unexpected error invoking chunk-document:', invokeError);
    }

    // Trigger generate-embeddings after chunking finishes
    try {
      const { error: embeddingError } = await supabaseClient.functions.invoke('generate-embeddings', {
        body: {
          document_id: documentData.id,
        },
        headers: {
          Authorization: authHeader,
        },
      });

      if (embeddingError) {
        console.error('Failed to trigger generate-embeddings:', embeddingError);
      }
    } catch (invokeError) {
      console.error('Unexpected error invoking generate-embeddings:', invokeError);
    }

    return respond({
      success: true,
      summary,
      key_decisions: keyDecisions,
      last_summarized_at: timestamp,
    });
  } catch (error) {
    console.error("auto-summarize-document error", error);
    return respond({ error: "Unexpected error while generating summary." }, 500);
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
  userId: string,
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
    return {
      ok: false,
      error: "AI features are disabled for this account.",
      status: 403,
    };
  }

  const envKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const userKey = data?.openai_api_key?.trim();
  const key = userKey || envKey;

  if (!key) {
    return {
      ok: false,
      error: "OpenAI API key not configured. Add a key in AI Settings.",
    };
  }

  return { ok: true, key };
}

async function generateSummaryAndDecisions(
  apiKey: string,
  content: string,
): Promise<{ summary: string; keyDecisions: string[] }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 200, // Keep max_tokens small as requested
      messages: [
        {
          role: "system",
          content: [
            "You summarize brand strategy documents for StrategistAI.",
            "Rules:",
            "- Provide a summary with exactly 2-3 sentences and no more than ~80 tokens total.",
            "- Provide between 3 and 5 bullet points in `key_decisions`.",
            "- Each bullet must be under 15 words.",
            "- Bullets should be concise action-oriented decisions taken from the document.",
            "- Respond with strict JSON: {\"summary\": string, \"key_decisions\": string[]}.",
            "- If information is missing, politely indicate so while staying within the format.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Document Content:\n${content}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("OpenAI summarization error", errorBody);
    throw new Error("Failed to generate summary.");
  }

  const completion = await response.json();
  const rawContent = completion?.choices?.[0]?.message?.content ?? "{}";

  let parsed: { summary?: unknown; key_decisions?: unknown };
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    console.error("Failed to parse summary JSON", error, rawContent);
    throw new Error("Summary response was malformed.");
  }

  const summary = sanitizeSummary(parsed.summary);
  const keyDecisions = sanitizeKeyDecisions(parsed.key_decisions);

  return { summary, keyDecisions };
}

function sanitizeSummary(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return trimmed.length > 400 ? `${trimmed.slice(0, 397)}...` : trimmed;
  }
  return "Summary unavailable.";
}

function sanitizeKeyDecisions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["Key decisions unavailable."];
  }

  const cleaned = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0 && item.length <= 120)
    .slice(0, 5); // Limit to 5 key decisions

  if (cleaned.length < 3) {
    return cleaned.length
      ? cleaned.concat(Array(3 - cleaned.length).fill("Decision detail pending."))
      : [
        "Decision detail pending.",
        "Decision detail pending.",
        "Decision detail pending.",
      ];
  }

  return cleaned;
}