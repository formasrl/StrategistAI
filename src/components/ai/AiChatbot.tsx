import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Loader2, Bot, User, BookOpen, RefreshCw, ChevronDown, Paperclip, PlusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/SessionContextProvider';
import { showError, showSuccess } from '@/utils/toast';
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

import mammoth from 'mammoth'; // For .docx
// pdfjs-dist import
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source - utilizing a CDN for simplicity in this environment to avoid build config issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

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
  insertContent?: string; // New: content AI wants to insert into editor
  uploadedFileName?: string; // New: name of file uploaded by user
}

interface AiChatbotProps {
  projectId?: string;
  phaseId?: string;
  stepId?: string;
  documentId?: string;
  contentToInsert: string | null;
  setContentToInsert: (content: string | null) => void;
}

const AiChatbot: React.FC<AiChatbotProps> = ({ projectId, phaseId, stepId, documentId, setContentToInsert }) => {
  const { session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | undefined>(undefined);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null); // New state for uploaded file

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

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
        setUploadedFile(null); // Clear uploaded file on context change
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
            setMessages(messagesData.map(msg => {
              // Attempt to parse insertContent from historic messages
              let insertContent: string | undefined;
              let displayContent = msg.content || '';
              const jsonBlockMatch = displayContent.match(/```json\n?({[\s\S]*?})\n?```/);
              if (jsonBlockMatch && jsonBlockMatch[1]) {
                try {
                  const parsed = JSON.parse(jsonBlockMatch[1]);
                  if (typeof parsed.insert_content === 'string') {
                    insertContent = parsed.insert_content;
                    displayContent = displayContent.replace(jsonBlockMatch[0], '').trim();
                  }
                } catch (e) {
                  // ignore parsing error
                }
              }

              return {
                id: msg.id,
                sender: msg.role === 'user' ? 'user' : 'ai',
                text: displayContent,
                timestamp: msg.created_at,
                sources: [], 
                insertContent: insertContent,
              };
            }));
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

            // Parse for insert_content from the full message content
            let insertContent: string | undefined;
            let displayContent = newMsg.content;
            const jsonBlockMatch = newMsg.content.match(/```json\n?({[\s\S]*?})\n?```/);
            if (jsonBlockMatch && jsonBlockMatch[1]) {
              try {
                const parsed = JSON.parse(jsonBlockMatch[1]);
                if (typeof parsed.insert_content === 'string') {
                  insertContent = parsed.insert_content;
                  displayContent = newMsg.content.replace(jsonBlockMatch[0], '').trim();
                }
              } catch (e) {
                console.error("Failed to parse insert_content JSON block from realtime message:", e);
              }
            }

            return [...prev, {
              id: newMsg.id,
              sender: newMsg.role === 'user' ? 'user' : 'ai',
              text: displayContent,
              timestamp: newMsg.created_at,
              insertContent: insertContent,
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
    if (!text && !uploadedFile) return; // Allow sending only file
    if (isSending) return;

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
      text: uploadedFile ? `(File: ${uploadedFile.name}) ${text}` : text,
      timestamp: new Date().toISOString(),
      uploadedFileName: uploadedFile?.name,
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
            uploadedFileContent: uploadedFile?.content, // New: Pass uploaded file content
            uploadedFileName: uploadedFile?.name, // New: Pass uploaded file name
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
        sources: data.sources,
        insertContent: data.insertContent, // New: Store content for insertion
      }]);

    } catch (err: any) {
      console.error('Chat Error:', err);
      showError('Failed to get response. Please try again.');
      // Optionally remove optimistic message or show error state
    } finally {
      setIsSending(false);
      setUploadedFile(null); // Clear uploaded file after sending
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatSessionId(undefined);
    setInputMessage('');
    setUploadedFile(null); // Clear uploaded file on new chat
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

  // File upload handlers
  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 10) { // 10MB limit
      showError('File size exceeds 10MB limit.');
      return;
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    let fileContent = '';

    try {
      if (fileExtension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fileContent = result.value;
      } else if (fileExtension === 'html') {
        fileContent = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
        // Strip tags for chat context, or keep structural tags? 
        // For the chat model to understand, raw text is usually best, but simple HTML is okay.
        // Let's strip tags to keep token count low and relevance high.
        fileContent = new DOMParser().parseFromString(fileContent, 'text/html').body.textContent || '';
      } else if (fileExtension === 'md') {
        fileContent = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
      } else if (fileExtension === 'pdf') {
        // PDF Handling
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        // Limit pages to avoid massive token loads
        const maxPages = Math.min(pdf.numPages, 15); 
        
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n\n';
        }
        
        if (pdf.numPages > maxPages) {
          fullText += `\n[...PDF truncated after ${maxPages} pages...]`;
        }
        
        fileContent = fullText;
      } else {
        showError('Unsupported file type. Please upload .docx, .pdf, .html, or .md files.');
        return;
      }

      setUploadedFile({ name: file.name, content: fileContent });
      showSuccess(`File "${file.name}" loaded for chat.`);
    } catch (error: any) {
      console.error('File processing error:', error);
      showError(`Failed to process file: ${error.message}`);
      setUploadedFile(null);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear the file input
      }
    }
  };

  const handleUseThisContent = (content: string) => {
    if (!documentId) {
      showError('Please navigate to a document to insert content.');
      return;
    }
    setContentToInsert(content);
    showSuccess('Content sent to editor. Check the document editor panel!');
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
                <p className="text-sm mt-2">Upload a PDF, DOCX, or MD file to get analysis.</p>
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
                  {msg.uploadedFileName && msg.sender === 'user' && (
                    <div className="flex items-center text-xs text-muted-foreground mb-1">
                      <Paperclip className="h-3 w-3 mr-1" />
                      <span>{msg.uploadedFileName}</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">
                    {renderMessageContent(msg.text)}
                  </div>
                  {msg.sender === 'ai' && msg.insertContent && documentId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => handleUseThisContent(msg.insertContent!)}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Use this in editor
                    </Button>
                  )}
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".docx,.html,.md,.pdf"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleFileUploadClick}
                  disabled={isSending}
                  className="shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="sr-only">Attach File</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach Document (.docx, .pdf, .html, .md)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Input
            id="tour-ai-chat-input"
            placeholder={uploadedFile ? `Ask about "${uploadedFile.name}" or type message...` : "Ask a question..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending}
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={(!inputMessage.trim() && !uploadedFile) || isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default AiChatbot;