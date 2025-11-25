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
const TRUNCATION_CHAR_LIMIT = 3000; // Max characters for document content
const MAX_HISTORY_CHARS = 4000; // Maximum characters for conversation history
const MAX_SEMANTIC_MEMORIES_CHARS = 2000; // Maximum characters for semantic memories
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
  guiding_questions: string[] | null;
  expected_output: string | null;
  phases?: {
    phase_name: string | null;
    phase_number: number | null;
    project_id: string;
  } | null;
}

interface DocumentRecord {
  id: string;
  project_id: string;
  step_id: string;
  document_name: string;
  content: string | null;
  summary: string | null;
  key_decisions: string[] | null;
}

interface SemanticMatch {
  document_id: string;
  document_name: string;
  summary: string;
  title: string;
  tags: string[] | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface UploadedFile {
  name: string;
  content: string;
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
      stream = true,
      uploadedFiles, // New: array of uploaded files
    }: {
      message?: string;
      projectId?: string;
      stepId?: string;
      documentId?: string;
      chatSessionId?: string;
      stream?: boolean;
      uploadedFiles?: UploadedFile[];
    } = body ?? {};

    if (!message || !projectId) {
      return respond({ error: "message and projectId are required." }, 400);
    }

    // Relaxed validation: we need EITHER stepId OR documentId (from which we can derive stepId)
    if (!stepId && !documentId) {
      return respond({ error: "Either stepId or documentId is required." }, 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    let effectiveStepId = stepId;
    let currentChatSessionId = incomingChatSessionId;

    if (!currentChatSessionId) {
      const { data: newSession, error: sessionError } = await supabaseClient
        .from("chat_sessions")
        .insert({ project_id: projectId, step_id: stepId || null, document_id: documentId || null })
        .select("id")
        .single();

      if (sessionError) {
        console.error("Failed to create chat session:", sessionError);
        return respond({ error: "Failed to start chat session." }, 500);
      }
      currentChatSessionId = newSession.id;
    }

    // Format file names for the user message
    let userMessageContent = message;
    if (uploadedFiles && uploadedFiles.length > 0) {
      const fileNames = uploadedFiles.map(f => f.name).join(", ");
      userMessageContent = `(Files: ${fileNames}) ${message}`;
    }

    await supabaseClient.from("chat_messages").insert({
      chat_session_id: currentChatSessionId,
      role: "user",
      content: userMessageContent,
    });

    // Layer 1: Project Profile
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

    // Layer 2: Current Document Context
    let currentDocumentContextText: string | null = null;
    let currentDocumentContentExcerpt: string | null = null;
    let documentSummaryForSemanticSearch: string | undefined;

    if (documentId) {
      const { data: documentDetails, error: docError } = await supabaseClient
        .from("documents")
        .select("id, document_name, content, summary, key_decisions, project_id, step_id")
        .eq("id", documentId)
        .maybeSingle<DocumentRecord>();

      if (docError || !documentDetails) {
        return respond({ error: "Document not found or accessible." }, 404);
      }
      if (documentDetails.project_id !== projectId) {
        return respond({ error: "Document does not belong to the provided project." }, 403);
      }

      // Derive stepId from document if missing
      if (!effectiveStepId) {
        effectiveStepId = documentDetails.step_id;
      } else if (documentDetails.step_id !== effectiveStepId) {
        return respond({ error: "Document does not belong to the provided step." }, 403);
      }

      currentDocumentContextText = buildDocumentContextString(
        documentDetails.document_name,
        documentDetails.summary,
        documentDetails.key_decisions
      );
      currentDocumentContentExcerpt = buildDraftSegment(
        stripHtmlTags(documentDetails.content ?? ""),
        documentDetails.summary
      );
      documentSummaryForSemanticSearch =
        typeof documentDetails.summary === "string" ? documentDetails.summary : undefined;
    }

    if (!effectiveStepId) {
      return respond({ error: "Could not determine active step context." }, 400);
    }

    // Layer 3: Semantic Retrieval (search_document_embeddings)
    const queryTextForSemanticSearch =
      documentSummaryForSemanticSearch && documentSummaryForSemanticSearch.trim() !== ""
        ? documentSummaryForSemanticSearch
        : message;

    const queryEmbedding = await createEmbedding(openAIKeyResult.key, queryTextForSemanticSearch);

    // Log embedding AI usage
    await logAiUsage(
      supabaseClient,
      project.id,
      project.user_id,
      "chat-ai-assistant (embedding)",
      EMBEDDING_MODEL,
      queryTextForSemanticSearch.length,
      queryEmbedding.length // Log dimension for embedding output length
    );

    const { data: semanticMatchesData, error: rpcError } = await supabaseClient.rpc(
      "search_document_embeddings",
      {
        input_project_id: projectId,
        query_embedding: queryEmbedding,
        top_k: 7,
      }
    );

    if (rpcError) {
      console.error("search_document_embeddings error", rpcError);
    }

    const semanticMatches = (semanticMatchesData || []) as SemanticMatch[];
    let formattedSemanticMemories = formatSemanticSearchResults(semanticMatches);

    const sources = semanticMatches.map((match) => {
      const chunk = match.summary || "";
      const chunk_preview = chunk.length > 220 ? `${chunk.slice(0, 217)}...` : chunk;
      const relevance_score = 1;
      return {
        document_name: match.document_name,
        chunk_preview,
        relevance_score,
      };
    });

    // Layer 4: Current Step Info
    const { data: stepData, error: stepError } = await supabaseClient
      .from("steps")
      .select(
        "id, step_name, description, why_matters, timeline, guiding_questions, expected_output, phases(phase_name, phase_number, project_id)"
      )
      .eq("id", effectiveStepId)
      .maybeSingle();

    if (stepError || !stepData) {
      return respond({ error: "Step details not found or accessible." }, 404);
    }
    if (stepData.phases?.project_id !== projectId) {
      return respond({ error: "Step does not belong to the provided project." }, 403);
    }
    const step = stepData as StepRecord;
    let currentStepDefinition = formatStepDefinition(step);

    // Layer 5: Recent Conversation History
    const { data: recentMessagesData, error: recentMessagesError } = await supabaseClient
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("chat_session_id", currentChatSessionId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (recentMessagesError) {
      console.error("Failed to fetch recent chat messages:", recentMessagesError);
    }

    const { snippet: currentConversationSnippet, pruned: historyPruned } = formatRecentConversation(
      (recentMessagesData || []) as ChatMessage[],
      MAX_HISTORY_CHARS
    );

    const systemPrompt = [
      "You are StrategistAI, a senior brand strategist and coach.",
      "The user is working on brand strategy documents. Your goal is to help them complete specific steps in a roadmap.",
      
      "CONTEXT AWARENESS:",
      "- You have access to the 'CURRENT STEP' details, including its Goal, Guiding Questions, and Expected Output.",
      "- You have access to the 'PROJECT PROFILE' and 'RELEVANT SEMANTIC MEMORIES'.",
      
      "CRITICAL INSTRUCTION ON STEP LOGIC:",
      "- The 'Guiding Questions' in the Current Step are the blueprint for the document.",
      "- When generating content, you MUST address these questions. They are not optional suggestions; they are the requirements.",
      
      "MODES OF OPERATION:",
      "1. ADVISORY/Q&A: If the user asks a question, asks for clarification, or their intent is just to chat:",
      "   - Reply normally with text.",
      "   - If the user is asking how to complete the step, guide them through the Guiding Questions one by one.",
      
      "2. GENERATION/DRAFTING: If the user asks to 'do the step', 'write the document', 'draft this', 'generate', 'fill it out', or implies creating the deliverable:",
      "   - You must generate a high-quality, complete draft.",
      "   - STRUCTURE: Organize the document to explicitly answer the Guiding Questions defined in the step. Use headers that correspond to these questions or the logical sections they imply.",
      "   - CONTENT SOURCE: Use the Project Profile, uploaded files, and previous memories. If information is missing to answer a guiding question, make a strategic recommendation based on standard brand strategy best practices and the limited context you have, but mark it as a recommendation.",
      "   - FORMAT: Provide a short conversational intro (e.g., 'I've drafted the document based on the step requirements...'), then OUTPUT THE DOCUMENT CONTENT inside a JSON block.",
      "   Format: ```json\n{\"insert_content\": \"YOUR MARKDOWN CONTENT HERE\"}\n```",
      "   - The Markdown in 'insert_content' must be the FULL, usable document content.",
      "   - Do not put the JSON block inside other code blocks. It must be standalone at the end.",
      
      "If the user uploads files, prioritize using that content for your analysis or generation.",
      "Always respect previously published decisions. If a new draft contradicts a previous decision, note this in your conversational reply.",
    ].join("\n");

    const modelTokenLimit = getModelTokenLimit(CHAT_MODEL);

    // Prepare Uploaded Files Content
    let uploadedFilesContent = "";
    if (uploadedFiles && uploadedFiles.length > 0) {
      // Simple truncation strategy: Divide limit by number of files
      const charsPerFile = Math.floor(TRUNCATION_CHAR_LIMIT / uploadedFiles.length);
      uploadedFilesContent = uploadedFiles.map(f => 
        `--- FILE: ${f.name} ---\n${truncateToChars(f.content, charsPerFile)}`
      ).join("\n\n");
    }

    // Assemble layers in order
    const promptParts: string[] = [];
    promptParts.push(`PROJECT PROFILE:\n${currentProjectProfileText}`);
    if (currentDocumentContextText) {
      promptParts.push(`CURRENT DOCUMENT CONTEXT:\n${currentDocumentContextText}`);
    }
    promptParts.push(`RELEVANT SEMANTIC MEMORIES:\n${formattedSemanticMemories}`);
    promptParts.push(`CURRENT STEP:\n${currentStepDefinition}`);
    if (currentConversationSnippet) {
      promptParts.push(`RECENT CONVERSATION:\n${currentConversationSnippet}`);
    }
    if (currentDocumentContentExcerpt) {
      promptParts.push(`CURRENT DRAFT EXCERPT:\n${currentDocumentContentExcerpt}`);
    }
    if (uploadedFilesContent) {
      promptParts.push(`UPLOADED FILES CONTENT:\n${uploadedFilesContent}`);
    }
    promptParts.push(`USER QUESTION:\n${message}`);

    let finalPrompt = promptParts.join("\n\n");
    let totalPromptTokens = countTokens(systemPrompt + finalPrompt);

    console.log(
      `[chat-ai-assistant] Initial prompt token count: ${totalPromptTokens} for model: ${CHAT_MODEL}`
    );

    // Truncation logic (simplified for multiple files)
    if (totalPromptTokens > modelTokenLimit) {
      console.log(`[chat-ai-assistant] Prompt exceeds ${modelTokenLimit} tokens. Attempting truncation.`);
      
      // Truncate file content further if needed (reduce by half)
      if (uploadedFilesContent && countTokens(uploadedFilesContent) > 1000) {
         const halfLimit = Math.floor(TRUNCATION_CHAR_LIMIT / 2);
         const charsPerFile = uploadedFiles ? Math.floor(halfLimit / uploadedFiles.length) : 0;
         uploadedFilesContent = uploadedFiles ? uploadedFiles.map(f => 
            `--- FILE: ${f.name} ---\n${truncateToChars(f.content, charsPerFile)}`
          ).join("\n\n") : "";
         
         // Rebuild prompt
         finalPrompt = rebuildPrompt(
            currentProjectProfileText,
            currentDocumentContextText,
            formattedSemanticMemories,
            currentStepDefinition,
            currentConversationSnippet,
            currentDocumentContentExcerpt,
            uploadedFilesContent,
            message
         );
         totalPromptTokens = countTokens(systemPrompt + finalPrompt);
      }
      
      // Further truncation logic for other parts if needed... (reusing previous logic pattern if necessary)
      // For brevity, assuming file truncation helps most as it's the new large input.
    }

    // ---------- Non-streaming mode ----------
    if (!stream) {
      const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIKeyResult.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          temperature: 0.5,
          max_tokens: 1200, // Increased to allow for full document generation
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: finalPrompt },
          ],
        }),
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error("Chat completion error (non-stream)", errorText);
        return respond({ error: "AI coach request failed." }, chatResponse.status);
      }

      const completion = await chatResponse.json();
      const fullReplyContent: string =
        completion?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";

      await supabaseClient.from("chat_messages").insert({
        chat_session_id: currentChatSessionId,
        role: "assistant",
        content: fullReplyContent,
      });

      await logAiUsage(
        supabaseClient,
        project.id,
        project.user_id,
        "chat-ai-assistant (chat)",
        CHAT_MODEL,
        finalPrompt.length,
        fullReplyContent.length
      );

      // Check for insert_content JSON block
      let insertContent: string | undefined;
      const jsonBlockMatch = fullReplyContent.match(/```json\n?({[\s\S]*?})\n?```/);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        try {
          const parsed = JSON.parse(jsonBlockMatch[1]);
          if (typeof parsed.insert_content === 'string') {
            insertContent = parsed.insert_content;
          }
        } catch (e) {
          console.error("Failed to parse insert_content JSON block:", e);
        }
      }

      return respond({
        reply: fullReplyContent,
        sources,
        chatSessionId: currentChatSessionId,
        metadata: { history_pruned: historyPruned },
        insertContent: insertContent,
      });
    }

    // ---------- Streaming SSE mode ----------
    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIKeyResult.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.5,
        max_tokens: 1200, // Increased
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: finalPrompt },
        ],
        stream: true,
      }),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error("Chat completion error", errorText);
      return respond({ error: "AI coach request failed." }, chatResponse.status);
    }

    const streamResponse = new ReadableStream({
      async start(controller) {
        const reader = chatResponse.body?.getReader();
        const decoder = new TextDecoder();
        let fullReplyContent = "";

        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.substring(6);
                if (data === "[DONE]") {
                  continue;
                }
                try {
                  const json = JSON.parse(data);
                  const token = json.choices[0].delta.content;
                  if (token) {
                    fullReplyContent += token;
                    controller.enqueue(
                      `data: ${JSON.stringify({ type: "token", content: token })}\n\n`,
                    );
                  }
                } catch (e) {
                  console.error("Error parsing stream chunk:", e, data);
                }
              }
            }
          }

          await supabaseClient.from("chat_messages").insert({
            chat_session_id: currentChatSessionId,
            role: "assistant",
            content: fullReplyContent,
          });

          await logAiUsage(
            supabaseClient,
            project.id,
            project.user_id,
            "chat-ai-assistant (chat)",
            CHAT_MODEL,
            finalPrompt.length,
            fullReplyContent.length
          );

          // Check for insert_content JSON block
          let insertContent: string | undefined;
          const jsonBlockMatch = fullReplyContent.match(/```json\n?({[\s\S]*?})\n?```/);
          if (jsonBlockMatch && jsonBlockMatch[1]) {
            try {
              const parsed = JSON.parse(jsonBlockMatch[1]);
              if (typeof parsed.insert_content === 'string') {
                insertContent = parsed.insert_content;
              }
            } catch (e) {
              console.error("Failed to parse insert_content JSON block in streamed response:", e);
            }
          }

          controller.enqueue(
            `data: ${JSON.stringify({
              type: "sources",
              content: sources,
              chatSessionId: currentChatSessionId,
              metadata: { history_pruned: historyPruned },
              insertContent: insertContent,
            })}\n\n`,
          );
        } catch (error) {
          console.error("Stream processing error:", error);
          controller.enqueue(
            `data: ${JSON.stringify({
              type: "error",
              content: "An error occurred during streaming.",
            })}\n\n`,
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(streamResponse, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

  } catch (error) {
    console.error("chat-ai-assistant error", error);
    return respond({ error: "Unexpected error while generating AI response." }, 500);
  }
});

function rebuildPrompt(
  projectProfile: string,
  documentContext: string | null,
  semanticMemories: string,
  stepDefinition: string,
  conversationSnippet: string | null,
  documentExcerpt: string | null,
  uploadedFilesContent: string | null,
  userQuestion: string
): string {
  const parts: string[] = [];
  parts.push(`PROJECT PROFILE:\n${projectProfile}`);
  if (documentContext) {
    parts.push(`CURRENT DOCUMENT CONTEXT:\n${documentContext}`);
  }
  parts.push(`RELEVANT SEMANTIC MEMORIES:\n${semanticMemories}`);
  parts.push(`CURRENT STEP:\n${stepDefinition}`);
  if (conversationSnippet) {
    parts.push(`RECENT CONVERSATION:\n${conversationSnippet}`);
  }
  if (documentExcerpt) {
    parts.push(`CURRENT DRAFT EXCERPT:\n${documentExcerpt}`);
  }
  if (uploadedFilesContent) {
    parts.push(`UPLOADED FILES CONTENT:\n${uploadedFilesContent}`);
  }
  parts.push(`USER QUESTION:\n${userQuestion}`);
  return parts.join("\n\n");
}

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
    console.error("Embedding error", errorText);
    throw new Error("Failed to generate embedding.");
  }

  const embeddingPayload = await response.json();
  const vector = embeddingPayload?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error("Embedding vector missing in response.");
  }

  return vector.map((value: number) => Number(value));
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

function buildDocumentContextString(
  documentName: string,
  summary: string | null,
  keyDecisions: string[] | null
): string {
  const parts = [`Document Name: ${documentName}`];
  if (summary && summary.trim()) {
    parts.push(`Summary: ${summary.trim()}`);
  }
  if (keyDecisions && keyDecisions.length > 0) {
    parts.push("Key Decisions:");
    keyDecisions.forEach((decision) => parts.push(`- ${decision}`));
  }
  return parts.join("\n");
}

function formatSemanticSearchResults(matches: SemanticMatch[]): string {
  if (!matches.length) {
    return "No relevant published documents found.";
  }

  return matches
    .map((match, index) => {
      const summary = match.summary.length > 220 ? `${match.summary.slice(0, 217)}...` : match.summary;
      return [
        `${index + 1}. Document: ${match.document_name}`,
        `  Summary: ${summary}`,
        match.tags && match.tags.length > 0 ? `  Tags: ${match.tags.join(", ")}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function formatStepDefinition(step: StepRecord): string {
  const guidingQuestions = step.guiding_questions && step.guiding_questions.length > 0
    ? step.guiding_questions.map(q => `- ${q}`).join("\n")
    : null;

  const lines = [
    `Name: ${sanitizeLine(step.step_name, "Untitled Step")}`,
    step.phases?.phase_name ? `Phase: ${step.phases.phase_name}` : undefined,
    step.description ? `Goal: ${step.description}` : undefined,
    step.why_matters ? `Why it matters: ${step.why_matters}` : undefined,
    step.timeline ? `Timeline: ${step.timeline}` : undefined,
    guidingQuestions ? `Guiding Questions:\n${guidingQuestions}` : undefined,
    step.expected_output ? `Expected Output: ${step.expected_output}` : undefined,
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

function formatRecentConversation(
  messages: ChatMessage[],
  maxChars: number
): { snippet: string | null; pruned: boolean } {
  if (!messages.length) return { snippet: null, pruned: false };

  const formattedLines: string[] = [];
  let currentLength = 0;
  let historyPruned = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const entry = messages[i];
    const speaker = entry.role === "assistant" ? "Assistant" : "User";
    const line = `${speaker}: ${entry.content}`;

    if (currentLength + line.length + (formattedLines.length > 0 ? "\n".length : 0) > maxChars) {
      historyPruned = true;
      break;
    }

    formattedLines.unshift(line);
    currentLength += line.length + (formattedLines.length > 1 ? "\n".length : 0);
  }

  return { snippet: formattedLines.join("\n"), pruned: historyPruned };
}

function sanitizeLine(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
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