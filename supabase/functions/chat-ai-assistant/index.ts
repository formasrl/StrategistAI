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

interface AiReviewRecord {
  id: string;
  summary: string | null;
  strengths: string[] | null;
  issues: string[] | null;
  suggestions: string[] | null;
  consistency_issues: string[] | null;
  readiness: string | null;
  readiness_reason: string | null;
  review_timestamp: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[chat-ai-assistant] Function started.");
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
      uploadedFiles,
    }: {
      message?: string;
      projectId?: string;
      stepId?: string;
      documentId?: string;
      chatSessionId?: string;
      stream?: boolean;
      uploadedFiles?: UploadedFile[];
    } = body ?? {};

    console.log("[chat-ai-assistant] Request body parsed:", { projectId, stepId, documentId, chatSessionId: incomingChatSessionId, stream, uploadedFiles: uploadedFiles?.length });

    if (!message || !projectId) {
      return respond({ error: "message and projectId are required." }, 400);
    }

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
      console.log("[chat-ai-assistant] Creating new chat session.");
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
      console.log("[chat-ai-assistant] New chat session created:", currentChatSessionId);
    }

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
    console.log("[chat-ai-assistant] User message inserted.");

    const { data: projectData, error: projectError } = await supabaseClient
      .from("projects")
      .select("id, user_id, name, one_liner, audience, positioning, constraints, project_profile")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !projectData) {
      console.error("Failed to fetch project data:", projectError);
      return respond({ error: "Project not found or accessible." }, 404);
    }
    console.log("[chat-ai-assistant] Project data fetched.");

    const project = projectData as ProjectRecord;
    const openAIKeyResult = await resolveOpenAIApiKey(supabaseClient, project.user_id);
    if (!openAIKeyResult.ok) {
      console.error("Failed to resolve OpenAI API key:", openAIKeyResult.error);
      return respond({ error: openAIKeyResult.error }, openAIKeyResult.status ?? 400);
    }
    console.log("[chat-ai-assistant] OpenAI API key resolved.");
    let currentProjectProfileText = fetchProjectProfileText(project);

    let currentDocumentContextText: string | null = null;
    let currentDocumentContentExcerpt: string | null = null;
    let documentSummaryForSemanticSearch: string | undefined;

    if (documentId) {
      console.log("[chat-ai-assistant] Fetching document details.");
      const { data: documentDetails, error: docError } = await supabaseClient
        .from("documents")
        .select("id, document_name, content, summary, key_decisions, project_id, step_id")
        .eq("id", documentId)
        .maybeSingle<DocumentRecord>();

      if (docError || !documentDetails) {
        console.error("Failed to fetch document details:", docError);
        return respond({ error: "Document not found or accessible." }, 404);
      }
      if (documentDetails.project_id !== projectId) {
        console.error("Document does not belong to the provided project.");
        return respond({ error: "Document does not belong to the provided project." }, 403);
      }

      if (!effectiveStepId) {
        effectiveStepId = documentDetails.step_id;
      } else if (documentDetails.step_id !== effectiveStepId) {
        console.error("Document does not belong to the provided step.");
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
      console.log("[chat-ai-assistant] Document details fetched.");
    }

    if (!effectiveStepId) {
      console.error("Could not determine active step context.");
      return respond({ error: "Could not determine active step context." }, 400);
    }

    let reviewContextSection: string | null = null;
    if (documentId) {
      console.log("[chat-ai-assistant] Fetching latest AI review.");
      const { data: reviewData, error: reviewError } = await supabaseClient
        .from("ai_reviews")
        .select("id, summary, strengths, issues, suggestions, consistency_issues, readiness, readiness_reason, review_timestamp")
        .eq("document_id", documentId)
        .order("review_timestamp", { ascending: false })
        .limit(1);

      if (reviewError) {
        console.error("Failed to load AI reviews for context", reviewError);
      } else if (reviewData && reviewData.length > 0) {
        reviewContextSection = formatReviewContext(reviewData as AiReviewRecord[]);
      } else {
        reviewContextSection = "No AI reviews exist for this document yet.";
      }
      console.log("[chat-ai-assistant] Latest AI review fetched.");
    }

    const queryTextForSemanticSearch =
      documentSummaryForSemanticSearch && documentSummaryForSemanticSearch.trim() !== ""
        ? documentSummaryForSemanticSearch
        : message;

    console.log("[chat-ai-assistant] Creating embedding for semantic search.");
    const queryEmbedding = await createEmbedding(openAIKeyResult.key, queryTextForSemanticSearch);
    console.log("[chat-ai-assistant] Embedding created.");

    await logAiUsage(
      supabaseClient,
      project.id,
      project.user_id,
      "chat-ai-assistant (embedding)",
      EMBEDDING_MODEL,
      queryTextForSemanticSearch.length,
      queryEmbedding.length
    );
    console.log("[chat-ai-assistant] AI usage logged for embedding.");

    console.log("[chat-ai-assistant] Calling RPC for semantic matches.");
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
    console.log("[chat-ai-assistant] RPC for semantic matches completed.");

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

    console.log("[chat-ai-assistant] Fetching step details.");
    const { data: stepData, error: stepError } = await supabaseClient
      .from("steps")
      .select(
        "id, step_name, description, why_matters, timeline, guiding_questions, expected_output, phases(phase_name, phase_number, project_id)"
      )
      .eq("id", effectiveStepId)
      .maybeSingle();

    if (stepError || !stepData) {
      console.error("Failed to fetch step details:", stepError);
      return respond({ error: "Step details not found or accessible." }, 404);
    }
    if (stepData.phases?.project_id !== projectId) {
      console.error("Step does not belong to the provided project.");
      return respond({ error: "Step does not belong to the provided project." }, 403);
    }
    const step = stepData as StepRecord;
    let currentStepDefinition = formatStepDefinition(step);
    console.log("[chat-ai-assistant] Step details fetched.");

    console.log("[chat-ai-assistant] Fetching recent chat messages.");
    const { data: recentMessagesData, error: recentMessagesError } = await supabaseClient
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("chat_session_id", currentChatSessionId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (recentMessagesError) {
      console.error("Failed to fetch recent chat messages:", recentMessagesError);
    }
    console.log("[chat-ai-assistant] Recent chat messages fetched.");

    const { snippet: currentConversationSnippet, pruned: historyPruned, lastAiInsertContent } = formatRecentConversation(
      (recentMessagesData || []) as ChatMessage[],
      MAX_HISTORY_CHARS
    );
    console.log("[chat-ai-assistant] Recent conversation formatted.");

    let uploadedFilesContent = "";
    if (uploadedFiles && uploadedFiles.length > 0) {
      const charsPerFile = Math.floor(TRUNCATION_CHAR_LIMIT / uploadedFiles.length);
      uploadedFilesContent = uploadedFiles.map(f => 
        `--- FILE: ${f.name} ---\n${truncateToChars(f.content, charsPerFile)}`
      ).join("\n\n");
      console.log("[chat-ai-assistant] Uploaded files content processed.");
    }

    const systemPrompt = [
      "You are StrategistAI, a senior brand strategist and coach.",
      "The user is working on brand strategy documents. Your role is to help them complete specific steps in a roadmap.",
      "",
      "CONTEXT AWARENESS:",
      "- You have access to the 'CURRENT STEP' details, including its Goal, Guiding Questions, and Expected Output.",
      "- You have access to the 'PROJECT PROFILE', 'RECENT AI REVIEWS', and 'RELEVANT SEMANTIC MEMORIES'.",
      "- Treat the Guiding Questions as the blueprint for the document.",
      "- You might also have access to 'PREVIOUS DRAFT CONTENT' if the user is iterating on a generated draft.", // Added
      "",
      "MODES OF OPERATION:",
      "1) ADVISORY / Q&A MODE:",
      "- Triggered when the user asks questions, wants clarification, or is not explicitly asking you to 'write', 'draft', 'generate', or 'fill out' the step.",
      "- Give concise answers (1–3 short paragraphs or up to 5 bullets).",
      "- Reference Guiding Questions, reviews, and prior decisions when relevant, but DO NOT output a full draft document.",
      "",
      "2) GENERATION / DRAFTING MODE:",
      "- Triggered when the user asks you to 'do the step', 'write the document', 'fill this out', 'generate the content', or similar.",
      "- This mode applies to any document, regardless of its current 'published' or 'draft' status. The client-side application will handle any necessary RAG disconnection.",
      "- FIRST: Inspect the Guiding Questions listed in the CURRENT STEP and the summaries from RECENT AI REVIEWS.",
      "- For each question, check whether the answer is clearly present in the PROJECT PROFILE, RECENT AI REVIEWS, RELEVANT SEMANTIC MEMORIES, UPLOADED FILES CONTENT, RECENT CONVERSATION, or the user's latest message.",
      "- If ANY guiding question cannot be reasonably answered from available information, DO NOT generate the full document yet.",
      "- Instead, respond concisely with 1–2 short paragraphs asking the user for the missing information, explicitly listing which questions still need answers.",
      "- ONLY AFTER the user has provided enough detail to reasonably address all Guiding Questions should you generate a full draft.",
      "",
      "WHEN GENERATING THE DRAFT:",
      "- If 'PREVIOUS DRAFT CONTENT' is provided, use it as the base and apply the user's new instructions as modifications or additions.", // Added
      "- If 'PREVIOUS DRAFT CONTENT' is NOT provided, generate the draft from scratch based on the current context.", // Added
      "- Keep the tone clear and professional, avoiding fluff.",
      "- Use headings and structure that map directly to the Guiding Questions or their logical groupings.",
      "- The draft should be focused and concise, not bloated: usually 3–8 short sections, not a wall of text.",
      "- IMPORTANT: You MUST return the draft content inside a JSON block at the ABSOLUTE END of your message in this exact format:",
      '```json',
      '{"insert_content": "YOUR MARKDOWN CONTENT HERE"}',
      '```',
      "- The Markdown in 'insert_content' must be the FULL usable document; do not add extra keys.",
      "- Outside the JSON block, provide at most 1–2 short paragraphs summarizing what you produced.",
      "",
      "GENERAL RULES:",
      "- If the user has not asked for a full draft, stay in Q&A mode and keep replies concise.",
      "- Never invent firm factual details that contradict known project information; if something is unknown, call it out and offer a reasonable suggestion.",
      "- Be explicit when you need more information: quote or paraphrase the exact Guiding Questions that are missing answers.",
      "- When referencing RECENT AI REVIEWS, clearly explain why previous reviews highlighted certain strengths or issues if the user asks.",
    ].join(" ");

    const promptParts: string[] = [];
    promptParts.push(`PROJECT PROFILE:\n${currentProjectProfileText}`);
    if (currentDocumentContextText) {
      promptParts.push(`CURRENT DOCUMENT CONTEXT:\n${currentDocumentContextText}`);
    }
    if (reviewContextSection) {
      promptParts.push(`LATEST AI REVIEW:\n${reviewContextSection}`);
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
    if (lastAiInsertContent) { // Added previous draft content
      promptParts.push(`PREVIOUS DRAFT CONTENT:\n${lastAiInsertContent}`);
    }
    promptParts.push(`USER QUESTION:\n${message}`);

    let finalPrompt = promptParts.join("\n\n");
    let totalPromptTokens = countTokens(systemPrompt + finalPrompt);

    const modelTokenLimit = getModelTokenLimit(CHAT_MODEL);

    if (totalPromptTokens > modelTokenLimit) {
      console.warn(`[chat-ai-assistant] Initial prompt exceeds model token limit (${totalPromptTokens} > ${modelTokenLimit}). Attempting truncation.`);
      if (uploadedFilesContent && countTokens(uploadedFilesContent) > 1000) {
        const halfLimit = Math.floor(TRUNCATION_CHAR_LIMIT / 2);
        const charsPerFile = uploadedFiles ? Math.floor(halfLimit / uploadedFiles.length) : 0;
        uploadedFilesContent = uploadedFiles ? uploadedFiles.map(f => 
          `--- FILE: ${f.name} ---\n${truncateToChars(f.content, charsPerFile)}`
        ).join("\n\n") : "";

        finalPrompt = rebuildPrompt(
          currentProjectProfileText,
          currentDocumentContextText,
          formattedSemanticMemories,
          reviewContextSection,
          currentStepDefinition,
          currentConversationSnippet,
          currentDocumentContentExcerpt,
          uploadedFilesContent,
          lastAiInsertContent, // Pass to rebuildPrompt
          message
        );
        totalPromptTokens = countTokens(systemPrompt + finalPrompt);
        console.log(`[chat-ai-assistant] After uploaded files truncation, new token count: ${totalPromptTokens}`);
      }

      if (totalPromptTokens > modelTokenLimit) {
        console.error(`[chat-ai-assistant] Final prompt still exceeds model token limit: ${totalPromptTokens} tokens.`);
        return respond(
          {
            error: `Your request is too long (${totalPromptTokens} tokens). Even after truncating document content, it exceeds the model's ${modelTokenLimit} token limit. Please shorten your document content or message.`,
          },
          400,
        );
      }
    }
    console.log("[chat-ai-assistant] Final prompt constructed.");

    if (!stream) {
      console.log("[chat-ai-assistant] Sending non-streaming chat completion request to OpenAI.");
      const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIKeyResult.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          temperature: 0.5,
          max_tokens: 1200,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: finalPrompt },
          ],
        }),
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.error("Chat completion error (non-stream):", errorText);
        return respond({ error: "AI coach request failed." }, chatResponse.status);
      }

      const completion = await chatResponse.json();
      const fullReplyContent: string =
        completion?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
      console.log("[chat-ai-assistant] OpenAI non-streaming response received.");

      await supabaseClient.from("chat_messages").insert({
        chat_session_id: currentChatSessionId,
        role: "assistant",
        content: fullReplyContent,
      });
      console.log("[chat-ai-assistant] AI message inserted into DB.");

      await logAiUsage(
        supabaseClient,
        project.id,
        project.user_id,
        "chat-ai-assistant (chat)",
        CHAT_MODEL,
        finalPrompt.length,
        fullReplyContent.length
      );
      console.log("[chat-ai-assistant] AI usage logged for chat.");

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

    console.log("[chat-ai-assistant] Sending streaming chat completion request to OpenAI.");
    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIKeyResult.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.5,
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: finalPrompt },
        ],
        stream: true,
      }),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error("Chat completion error (streaming):", errorText);
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
          console.log("[chat-ai-assistant] OpenAI streaming response fully received.");

          await supabaseClient.from("chat_messages").insert({
            chat_session_id: currentChatSessionId,
            role: "assistant",
            content: fullReplyContent,
          });
          console.log("[chat-ai-assistant] AI message inserted into DB (streaming).");

          await logAiUsage(
            supabaseClient,
            project.id,
            project.user_id,
            "chat-ai-assistant (chat)",
            CHAT_MODEL,
            finalPrompt.length,
            fullReplyContent.length
          );
          console.log("[chat-ai-assistant] AI usage logged for chat (streaming).");

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
          console.log("[chat-ai-assistant] Stream closed.");
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
    console.error("[chat-ai-assistant] Top-level error:", error);
    return respond({ error: "Unexpected error while generating AI response." }, 500);
  }
});

function rebuildPrompt(
  projectProfile: string,
  documentContext: string | null,
  semanticMemories: string,
  reviewContext: string | null,
  stepDefinition: string,
  conversationSnippet: string | null,
  documentExcerpt: string | null,
  uploadedFilesContent: string | null,
  previousDraftContent: string | null, // Added
  userQuestion: string
): string {
  const parts: string[] = [];
  parts.push(`PROJECT PROFILE:\n${projectProfile}`);
  if (documentContext) {
    parts.push(`CURRENT DOCUMENT CONTEXT:\n${documentContext}`);
  }
  if (reviewContext) {
    parts.push(`LATEST AI REVIEW:\n${reviewContext}`);
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
  if (previousDraftContent) { // Added previous draft content
    parts.push(`PREVIOUS DRAFT CONTENT:\n${previousDraftContent}`);
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

function formatReviewContext(reviews: AiReviewRecord[]): string {
  return reviews
    .map((review, index) => {
      const strengths = review.strengths?.slice(0, 2).map((item) => `  • ${item}`) ?? ["  • None listed."];
      const issues = review.issues?.slice(0, 2).map((item) => `  • ${item}`) ?? ["  • None listed."];
      const suggestions = review.suggestions?.slice(0, 2).map((item) => `  • ${item}`) ?? ["  • None listed."];

      return [
        `${index + 1}. Review Timestamp: ${review.review_timestamp ?? "Unknown"}`,
        `  Readiness: ${review.readiness ?? "not_specified"}${review.readiness_reason ? ` (${review.readiness_reason})` : ""}`,
        `  Summary: ${review.summary ?? "Not provided."}`,
        "  Strengths:",
        ...strengths,
        "  Issues:",
        ...issues,
        "  Suggestions:",
        ...suggestions,
      ].join("\n");
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
): { snippet: string | null; pruned: boolean; lastAiInsertContent: string | null } {
  if (!messages.length) return { snippet: null, pruned: false, lastAiInsertContent: null };

  const formattedLines: string[] = [];
  let currentLength = 0;
  let historyPruned = false;
  let lastAiInsertContent: string | null = null;

  // Iterate from most recent to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const entry = messages[i];
    const speaker = entry.role === "assistant" ? "Assistant" : "User";
    const line = `${speaker}: ${entry.content}`;

    // Check for last AI insert content from the assistant's message
    if (entry.role === "assistant" && lastAiInsertContent === null) {
      const { insertContent } = extractInsertContent(entry.content);
      if (insertContent) {
        lastAiInsertContent = insertContent;
      }
    }

    if (currentLength + line.length + (formattedLines.length > 0 ? "\n".length : 0) > maxChars) {
      historyPruned = true;
      break;
    }

    formattedLines.unshift(line); // Add to the beginning to maintain chronological order
    currentLength += line.length + (formattedLines.length > 1 ? "\n".length : 0);
  }

  return { snippet: formattedLines.join("\n"), pruned: historyPruned, lastAiInsertContent };
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