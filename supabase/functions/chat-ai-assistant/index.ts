import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: inline HTML stripper (replaces external import)
function stripHtmlTags(htmlContent: string | null | undefined): string {
  if (!htmlContent) return "";
  return htmlContent.replace(/<[^>]*>/g, " ").trim();
}

const CHAT_MODEL = Deno.env.get("STRATEGIST_CHAT_MODEL") ?? "gpt-4o-mini";
const EMBEDDING_MODEL = Deno.env.get("STRATEGIST_EMBEDDING_MODEL") ?? "text-embedding-3-small";

// Approximate token counting: 1 token ≈ 4 characters
function countTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
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
  step_name: string;
  document_name: string;
  summary: string;
  key_decisions: string[] | null;
  distance: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
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
      chatSessionId: incomingChatSessionId,
    }: {
      message?: string;
      projectId?: string;
      stepId?: string;
      documentId?: string;
      chatSessionId?: string;
    } = body ?? {};

    if (!message || !projectId || !stepId) {
      return respond({ error: "message, projectId, and stepId are required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    let currentChatSessionId = incomingChatSessionId;

    // 1. Get or Create Chat Session
    if (!currentChatSessionId) {
      const { data: newSession, error: sessionError } = await supabaseClient
        .from('chat_sessions')
        .insert({ project_id: projectId, step_id: stepId, document_id: documentId || null })
        .select('id')
        .single();

      if (sessionError) {
        console.error("Failed to create chat session:", sessionError);
        return respond({ error: "Failed to start chat session." }, 500);
      }
      currentChatSessionId = newSession.id;
    }

    // 2. Store User Message
    await supabaseClient.from('chat_messages').insert({
      chat_session_id: currentChatSessionId,
      role: 'user',
      content: message,
    });

    // Layer 1: Fetch Project Profile
    const { data: projectData, error: projectError } = await supabaseClient
      .from("projects")
      .select("id, user_id, name, one_liner, audience, positioning, constraints, project_profile")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !projectData) {
      return respond({ error: "Project not found or accessible." }, 404);
    }

    const project = projectData as ProjectRecord;
    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, project.user_id);
    if (!openAIKeyResult.ok) {
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }
    let currentProjectProfileText = fetchProjectProfileText(project);

    // Layer 2: Current Step Info
    const { data: stepData, error: stepError } = await supabaseClient
      .from("steps")
      .select("id, step_name, description, why_matters, timeline, phases(phase_name, phase_number, project_id)")
      .eq("id", stepId)
      .maybeSingle();

    if (stepError || !stepData) {
      return respond({ error: "Step details not found or accessible." }, 404);
    }
    if (stepData.phases?.project_id !== projectId) {
      return respond({ error: "Step does not belong to the provided project." }, 403);
    }
    const step = stepData as StepRecord;
    let currentStepDefinition = formatStepDefinition(step);

    let currentDocumentContent = "";
    let currentDocumentSummary: string | undefined;
    if (documentId) {
      const { data: documentData, error: docError } = await supabaseClient
        .from("documents")
        .select("content, summary, project_id, step_id")
        .eq("id", documentId)
        .maybeSingle();

      if (docError || !documentData) {
        return respond({ error: "Document not found or accessible." }, 404);
      }
      if (documentData.project_id !== projectId || documentData.step_id !== stepId) {
        return respond({ error: "Document does not belong to the provided project or step." }, 403);
      }
      currentDocumentContent = stripHtmlTags(documentData.content ?? "");
      currentDocumentSummary = typeof documentData.summary === "string" ? documentData.summary : undefined;
    }
    let currentDraftedContext = buildDraftSegment(currentDocumentContent, currentDocumentSummary);

    // Layer 3: Retrieved Decisions Summary + Key Points
    const { data: relevantDecisionsData, error: relevantDecisionsError } = await supabaseClient.functions.invoke('retrieve-relevant-decisions', {
      body: { projectId, queryText: message },
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

    // Fetch recent messages from the database for context
    const { data: recentMessagesData, error: recentMessagesError } = await supabaseClient
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('chat_session_id', currentChatSessionId)
      .order('created_at', { ascending: true })
      .limit(6); // Fetch last 6 messages (3 user, 3 assistant)

    if (recentMessagesError) {
      console.error("Failed to fetch recent chat messages:", recentMessagesError);
      // Continue without recent conversation if there's an error
    }
    let currentConversationSnippet = formatRecentConversation(recentMessagesData || []);

    const systemPrompt = [
      "You are StrategistAI, a senior brand strategist and coach.",
      "The user writes their own brand materials. Do NOT create full documents.",
      "Focus on guidance, critique, and strategic alignment.",
      "Always respect previously published decisions and call out conflicts politely.",
      "If information is missing, ask clarifying questions instead of guessing.",
    ].join(" ");

    const modelTokenLimit = getModelTokenLimit(CHAT_MODEL);
    const systemPromptTokens = countTokens(systemPrompt);
    const userMessageTokens = countTokens(message);

    // Calculate initial tokens with full content
    let totalPromptTokens =
      systemPromptTokens +
      countTokens(currentProjectProfileText) +
      countTokens(currentStepDefinition) +
      countTokens(currentMemoriesText) +
      countTokens(currentConversationSnippet) +
      countTokens(currentDraftedContext ?? "") +
      userMessageTokens;

    console.log(`[chat-ai-assistant] Initial prompt token count: ${totalPromptTokens} for model: ${CHAT_MODEL}`);

    // Truncation logic
    if (totalPromptTokens > modelTokenLimit) {
      console.log(`[chat-ai-assistant] Prompt exceeds ${modelTokenLimit} tokens. Attempting truncation.`);

      // 1. Truncate document content to TRUNCATION_CHAR_LIMIT (3000 chars)
      if (currentDocumentContent && currentDocumentContent.length > TRUNCATION_CHAR_LIMIT) {
        currentDocumentContent = truncateToChars(currentDocumentContent, TRUNCATION_CHAR_LIMIT);
        currentDraftedContext = buildDraftSegment(currentDocumentContent, currentDocumentSummary);
        totalPromptTokens =
          systemPromptTokens +
          countTokens(currentProjectProfileText) +
          countTokens(currentStepDefinition) +
          countTokens(currentMemoriesText) +
          countTokens(currentConversationSnippet) +
          countTokens(currentDraftedContext ?? "") +
          userMessageTokens;
        console.log(`[chat-ai-assistant] Document content truncated to ${TRUNCATION_CHAR_LIMIT} chars. New token count: ${totalPromptTokens}`);
      }

      // 2. If still over, truncate conversationSnippet
      if (totalPromptTokens > modelTokenLimit && currentConversationSnippet) {
        const tokensToReduce = totalPromptTokens - modelTokenLimit;
        const charsToKeep = Math.max(0, countTokens(currentConversationSnippet) - tokensToReduce) * 4;
        currentConversationSnippet = truncateToChars(currentConversationSnippet, charsToKeep);
        totalPromptTokens =
          systemPromptTokens +
          countTokens(currentProjectProfileText) +
          countTokens(currentStepDefinition) +
          countTokens(currentMemoriesText) +
          countTokens(currentConversationSnippet) +
          countTokens(currentDraftedContext ?? "") +
          userMessageTokens;
        console.log(`[chat-ai-assistant] Conversation snippet truncated. New token count: ${totalPromptTokens}`);
      }

      // 3. If still over, throw error
      if (totalPromptTokens > modelTokenLimit) {
        return respond(
          {
            error: `Your request is too long (${totalPromptTokens} tokens). Even after truncating document content and conversation history, it exceeds the model's ${modelTokenLimit} token limit. Please shorten your query or document content.`,
          },
          400,
        );
      }
    }

    const userPromptSections = [];
    userPromptSections.push(`PROJECT PROFILE:\n${currentProjectProfileText}`);
    userPromptSections.push(`CURRENT STEP:\n${currentStepDefinition}`);
    userPromptSections.push(`RELEVANT PAST DECISIONS:\n${currentMemoriesText}`);
    if (currentConversationSnippet) {
      userPromptSections.push(`RECENT CONVERSATION:\n${currentConversationSnippet}`);
    }
    if (currentDraftedContext) {
      userPromptSections.push(currentDraftedContext);
    }
    userPromptSections.push(`USER QUESTION:\n${message}`);

    const finalPrompt = userPromptSections.join("\n\n");
    console.log(`[chat-ai-assistant] Final prompt token count after all truncations: ${countTokens(finalPrompt)}`);

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
          { role: "user", content: finalPrompt },
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

    // Store AI Response
    await supabaseClient.from('chat_messages').insert({
      chat_session_id: currentChatSessionId,
      role: 'assistant',
      content: reply,
    });

    return respond({
      response: reply,
      chatSessionId: currentChatSessionId, // Return the session ID
      memories: memoryMatches.map((memory) => ({
        documentName: memory.document_name,
        stepName: memory.step_name,
        summary: memory.summary,
        keyDecisions: memory.key_decisions ?? [],
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
        `${index + 1}. ${memory.document_name} (Step: ${memory.step_name}) (relevance ${score})`,
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

function formatRecentConversation(messages: ChatMessage[]): string | null {
  if (!messages.length) return null;

  const recent = messages.slice(-6); // Get last 6 messages for context
  return recent
    .map((entry) => {
      const speaker = entry.role === "assistant" ? "Assistant" : "User";
      return `${speaker}: ${entry.content}`;
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