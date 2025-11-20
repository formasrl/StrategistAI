import React, { useState, useRef, useEffect } from 'react';
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

  // 1. Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, isSending]);

  // 2. Fetch History & Determine Session ID
  useEffect(() => {
    let isMounted = true;

    const fetchHistory = async () => {
      if (!projectId) return;
      
      if (isMounted) {
        setIsLoadingHistory(true);
        setMessages([]);
        setCurrentChatSessionId(undefined);
      }

      try {
        // Resolve Session ID based on context
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
          setCurrentChatSessionId(sessionData.id);

          // Fetch messages for this session
          const { data: messagesData, error: messagesError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('chat_session_id', sessionData.id)
            .order('created_at', { ascending: true });

          if (messagesData && isMounted) {
            setMessages(messagesData.map(msg => ({
              id: msg.id,
              sender: msg.role === 'user' ? 'user' : 'ai',
              text: msg.content || '',
              timestamp: msg.created_at,
              sources: [], // Historic messages might not store sources directly in this simple schema
            })));
          }
        }
      } catch (err) {
        console.error('Failed to initialize chat:', err);
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    fetchHistory();

    return () => { isMounted = false; };
  }, [projectId, stepId, documentId]);

  // 3. Realtime Subscription (Reactive to currentChatSessionId)
  useEffect(() => {
    if (!currentChatSessionId) return;

    const channel = supabase
      .channel(`chat:${currentChatSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_session_id=eq.${currentChatSessionId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          
          setMessages((prev) => {
            // Deduplicate based on ID to prevent double-adding (optimistic + realtime)
            if (prev.some(m => m.id === newMsg.id)) return prev;

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChatSessionId]);

  // 4. Send Message (Force JSON Mode)
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputMessage.trim();
    if (!text || isSending) return;

    if (!projectId) {
      showError('Select a project to chat.');
      return;
    }

    setInputMessage('');
    setIsSending(true);

    // Optimistic Update (User Message)
    const tempUserMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: tempUserMsgId,
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    }]);

    try {
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/chat-ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            message: text,
            projectId,
            phaseId,
            stepId,
            documentId,
            chatSessionId: currentChatSessionId,
            stream: false, // FORCE JSON RESPONSE for stability
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch AI response');
      }

      const data = await response.json();
      
      // Update Session ID if newly created
      if (data.chatSessionId && !currentChatSessionId) {
        setCurrentChatSessionId(data.chatSessionId);
      }

      // Add AI Response to State
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: data.reply,
        timestamp: new Date().toISOString(),
        sources: data.sources
      }]);

    } catch (err: any) {
      console.error('Chat Error:', err);
      showError('Failed to get response. Please try again.');
      // Optionally remove optimistic message or show error state
    } finally {
      setIsSending(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatSessionId(undefined);
    setInputMessage('');
  };

  const renderMessageContent = (text: string) => {
    // Simple markdown link parser
    if (!text) return null;
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        return <Link key={i} to={match[2]} className="text-blue-500 hover:underline">{match[1]}</Link>;
      }
      return part;
    });
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

  const getContextTitle = () => {
    if (documentId) return 'Document Chat';
    if (stepId) return 'Step Chat';
    if (projectId) return 'Project Chat';
    return 'Chat';
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

      {/* Messages */}
      <CardContent className="flex-1 p-0 overflow-hidden relative bg-background/50">
        <ScrollArea className="h-full p-4">
          <div className="space-y-6 pb-4 min-h-[200px]">
            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground px-8">
                <Bot className="h-12 w-12 mb-3 opacity-20" />
                <p>Ask StrategistAI about your project.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex w-full gap-3', msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.sender === 'ai' && (
                  <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                
                <div className={cn(
                  'relative px-4 py-3 rounded-2xl max-w-[85%] shadow-sm text-sm leading-relaxed',
                  msg.sender === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-card border border-border text-card-foreground rounded-tl-sm'
                )}>
                  <div className="whitespace-pre-wrap break-words">
                    {renderMessageContent(msg.text)}
                  </div>
                  {msg.sender === 'ai' && renderSources(msg.sources)}
                  <div className={cn("text-[10px] mt-1 text-right opacity-70")}>
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
            
            {isSending && (
              <div className="flex w-full gap-3 justify-start animate-pulse">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-1">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-card border border-border text-muted-foreground text-sm rounded-tl-sm">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input */}
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