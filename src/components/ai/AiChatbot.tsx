import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Loader2, Bot, User, BookOpen, RefreshCw, ChevronDown, Paperclip, PlusCircle, X } from 'lucide-react';
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
import { Badge } from "@/components/ui/badge";

import mammoth from 'mammoth'; // For .docx
// pdfjs-dist import
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source explicitly to 4.4.168 CDN version to match package.json
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

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
  insertContent?: string;
  uploadedFileName?: string; // Keeping for backward compatibility
  uploadedFiles?: string[]; // New: array of file names
}

interface AiChatbotProps {
  projectId?: string;
  phaseId?: string;
  stepId?: string;
  documentId?: string;
  contentToInsert: string | null;
  setContentToInsert: (content: string | null) => void;
}

interface UploadedFile {
  name: string;
  content: string;
}

const AiChatbot: React.FC<AiChatbotProps> = ({ projectId, phaseId, stepId, documentId, setContentToInsert }) => {
  const { session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | undefined>(undefined);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, isSending, uploadedFiles]);

  // 2. Fetch History & Determine Session ID
  useEffect(() => {
    let isMounted = true;

    const fetchHistory = async () => {
      if (!projectId) return;
      
      if (isMounted) {
        setIsLoadingHistory(true);
        setMessages([]);
        setCurrentChatSessionId(undefined);
        setUploadedFiles([]);
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

              // Heuristic to find file names in old messages (backward compat)
              let fileNames: string[] = [];
              const fileMatch = msg.content.match(/\(Files?: ([^)]+)\)/);
              if (fileMatch) {
                fileNames = fileMatch[1].split(',').map(s => s.trim());
              } else if (msg.content.match(/^\(File: .+\)/)) {
                 // Legacy format check
                 const legacyMatch = msg.content.match(/^\(File: (.+?)\)/);
                 if (legacyMatch) fileNames = [legacyMatch[1]];
              }

              return {
                id: msg.id,
                sender: msg.role === 'user' ? 'user' : 'ai',
                text: displayContent,
                timestamp: msg.created_at,
                sources: [], 
                insertContent: insertContent,
                uploadedFiles: fileNames.length > 0 ? fileNames : undefined,
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

  // 3. Realtime Subscription
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
            if (prev.some(m => m.id === newMsg.id)) return prev;

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

            // Parse files for display
            let fileNames: string[] = [];
            const fileMatch = newMsg.content.match(/\(Files?: ([^)]+)\)/);
            if (fileMatch) {
                fileNames = fileMatch[1].split(',').map((s: string) => s.trim());
            }

            return [...prev, {
              id: newMsg.id,
              sender: newMsg.role === 'user' ? 'user' : 'ai',
              text: displayContent,
              timestamp: newMsg.created_at,
              insertContent: insertContent,
              uploadedFiles: fileNames.length > 0 ? fileNames : undefined,
            }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChatSessionId]);

  // 4. Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputMessage.trim();
    if (!text && uploadedFiles.length === 0) return;
    if (isSending) return;

    if (!projectId) {
      showError('Select a project to chat.');
      return;
    }

    setInputMessage('');
    setIsSending(true);

    const currentFiles = [...uploadedFiles];
    // Clear files immediately from UI for next message
    setUploadedFiles([]);

    const tempUserMsgId = crypto.randomUUID();
    let userMsgText = text;
    if (currentFiles.length > 0) {
      const fileNames = currentFiles.map(f => f.name).join(', ');
      userMsgText = `(Files: ${fileNames}) ${text}`;
    }

    setMessages(prev => [...prev, {
      id: tempUserMsgId,
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toISOString(),
      uploadedFiles: currentFiles.map(f => f.name),
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
            stream: false,
            uploadedFiles: currentFiles, // Send array of files
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch AI response');
      }

      const data = await response.json();
      
      if (data.chatSessionId && !currentChatSessionId) {
        setCurrentChatSessionId(data.chatSessionId);
      }

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: data.reply,
        timestamp: new Date().toISOString(),
        sources: data.sources,
        insertContent: data.insertContent,
      }]);

    } catch (err: any) {
      console.error('Chat Error:', err);
      showError('Failed to get response. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatSessionId(undefined);
    setInputMessage('');
    setUploadedFiles([]);
  };

  const renderMessageContent = (text: string) => {
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

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newUploadedFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 1024 * 1024 * 5) { // 5MB limit per file
        showError(`File "${file.name}" exceeds 5MB limit and was skipped.`);
        continue;
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
          fileContent = new DOMParser().parseFromString(fileContent, 'text/html').body.textContent || '';
        } else if (fileExtension === 'md' || fileExtension === 'txt') {
          fileContent = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsText(file);
          });
        } else if (fileExtension === 'pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          
          let fullText = '';
          const maxPages = Math.min(pdf.numPages, 10); 
          
          for (let p = 1; p <= maxPages; p++) {
            const page = await pdf.getPage(p);
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
          showError(`Unsupported file type: ${file.name}`);
          continue;
        }

        newUploadedFiles.push({ name: file.name, content: fileContent });
      } catch (error: any) {
        console.error(`Error processing ${file.name}:`, error);
        showError(`Failed to process ${file.name}: ${error.message}`);
      }
    }

    if (newUploadedFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
      showSuccess(`${newUploadedFiles.length} file(s) added.`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
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

      <CardContent className="flex-1 p-0 overflow-hidden relative bg-background/50">
        <ScrollArea className="h-full p-4">
          <div className="space-y-6 pb-4 min-h-[200px]">
            {!isLoadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground px-8">
                <Bot className="h-12 w-12 mb-3 opacity-20" />
                <p>Ask StrategistAI about your project.</p>
                <p className="text-sm mt-2">Upload files (PDF, DOCX, MD) to get analysis.</p>
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
                  {/* Display attached files if any */}
                  {msg.uploadedFiles && msg.uploadedFiles.length > 0 && msg.sender === 'user' && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.uploadedFiles.map((fileName, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0">
                          <Paperclip className="h-3 w-3 mr-1" />
                          {fileName}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="whitespace-pre-wrap break-words">
                    {renderMessageContent(msg.text.replace(/^\(Files: .*?\) /, ''))}
                  </div>
                  
                  {msg.sender === 'ai' && msg.insertContent && documentId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2 w-full bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
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

      {/* File List Preview */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-2 bg-background border-t border-border flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {uploadedFiles.map((file, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[100px] truncate">{file.name}</span>
              <button onClick={() => handleRemoveFile(index)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <CardFooter className="p-4 pt-2 border-t border-border bg-background">
        <form onSubmit={handleSendMessage} className="flex w-full gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            multiple // Enable multiple file selection
            accept=".docx,.html,.md,.txt,.pdf"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={uploadedFiles.length > 0 ? "secondary" : "outline"}
                  size="icon"
                  onClick={handleFileUploadClick}
                  disabled={isSending}
                  className="shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="sr-only">Attach File</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach Files (.docx, .pdf, .html, .md, .txt)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Input
            id="tour-ai-chat-input"
            placeholder={uploadedFiles.length > 0 ? `Ask about ${uploadedFiles.length} file(s) or type message...` : "Ask a question..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isSending}
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={(!inputMessage.trim() && uploadedFiles.length === 0) || isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default AiChatbot;