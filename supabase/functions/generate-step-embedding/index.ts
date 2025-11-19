import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBEDDING_MODEL = Deno.env.get("STRATEGIST_EMBEDDING_MODEL") ?? "text-embedding-3-small";

interface DocumentRecord {
  id: string;
  project_id: string;
  step_id: string;
  summary: string | null;
  key_decisions: string[] | null;
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

    const { step_document_id, project_id } = await req.json();

    if (typeof step_document_id !== "string" || typeof project_id !== "string") {
      return respond({ error: "step_document_id and project_id are required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // Fetch document summary, key decisions, and associated project user_id
    // Filter by project_id to ensure data isolation
    const { data: documentData, error: documentError } = await supabaseClient
      .from("documents")
      .select("id, project_id, step_id, summary, key_decisions, projects(id, user_id)")
      .eq("id", step_document_id)
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

    const combinedText = [
      documentData.summary,
      ...(documentData.key_decisions || []),
    ].filter(Boolean).join("\n");

    if (!combinedText.trim()) {
      return respond({ error: "Document has no summary or key decisions to embed." }, 400);
    }

    const embeddingVector = await createEmbedding(openAIKeyResult.key, combinedText);

    // Log AI usage
    await logAiUsage(
      supabaseClient,
      project.id,
      project.user_id,
      "generate-step-embedding",
      EMBEDDING_MODEL,
      combinedText.length,
      embeddingVector.length // Log dimension for embedding output length
    );

    const { data: upsertData, error: upsertError } = await supabaseClient
      .from("step_embeddings")
      .upsert(
        {
          project_id: documentData.project_id,
          step_document_id: documentData.id,
          embedding: embeddingVector,
        },
        { onConflict: "step_document_id" } // Assuming step_document_id is unique for embeddings
      )
      .select("id")
      .single();

    if (upsertError) {
      console.error("Failed to upsert step embedding", upsertError);
      return respond({ error: "Failed to store step embedding." }, 500);
    }

    return respond({ success: true, embedding_id: upsertData.id });
  } catch (error) {
    console.error("generate-step-embedding error", error);
    return respond({ error: "Unexpected error while generating step embedding." }, 500);
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

async function createEmbedding(apiKey: string, text: string): Promise<number[]> {
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
    console.error("OpenAI embedding error", errorText);
    throw new Error("Failed to generate embedding.");
  }

  const embeddingPayload = await response.json();
  const vector = embeddingPayload?.data?.[0]?.embedding;

  if (!Array.isArray(vector)) {
    throw new Error("Embedding response missing vector data.");
  }

  return vector.map((value: number) => Number(value));
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