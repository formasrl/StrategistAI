import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBEDDING_MODEL = Deno.env.get("STRATEGIST_EMBEDDING_MODEL") ?? "text-embedding-3-small";

interface ProjectRecord {
  id: string;
  user_id: string;
}

interface MemoryMatch {
  step_document_id: string;
  step_id: string;
  document_name: string;
  summary: string;
  key_decisions: string[] | null;
  step_name: string;
  distance: number;
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

    const { projectId, queryText } = await req.json();

    if (typeof projectId !== "string" || typeof queryText !== "string") {
      return respond({ error: "projectId and queryText are required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // Fetch project to get user_id for API key resolution - Filter by projectId
    const { data: projectData, error: projectError } = await supabaseClient
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId) // Ensure project is the one requested
      .maybeSingle<ProjectRecord>();

    if (projectError || !projectData) {
      return respond({ error: "Project not found or accessible." }, 404);
    }

    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, projectData.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    const queryEmbedding = await createEmbedding(openAIKeyResult.key, queryText);

    // Log AI usage
    await logAiUsage(
      supabaseClient,
      projectData.id,
      projectData.user_id,
      "retrieve-relevant-decisions",
      EMBEDDING_MODEL,
      queryText.length,
      queryEmbedding.length // Log dimension for embedding output length
    );

    // RPC call already filters by input_project_id
    const { data: matches, error: rpcError } = await supabaseClient.rpc("match_step_memories", {
      input_project_id: projectId,
      query_embedding: queryEmbedding,
      match_count: 3,
      similarity_threshold: 1.5, // Adjust as needed
    });

    if (rpcError) {
      console.error("RPC match_step_memories error", rpcError);
      return respond({ error: "Failed to retrieve relevant decisions." }, 500);
    }

    const formattedResults = (matches as MemoryMatch[]).map((match) => ({
      step_name: match.step_name,
      document_name: match.document_name,
      summary: match.summary,
      key_decisions: match.key_decisions || [],
      distance: match.distance,
    }));

    return respond({ success: true, results: formattedResults });
  } catch (error) {
    console.error("retrieve-relevant-decisions error", error);
    return respond({ error: "Unexpected error while retrieving decisions." }, 500);
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