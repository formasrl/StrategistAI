import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function respond(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function resolveOpenAIApiKey(
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

export async function logAiUsage(
  supabaseClient: ReturnType<typeof createClient>,
  projectId: string,
  userId: string,
  functionName: string,
  model: string,
  inputLength: number,
  outputLength: number
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

export function stripHtmlTags(htmlContent: string | null | undefined): string {
  if (!htmlContent) return "";
  return htmlContent.replace(/<[^>]*>/g, " ").trim();
}

export async function createEmbedding(apiKey: string, text: string, model: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
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

// Approximate token counting: 1 token ≈ 4 characters
export function countTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Limits
const GPT_3_5_MAX_TOKENS = 6000;
const GPT_4_MAX_TOKENS = 30000;

export function getModelTokenLimit(modelName: string): number {
  if (modelName.includes("gpt-4")) {
    return GPT_4_MAX_TOKENS;
  }
  return GPT_3_5_MAX_TOKENS;
}

export function truncateToChars(text: string, maxChars: number): string {
  if (!text || maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
}

export function sanitizeLine(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}