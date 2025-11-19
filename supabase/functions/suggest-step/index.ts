import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBEDDING_MODEL = Deno.env.get("STRATEGIST_EMBEDDING_MODEL") ?? "text-embedding-3-small";

interface StepRecord {
  id: string;
  step_name: string;
  description: string | null;
}

interface Suggestion {
  step_id: string;
  step_name: string;
  description: string | null;
  score: number;
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

    const { projectId, documentContent } = await req.json();

    if (typeof projectId !== "string" || typeof documentContent !== "string") {
      return respond({ error: "projectId and documentContent are required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Fetch project to get user_id for API key resolution
    const { data: projectData, error: projectError } = await supabaseClient
      .from("projects")
      .select("user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !projectData) {
      return respond({ error: "Project not found or accessible." }, 404);
    }

    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, projectData.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }

    // 1. Generate embedding for the uploaded document content
    const documentEmbedding = await createEmbedding(openAIKeyResult.key, documentContent);

    // 2. Fetch all steps for the project
    const { data: steps, error: stepsError } = await supabaseClient
      .from("steps")
      .select("id, step_name, description")
      .eq("project_id", projectId); // Assuming steps table has project_id

    if (stepsError) {
      console.error("Failed to fetch steps:", stepsError);
      return respond({ error: "Failed to retrieve steps for suggestion." }, 500);
    }

    const suggestions: Suggestion[] = [];

    // 3. For each step, generate embedding and calculate similarity
    for (const step of steps) {
      const stepText = `${step.step_name}. ${step.description || ""}`.trim();
      if (!stepText) continue;

      const stepEmbedding = await createEmbedding(openAIKeyResult.key, stepText);
      const score = cosineSimilarity(documentEmbedding, stepEmbedding);

      suggestions.push({
        step_id: step.id,
        step_name: step.step_name,
        description: step.description,
        score,
      });
    }

    // 4. Sort by score and return top N
    suggestions.sort((a, b) => b.score - a.score);
    const topSuggestions = suggestions.slice(0, 5); // Top 5 suggestions

    // Log AI usage
    await logAiUsage(
      supabaseClient,
      projectId,
      projectData.user_id,
      "suggest-step",
      EMBEDDING_MODEL,
      documentContent.length + steps.reduce((acc, s) => acc + (s.step_name?.length || 0) + (s.description?.length || 0), 0),
      topSuggestions.length * 4 // Approximate output length
    );

    return respond({ success: true, suggestions: topSuggestions });
  } catch (error) {
    console.error("suggest-step error", error);
    return respond({ error: "Unexpected error while suggesting steps." }, 500);
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

async function createEmbedding(apiKey: string, text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must be of the same dimension");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0; // Avoid division by zero
  }

  return dotProduct / (magnitudeA * magnitudeB);
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