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
  projects: {
    id: string;
    user_id: string;
  } | null;
}

interface ChunkRecord {
  id: string;
  chunk_text: string | null;
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

    const { document_id } = await req.json();

    if (typeof document_id !== "string") {
      return respond({ error: "document_id is required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: documentData, error: documentError } = await supabaseClient
      .from("documents")
      .select("id, project_id, projects(id, user_id)")
      .eq("id", document_id)
      .maybeSingle<DocumentRecord>();

    if (documentError || !documentData) {
      return respond({ error: "Document not found or accessible." }, 404);
    }

    if (!documentData.projects) {
      return respond({ error: "Project owner information missing." }, 404);
    }

    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, documentData.projects.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    const { data: chunks, error: chunkError } = await supabaseClient
      .from("document_embeddings")
      .select("id, chunk_text")
      .eq("document_id", document_id)
      .is("embedding", null)
      .order("chunk_index", { ascending: true });

    if (chunkError) {
      console.error("Failed to load document chunks:", chunkError);
      return respond({ error: "Failed to load document chunks." }, 500);
    }

    if (!chunks || !chunks.length) {
      console.log(`[generate-embeddings] No chunks pending for document ${document_id}.`);
      return respond({ success: true, processedChunks: 0 });
    }

    let processed = 0;

    for (const chunk of chunks as ChunkRecord[]) {
      if (!chunk.chunk_text) {
        continue;
      }

      const embeddingVector = await createEmbedding(openAIKeyResult.key, chunk.chunk_text);

      const { error: updateError } = await supabaseClient
        .from("document_embeddings")
        .update({ embedding: embeddingVector })
        .eq("id", chunk.id);

      if (updateError) {
        console.error(`Failed to store embedding for chunk ${chunk.id}:`, updateError);
        return respond({ error: "Failed to store embedding." }, 500);
      }

      processed += 1;
    }

    console.log(`[generate-embeddings] Processed ${processed} chunks for document ${document_id}.`);

    return respond({ success: true, processedChunks: processed });
  } catch (error) {
    console.error("generate-embeddings error", error);
    return respond({ error: "Unexpected error while generating embeddings." }, 500);
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