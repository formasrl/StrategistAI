import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBEDDING_MODEL = Deno.env.get("STRATEGIST_EMBEDDING_MODEL") ?? "text-embedding-3-small";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return respond({ error: "Method not allowed." }, 405);
    }

    const {
      query_text,
      project_id,
      top_k = 3,
    }: { query_text?: string; project_id?: string; top_k?: number } = await req.json();

    if (!query_text || typeof query_text !== "string") {
      return respond({ error: "query_text is required." }, 400);
    }

    if (!project_id || typeof project_id !== "string") {
      return respond({ error: "project_id is required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, project_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    const queryEmbedding = await createEmbedding(openAIKeyResult.key, query_text);

    const { data, error } = await supabaseClient.rpc("search_document_embeddings", {
      input_project_id: project_id,
      query_embedding: queryEmbedding,
      top_k: top_k,
    });

    if (error) {
      console.error("search_document_embeddings RPC failed", error);
      return respond({ error: "Failed to search embeddings." }, 500);
    }

    const results = (data || []).map((item: Record<string, unknown>) => ({
      document_id: item.document_id,
      document_name: item.document_name,
      summary: item.summary,
      title: item.title,
      tags: item.tags,
      chunk_preview: item.chunk_preview, // NEW
      relevance_score: item.relevance_score, // NEW
    }));

    console.log(`[search-embeddings] Returned ${results.length} matches for project ${project_id}`);

    return respond({ success: true, results });
  } catch (error) {
    console.error("search-embeddings error", error);
    return respond({ error: "Unexpected error while searching embeddings." }, 500);
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
  projectId: string
): Promise<{ ok: true; key: string } | { ok: false; error: string; status?: number }> {
  const { data, error } = await client
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle<{ user_id: string }>();

  if (error || !data) {
    console.error("Failed to load project owner", error);
    return { ok: false, error: "Project not found or accessible.", status: 404 };
  }

  const { data: settings, error: settingsError } = await client
    .from("user_settings")
    .select("openai_api_key, ai_enabled")
    .eq("user_id", data.user_id)
    .maybeSingle();

  if (settingsError) {
    console.error("Failed to load user settings", settingsError);
  }

  if (settings && settings.ai_enabled === false) {
    return { ok: false, error: "AI features are disabled for this account.", status: 403 };
  }

  const envKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  const userKey = settings?.openai_api_key?.trim();
  const key = userKey || envKey;

  if (!key) {
    return { ok: false, error: "OpenAI API key not configured. Add a key in AI Settings." };
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