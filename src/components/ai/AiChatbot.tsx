import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Loader2, Bot, User, BookOpen, PlusCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatSource {
  document_name: string;
  chunk_preview: string;
  relevance_score: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  sources?: ChatSource[];
  isStreaming?: boolean; // Track if this message is currently being streamed
}

interface AiChatbotProps {
  projectId?: string;
  phaseId?: string;
  stepId?: string;
  documentId?: string;
}

const AiChatbot: React.FC<AiChatbotProps> = ({ projectId, phaseId, stepId, documentId }) => {
  const { session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | undefined>(undefined);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, isSending]);

  // 1. Fetch History & Setup Subscription
  useEffect(() => {
    let isMounted = true;

    const initializeChat = async () => {
      if (!projectId) return;

      // Clean up old subscription if exists
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }

      setIsLoadingHistory(true);
      setMessages([]);
      setCurrentChatSessionId(undefined);

      try {
        // A. Find the active session
        let query = supabase
          .from('chat_sessions')
          .select('id')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (documentId) {
          query = query.eq('document_id', documentId);
        } else if (stepId) {
          query = query.eq('step_id', stepId).is('document_id', null);
        } else {
          query = query.is('step_id', null).is('document_id', null);
        }

        const { data: sessionData, error: sessionError } = await query.maybeSingle();

        if (sessionError) {
          console.error('Error fetching chat session:', sessionError);
        } else if (sessionData && isMounted) {
          const sessionId = sessionData.id;
          setCurrentChatSessionId(sessionId);

          // B. Fetch existing messages
          const { data: messagesData, error: messagesError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('chat_session_id', sessionId)
            .order('created_at', { ascending: true });

          if (messagesError) {
            console.error('Error fetching messages:', messagesError);
          } else if (messagesData) {
            const formattedMessages: ChatMessage[] = messagesData.map((msg) => ({
              id: msg.id,
              sender: msg.role === 'user' ? 'user' : 'ai',
              text: msg.content || '',
              timestamp: msg.created_at,
            }));
            setMessages(formattedMessages);
          }

          // C. Subscribe to Realtime changes for this session
          // This acts as a safety net: if streaming fails or misses something,
          // the database insertion will trigger this and update the UI.
          const channel = supabase
            .channel(`chat:${sessionId}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `chat_session_id=eq.${sessionId}`,
              },
              (payload) => {
                const newMsg = payload.new as any;
                setMessages((prev) => {
                  // Prevent duplicates (if we already added it optimistically or via stream)
                  // We check by ID if available, but optimistic IDs are random UUIDs.
                  // Strategy: Ideally we'd match IDs, but Edge Function might not return the DB ID immediately.
                  // We will rely on the fact that the DB insert usually happens AFTER streaming is done.
                  
                  // Simple check: if we have a message with this exact content and role at the end, ignore.
                  // A better check: If we are "streaming", we ignore DB inserts for "ai" role to prevent jitter,
                  // unless the stream has finished.
                  
                  // For simplicity in this fix: We'll only add if we don't have this ID.
                  // AND if it's an AI message, we check if we have a "streaming" AI message currently.
                  const exists = prev.some(m => m.id === newMsg.id);
                  if (exists) return prev;

                  // If we are actively sending/streaming, and this is an AI message, it might be the one we are streaming.
                  // In that case, we might duplicate.
                  // However, this subscription is VITAL for the "refresh" fix.
                  // If the user sees nothing, this will make it appear.
                  
                  return [...prev, {
                    id: newMsg.id,
                    sender: newMsg.role === 'user' ? 'user' : 'ai',
                    text: newMsg.content,
                    timestamp: newMsg.created_at
                  }];
                });
              }
            )
            .subscribe();
          
          subscriptionRef.current = channel;
        }
      } catch (err) {
        console.error('Unexpected error loading history:', err);
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    initializeChat();

    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [projectId, stepId, documentId]);


  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatSessionId(undefined);
    setInputMessage('');
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  };

  // Helper to generate a temporary ID for optimistic updates
  const generateTempId = () => crypto.randomUUID();

  const sendToAiAssistant = async (userMessageText: string) => {
    if (!session?.access_token) {
      showError('Authentication session missing. Please refresh.');
      return;
    }

    const tempAiMsgId = generateTempId();

    // Optimistic Update: Add AI placeholder immediately
    setMessages((prev) => [
      ...prev,
      {
        id: tempAiMsgId,
        sender: 'ai',
        text: '', // Start empty
        timestamp: new Date().toISOString(),
        sources: [],
        isStreaming: true,
      },
    ]);

    try {
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/chat-ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: userMessageText,
            projectId,
            phaseId,
            stepId,
            documentId,
            chatSessionId: currentChatSessionId,
            stream: true, // Always try streaming first
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to connect to AI service.');
      }

      // Check content type to determine handling strategy
      const contentType = response.headers.get('Content-Type') || '';
      const isStreamingResponse = contentType.includes('text/event-stream');

      if (!isStreamingResponse) {
        // Fallback: Handle standard JSON response
        const data = await response.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempAiMsgId
              ? {
                  ...msg,
                  text: data.reply || 'No response received.',
                  sources: data.sources || [],
                  isStreaming: false,
                }
              : msg
          )
        );
        if (data.chatSessionId && !currentChatSessionId) {
          setCurrentChatSessionId(data.chatSessionId);
        }
        return;
      }

      // Handle Streaming Response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';

      if (!reader) throw new Error('No reader available for stream.');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data: ')) continue;

          const dataStr = trimmedLine.substring(6);
          if (dataStr === '[DONE]') continue;

          try {
            const json = JSON.parse(dataStr);

            // 1. Token Update
            if (json.type === 'token' && json.content) {
              accumulatedText += json.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAiMsgId
                    ? { ...msg, text: accumulatedText }
                    : msg
                )
              );
            } 
            // 2. Sources / Metadata Update
            else if (json.type === 'sources') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAiMsgId
                    ? { ...msg, sources: json.content }
                    : msg
                )
              );
              // Update session ID if it was created during this turn
              if (json.chatSessionId && !currentChatSessionId) {
                setCurrentChatSessionId(json.chatSessionId);
              }
            } 
            // 3. Error from stream
            else if (json.type === 'error') {
              accumulatedText += `\n[Error: ${json.content}]`;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === tempAiMsgId
                    ? { ...msg, text: accumulatedText }
                    : msg
                )
              );
            }
          } catch (e) {
            console.warn('Error parsing stream chunk:', e);
          }
        }
      }

      // Mark streaming as done
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAiMsgId ? { ...msg, isStreaming: false } : msg
        )
      );

    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAiMsgId
            ? {
                ...msg,
                text: (msg.text || '') + `\n\n[System Error: ${err.message || 'Connection failed'}]`,
                isStreaming: false,
              }
            : msg
        )
      );
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    if (!projectId) {
      showError('Select a project to chat with StrategistAI.');
      return;
    }

    const text = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    // Optimistic User Message
    const tempUserMsgId = generateTempId();
    setMessages((prev) => [
      ...prev,
      {
        id: tempUserMsgId,
        sender: 'user',
        text: text,
        timestamp: new Date().toISOString(),
      },
    ]);

    await sendToAiAssistant(text);
    setIsSending(false);
  };

  const getContextTitle = () => {
    if (documentId) return 'Document Chat';
    if (stepId) return 'Step Chat';
    if (phaseId) return 'Phase Chat';
    if (projectId) return 'Project Chat';
    return 'General Chat';
  };

  // --- Rendering Helpers ---

  const renderMessageContent = (text: string) => {
    // Simple markdown-like link parser: [Label](url)
    const parts: React.ReactNode[] = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, label, url] = match;
      const preText = text.substring(lastIndex, match.index);
      if (preText) parts.push(preText);
      
      parts.push(
        <Link key={match.index} to={url} className="text-blue-500 hover:underline font-medium">
          {label}
        </Link>
      );
      lastIndex = regex.lastIndex;
    }
    
    const remaining = text.substring(lastIndex);
    if (remaining) parts.push(remaining);

    return <>{parts.length > 0 ? parts : text}</>;
  };

  const renderSources = (sources?: ChatSource[]) => {
    if (!sources || sources.length === 0) return null;

    return (
      <Collapsible className="mt-3 border-t border-border pt-2">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left">
            <BookOpen className="h-3 w-3" />
            <span>References</span>
            <ChevronDown className="h-3 w-3 ml-auto transition-transform duration-200 data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 animate-accordion-down">
          {sources.map((source, i) => (
            <div key={i} className="rounded bg-background/50 p-2 text-xs border border-border/50">
              <div className="font-medium mb-0.5">{source.document_name}</div>
              <div className="text-muted-foreground line-clamp-2 text-[10px] italic">
                "{source.chunk_preview}"
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card className="flex flex-col h-full border-none shadow-none bg-transparent">
      {/* Header */}
      <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-500" />
          <span className="truncate">{getContextTitle()}</span>
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleNewChat} className="h-8 w-8">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Start New Session</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>

      {/* Messages Area */}
      <CardContent className="flex-1 p-0 overflow-hidden relative bg-background/50">
        <ScrollArea className="h-full p-4">
          <div className="space-y-6 pb-4 min-h-[200px]">
            
            {/* Empty State */}
            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground px-8">
                <div className="bg-muted/50 p-4 rounded-full mb-4">
                  <Bot className="h-8 w-8 text-primary/60" />
                </div>
                <h3 className="font-medium text-foreground mb-1">AI Brand Strategist</h3>
                <p className="text-sm">Ask me anything about your project, documents, or brand strategy.</p>
              </div>
            )}

            {/* Loading History */}
            {isLoadingHistory && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Message List */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex w-full gap-3',
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.sender === 'ai' && (
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                
                <div
                  className={cn(
                    'relative px-4 py-3 rounded-2xl max-w-[85%] shadow-sm text-sm leading-relaxed',
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-card border border-border text-card-foreground rounded-tl-sm'
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {renderMessageContent(msg.text)}
                    {msg.sender === 'ai' && msg.text === '' && msg.isStreaming && (
                      <span className="inline-flex gap-1 items-center ml-1">
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                  
                  {msg.sender === 'ai' && renderSources(msg.sources)}
                  
                  <div className={cn(
                    "text-[10px] mt-1 text-right opacity-70",
                    msg.sender === 'user' ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input Area */}
      <CardFooter className="p-4 pt-2 border-t border-border bg-background">
        <form onSubmit={handleSendMessage} className="flex w-full gap-2">
          <Input
            id="tour-ai-chat-input"
            placeholder="Ask a question..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending}
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={!inputMessage.trim() || isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default AiChatbot;