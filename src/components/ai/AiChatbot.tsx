import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Loader2, Bot, User, ChevronDown, ChevronUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { ChatMessage as DBChatMessage } from '@/types/supabase'; // Import DB ChatMessage type
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

interface SourceAttribution {
  document_name: string;
  chunk_preview: string;
  relevance_score: number;
}

interface ChatMessageDisplay {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  sources?: SourceAttribution[]; // New: Optional sources array
}

interface AiChatbotProps {
  projectId?: string;
  phaseId?: string;
  stepId?: string;
  documentId?: string;
  chatSessionId?: string;
  setChatSessionId: (id: string | undefined) => void;
}

const AiChatbot: React.FC<AiChatbotProps> = ({
  projectId,
  phaseId,
  stepId,
  documentId,
  chatSessionId,
  setChatSessionId,
}) => {
  const [messages, setMessages] = useState<ChatMessageDisplay[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Effect to fetch messages when chatSessionId changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!chatSessionId) {
        setMessages([]);
        return;
      }

      setIsLoadingMessages(true);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('chat_session_id', chatSessionId)
        .order('created_at', { ascending: true });

      if (error) {
        showError(`Failed to load chat history: ${error.message}`);
        setMessages([]);
      } else {
        setMessages(
          (data || []).map((msg) => ({
            id: msg.id,
            sender: msg.role === 'assistant' ? 'ai' : 'user',
            text: msg.content,
            timestamp: msg.created_at,
            // Sources are not stored in chat_messages table, so they won't be reloaded here.
            // They are only available in the immediate response from the edge function.
          }))
        );
      }
      setIsLoadingMessages(false);
    };

    fetchMessages();
  }, [chatSessionId]);

  useEffect(scrollToBottom, [messages, isLoadingMessages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    if (!projectId || !stepId) {
      showError('Select a project and step to chat with StrategistAI.');
      return;
    }

    const userMessageText = inputMessage.trim();
    const userMessageDisplay: ChatMessageDisplay = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMessageText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessageDisplay]);
    setInputMessage('');
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-ai-assistant', {
        body: {
          message: userMessageText,
          projectId,
          stepId,
          documentId,
          chatSessionId, // Pass existing session ID or null
        },
      });

      if (error) {
        showError(`AI Chatbot error: ${error.message}`);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: 'Sorry, I encountered an error. Please try again later.',
            timestamp: new Date().toISOString(),
          },
        ]);
      } else if (data?.answer) { // Changed from data?.response to data?.answer
        // If a new session was created, update the state
        if (data.chatSessionId && data.chatSessionId !== chatSessionId) {
          setChatSessionId(data.chatSessionId);
        }
        
        // Add the AI response with sources
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: data.answer,
            timestamp: new Date().toISOString(),
            sources: data.sources || [], // Include sources from the response
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: 'I did not receive a response from the AI assistant.',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err: any) {
      console.error('Error invoking chat-ai-assistant:', err);
      showError(`An unexpected error occurred: ${err.message}`);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: 'Sorry, I encountered an unexpected error. Please try again later.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const getContextTitle = () => {
    if (documentId) return 'Document Chat';
    if (stepId) return 'Step Chat';
    if (phaseId) return 'Phase Chat';
    if (projectId) return 'Project Chat';
    return 'General Chat';
  };

  return (
    <Card className="flex flex-col h-full border-none shadow-none bg-transparent">
      <CardHeader className="p-4 pb-2 border-b border-border">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-500" /> AI Chatbot ({getContextTitle()})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-4 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          <div className="space-y-4">
            {isLoadingMessages ? (
              <div className="text-center text-muted-foreground italic py-4">
                <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Loading chat history...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground italic py-4">
                Start a conversation with your AI Brand Strategist!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender === 'ai' && (
                      <Bot className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] p-3 rounded-lg',
                        msg.sender === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-none'
                          : 'bg-muted text-muted-foreground rounded-bl-none',
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <span className="block text-xs opacity-70 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.sender === 'user' && (
                      <User className="h-6 w-6 text-gray-500 flex-shrink-0 mt-1" />
                    )}
                  </div>
                  {msg.sender === 'ai' && msg.sources && msg.sources.length > 0 && (
                    <Collapsible className="w-[80%] mt-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground hover:text-foreground">
                          <span className="flex items-center gap-1">
                            {msg.sources.length} Source{msg.sources.length > 1 ? 's' : ''}
                            <ChevronDown className="h-3 w-3 ml-1 data-[state=open]:rotate-180 transition-transform duration-200" />
                          </span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 p-2 border-t border-border bg-muted/50 rounded-b-lg">
                        {msg.sources.map((source, index) => (
                          <Card key={index} className="p-3 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold">{source.document_name}</span>
                              <Badge variant="secondary" className="text-[0.6rem] px-2 py-0.5">
                                Relevance: {source.relevance_score}%
                              </Badge>
                            </div>
                            <p className="text-muted-foreground line-clamp-3">{source.chunk_preview}</p>
                          </Card>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              ))
            )}
            {isSending && (
              <div className="flex items-start gap-3 justify-start">
                <Bot className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                <div className="max-w-[80%] p-3 rounded-lg bg-muted text-muted-foreground rounded-bl-none">
                  <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                  <span className="text-sm">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 pt-2 border-t border-border">
        <form onSubmit={handleSendMessage} className="flex w-full space-x-2">
          <Input
            placeholder="Ask your AI assistant..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending || isLoadingMessages}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!inputMessage.trim() || isSending || isLoadingMessages}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default AiChatbot;