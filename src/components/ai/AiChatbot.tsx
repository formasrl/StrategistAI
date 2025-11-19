import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Loader2, Bot, User, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
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
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const renderMessageContent = useCallback((text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, linkText, linkPath] = match;
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        <Link key={match.index} to={linkPath} className="text-blue-400 hover:underline">
          {linkText}
        </Link>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <>{parts}</>;
  }, []);

  const sendToAiAssistant = async (userMessageText: string) => {
    if (!session?.access_token) {
      showError('Authentication session missing. Please refresh.');
      return;
    }

    const aiPlaceholderMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: '',
      timestamp: new Date().toISOString(),
      sources: [],
    };
    setMessages((prev) => [...prev, aiPlaceholderMessage]);

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
          }),
        },
      );

      if (!response.ok || !response.body) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let aiResponseSources: ChatSource[] = [];
      let newChatSessionId: string | undefined = currentChatSessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            try {
              const json = JSON.parse(data);
              if (json.type === 'token') {
                accumulatedContent += json.content;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiPlaceholderMessage.id
                      ? { ...msg, text: accumulatedContent }
                      : msg,
                  ),
                );
              } else if (json.type === 'sources') {
                aiResponseSources = json.content;
                newChatSessionId = json.chatSessionId;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiPlaceholderMessage.id
                      ? { ...msg, sources: aiResponseSources }
                      : msg,
                  ),
                );
              } else if (json.type === 'error') {
                showError(`AI Chatbot error: ${json.content}`);
                accumulatedContent += `\n\nError: ${json.content}`;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiPlaceholderMessage.id
                      ? { ...msg, text: accumulatedContent }
                      : msg,
                  ),
                );
              }
            } catch (e) {
              console.error('Error parsing stream chunk:', e, data);
            }
          }
        }
      }
      setCurrentChatSessionId(newChatSessionId);
    } catch (err: any) {
      console.error('Error invoking chat-ai-assistant:', err);
      showError(`An unexpected error occurred: ${err.message}`);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiPlaceholderMessage.id
            ? {
                ...msg,
                text:
                  accumulatedContent ||
                  'Sorry, I encountered an unexpected error. Please try again later.',
              }
            : msg,
        ),
      );
    }
  };

  const handleProjectLevelChat = async (query: string) => {
    const aiResponseId = (Date.now() + 1).toString();
    let aiResponseText = "I noticed you're asking a question without a specific document or step selected. Selecting a document gives better answers as it provides more context for me to assist you effectively.";

    const { data: allSteps, error: stepsError } = await supabase
      .from('steps')
      .select('id, step_name, description, phase_id')
      .eq('project_id', projectId);

    if (stepsError) {
      console.error("Error fetching steps for suggestions:", stepsError);
      aiResponseText += "\n\nHowever, I couldn't fetch relevant steps at this moment. Please try again later.";
    } else if (allSteps && allSteps.length > 0) {
      const lowerCaseQuery = query.toLowerCase();
      const suggestedSteps = allSteps.filter(step =>
        step.step_name?.toLowerCase().includes(lowerCaseQuery) ||
        step.description?.toLowerCase().includes(lowerCaseQuery)
      ).slice(0, 3);

      if (suggestedSteps.length > 0) {
        aiResponseText += "\n\nPerhaps you're looking for one of these steps? Click on a step to navigate to its workspace:";
        suggestedSteps.forEach(step => {
          aiResponseText += `\n- [${step.step_name}](/dashboard/${projectId}/step/${step.id})`;
        });
      } else {
        aiResponseText += "\n\nI couldn't find any steps directly related to your query. Please try rephrasing or select a step from the roadmap.";
      }
    } else {
      aiResponseText += "\n\nThere are no steps defined for this project yet. Please create some steps first.";
    }

    const aiMessage: ChatMessage = {
      id: aiResponseId,
      sender: 'ai',
      text: aiResponseText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMessage]);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || isSending) return;

    if (!projectId) {
      showError('Select a project to chat with StrategistAI.');
      return;
    }

    const userMessageText = inputMessage.trim();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMessageText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);

    if (!stepId && !documentId) {
      await handleProjectLevelChat(userMessageText);
    } else {
      await sendToAiAssistant(userMessageText);
    }
    setIsSending(false);
  };

  const getContextTitle = () => {
    if (documentId) return 'Document Chat';
    if (stepId) return 'Step Chat';
    if (phaseId) return 'Phase Chat';
    if (projectId) return 'Project Chat';
    return 'General Chat';
  };

  const renderSources = (sources?: ChatSource[]) => {
    if (!sources || sources.length === 0) return null;

    return (
      <Collapsible className="mt-2 border-t border-border pt-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="h-3 w-3" />
            Sources
            <ChevronDown className="h-3 w-3 data-[state=open]:hidden" />
            <ChevronUp className="h-3 w-3 hidden data-[state=open]:block" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {sources.map((source, index) => (
            <div
              key={`${source.document_name}-${index}`}
              className="rounded-md bg-muted/60 p-2 text-xs"
            >
              <div className="font-semibold text-foreground">
                {source.document_name || 'Untitled Document'}
              </div>
              <div className="text-muted-foreground mt-1">
                {source.chunk_preview}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground/80">
                Relevance score: {source.relevance_score.toFixed(2)}
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
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
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground italic py-4">
                Start a conversation with your AI Brand Strategist!
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-start gap-3',
                  msg.sender === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
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
                  <p className="text-sm whitespace-pre-wrap">{renderMessageContent(msg.text)}</p>
                  <span className="block text-xs opacity-70 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.sender === 'ai' && renderSources(msg.sources)}
                </div>
                {msg.sender === 'user' && (
                  <User className="h-6 w-6 text-gray-500 flex-shrink-0 mt-1" />
                )}
              </div>
            ))}
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
            id="tour-ai-chat-input"
            placeholder="Ask your AI assistant..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!inputMessage.trim() || isSending}>
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