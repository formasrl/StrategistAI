import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MessageCircle,
  Send,
  Loader2,
  Bot,
  User,
  BookOpen,
  ChevronDown,
  Paperclip,
  PlusCircle,
  X,
  History as HistoryIcon,
  Trash2,
  Sparkles,
} from 'lucide-react';
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
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import {
  saveLastActiveChatSession,
  getLastActiveChatSession,
  clearLastActiveChatSession,
} from '@/utils/localStorage';
import ReviewDialog from './ReviewDialog';
import { AiReview } from '@/types/supabase';
import { formatDateTime } from '@/utils/dateUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

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
  uploadedFiles?: string[];
}

interface ChatSession {
  id: string;
  created_at: string;
  updated_at: string;
}

interface AiChatbotProps {
  projectId?: string;
  phaseId?: string;
  stepId?: string;
  documentId?: string;
  // contentToInsert is no longer directly used here, but kept for type compatibility if needed elsewhere
  contentToInsert: string | null; 
  // setContentToInsert is no longer directly used here, but kept for type compatibility if needed elsewhere
  setContentToInsert: (content: string | null) => void; 
  handleAttemptInsertContent?: (content: string) => void; // New prop
}

interface UploadedFile {
  name: string;
  content: string;
}

type TimelineEntry =
  | { kind: 'message'; timestamp: string; data: ChatMessage }
  | { kind: 'review'; timestamp: string; data: AiReview };

const AiChatbot: React.FC<AiChatbotProps> = ({
  projectId,
  phaseId,
  stepId,
  documentId,
  handleAttemptInsertContent, // Destructure new prop
}) => {
  const { session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | undefined>(
    undefined,
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const [availableChatSessions, setAvailableChatSessions] = useState<ChatSession[]>([]);
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | undefined>(
    undefined,
  );
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);
  const [isNewChatActiveForComposition, setIsNewChatActiveForComposition] = useState(false);

  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AiReview | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const timelineEntries: TimelineEntry[] = useMemo(() => {
    const messageEntries: TimelineEntry[] = messages.map((msg) => ({
      kind: 'message',
      timestamp: msg.timestamp,
      data: msg,
    }));

    const reviewEntries: TimelineEntry[] = reviews.map((review) => {
      // Safely handle timestamp. Supabase types might differ from runtime.
      // Force a string or use current time to avoid RangeError on toISOString.
      const reviewAny = review as any;
      const rawTime = review.review_timestamp || reviewAny.created_at;
      let timestamp: string;
      
      if (rawTime) {
        timestamp = rawTime;
      } else {
        timestamp = new Date().toISOString();
      }

      return {
        kind: 'review',
        timestamp,
        data: review,
      };
    });

    return [...messageEntries, ...reviewEntries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [messages, reviews]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [timelineEntries.length, isSending, isGeneratingReview, uploadedFiles.length]);

  const fetchMessagesForSession = useCallback(async (sessionId: string) => {
    const { data: messagesData, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages for session:', messagesError);
      return [];
    }

    return messagesData.map((msg: any) => {
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
        } catch {
          // ignore parsing failures
        }
      }

      let fileNames: string[] = [];
      const fileMatch = msg.content.match(/\(Files?: ([^)]+)\)/);
      if (fileMatch) {
        fileNames = fileMatch[1].split(',').map((s: string) => s.trim());
      } else if (msg.content.match(/^\(File: .+\)/)) {
        const legacyMatch = msg.content.match(/^\(File: (.+?)\)/);
        if (legacyMatch) fileNames = [legacyMatch[1]];
      }

      return {
        id: msg.id,
        sender: msg.role === 'user' ? 'user' : 'ai',
        text: displayContent,
        timestamp: msg.created_at,
        sources: [],
        insertContent,
        uploadedFiles: fileNames.length > 0 ? fileNames : undefined,
      } as ChatMessage;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchSessionsAndHistory = async () => {
      if (!projectId) return;

      if (isMounted) {
        setIsLoadingHistory(true);
        setIsLoadingSessions(true);
        setMessages([]);
        setAvailableChatSessions([]);
        setCurrentChatSessionId(undefined);
        setSelectedChatSessionId(undefined);
        setUploadedFiles([]);
        setIsNewChatActiveForComposition(false);
      }

      try {
        let query = supabase
          .from('chat_sessions')
          .select('id, created_at, updated_at')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false });

        if (documentId) {
          query = query.eq('document_id', documentId);
        } else if (stepId) {
          query = query.eq('step_id', stepId).is('document_id', null);
        } else {
          query = query.is('step_id', null).is('document_id', null);
        }

        const { data: sessionsData, error: sessionsError } = await query;

        if (sessionsError) {
          console.error('Error fetching chat sessions:', sessionsError);
        } else if (sessionsData && isMounted) {
          setAvailableChatSessions(sessionsData);

          let sessionToLoadId: string | undefined;
          const lastActiveChat = getLastActiveChatSession(projectId, stepId, documentId);

          if (lastActiveChat && sessionsData.some((s) => s.id === lastActiveChat)) {
            sessionToLoadId = lastActiveChat;
          } else if (sessionsData.length > 0) {
            sessionToLoadId = sessionsData[0].id;
          }

          if (sessionToLoadId) {
            setSelectedChatSessionId(sessionToLoadId);
            setCurrentChatSessionId(sessionToLoadId);
            saveLastActiveChatSession(projectId, stepId, documentId, sessionToLoadId);
            const loadedMessages = await fetchMessagesForSession(sessionToLoadId);
            if (isMounted) setMessages(loadedMessages);
          } else {
            if (isMounted) setIsNewChatActiveForComposition(true);
          }
        }
      } catch (err) {
        console.error('Failed to initialize chat:', err);
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
          setIsLoadingSessions(false);
        }
      }
    };

    fetchSessionsAndHistory();

    return () => {
      isMounted = false;
    };
  }, [projectId, stepId, documentId, fetchMessagesForSession]);

  useEffect(() => {
    if (!documentId) {
      setReviews([]);
      return;
    }

    const fetchReviews = async () => {
      setIsLoadingReviews(true);
      const { data, error } = await supabase
        .from('ai_reviews')
        .select('*')
        .eq('document_id', documentId)
        .order('review_timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        showError(`Failed to load reviews: ${error.message}`);
        setReviews([]);
      } else {
        setReviews(data || []);
      }
      setIsLoadingReviews(false);
    };

    fetchReviews();
  }, [documentId]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === selectedChatSessionId) return;

      setIsLoadingHistory(true);
      setSelectedChatSessionId(sessionId);
      setCurrentChatSessionId(sessionId);
      setUploadedFiles([]);
      setIsNewChatActiveForComposition(false);
      if (projectId) {
        saveLastActiveChatSession(projectId, stepId, documentId, sessionId);
      }
      const loadedMessages = await fetchMessagesForSession(sessionId);
      setMessages(loadedMessages);
      setIsLoadingHistory(false);
      setIsHistoryCollapsed(true);
    },
    [selectedChatSessionId, projectId, stepId, documentId, fetchMessagesForSession],
  );

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
            if (prev.some((m) => m.id === newMsg.id)) return prev;

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
              } catch {
                // ignore
              }
            }

            let fileNames: string[] = [];
            const fileMatch = newMsg.content.match(/\(Files?: ([^)]+)\)/);
            if (fileMatch) {
              fileNames = fileMatch[1].split(',').map((s: string) => s.trim());
            }

            return [
              ...prev,
              {
                id: newMsg.id,
                sender: newMsg.role === 'user' ? 'user' : 'ai',
                text: displayContent,
                timestamp: newMsg.created_at,
                insertContent,
                uploadedFiles: fileNames.length > 0 ? fileNames : undefined,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChatSessionId]);

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
    setUploadedFiles([]);

    const tempUserMsgId = crypto.randomUUID();
    let userMsgText = text;
    if (currentFiles.length > 0) {
      const fileNames = currentFiles.map((f) => f.name).join(', ');
      userMsgText = `(Files: ${fileNames}) ${text}`;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: tempUserMsgId,
        sender: 'user',
        text: userMsgText,
        timestamp: new Date().toISOString(),
        uploadedFiles: currentFiles.map((f) => f.name),
      },
    ]);

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
            uploadedFiles: currentFiles,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch AI response');
      }

      const data = await response.json();

      if (data.chatSessionId && !currentChatSessionId) {
        setCurrentChatSessionId(data.chatSessionId);
        setSelectedChatSessionId(data.chatSessionId);
        saveLastActiveChatSession(projectId, stepId, documentId, data.chatSessionId);
        setIsNewChatActiveForComposition(false);

        const { data: updatedSessions, error: updateError } = await supabase
          .from('chat_sessions')
          .select('id, created_at, updated_at')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false });

        if (!updateError && updatedSessions) {
          setAvailableChatSessions(updatedSessions);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: data.reply,
          timestamp: new Date().toISOString(),
          sources: data.sources,
          insertContent: data.insertContent,
        },
      ]);
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
    setSelectedChatSessionId(undefined);
    setInputMessage('');
    setUploadedFiles([]);
    setIsHistoryCollapsed(true);
    if (projectId) clearLastActiveChatSession(projectId, stepId, documentId);
    setIsNewChatActiveForComposition(true);
    showSuccess('New chat session started.');
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error: msgErr } = await supabase
        .from('chat_messages')
        .delete()
        .eq('chat_session_id', sessionId);
      if (msgErr) throw msgErr;

      const { error: sessionErr } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);
      if (sessionErr) throw sessionErr;

      setAvailableChatSessions((prev) => prev.filter((s) => s.id !== sessionId));

      if (sessionId === currentChatSessionId) {
        setCurrentChatSessionId(undefined);
        setMessages([]);
        setIsNewChatActiveForComposition(true);
      }
      if (sessionId === selectedChatSessionId) {
        setSelectedChatSessionId(undefined);
      }

      if (projectId) {
        const lastStored = getLastActiveChatSession(projectId, stepId, documentId);
        if (lastStored === sessionId) {
          clearLastActiveChatSession(projectId, stepId, documentId);
        }
      }

      showSuccess('Chat deleted.');
    } catch (error: any) {
      console.error('Failed to delete chat session:', error);
      showError(`Failed to delete chat: ${error.message}`);
    }
  };

  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        return (
          <Link key={i} to={match[2]} className="text-blue-500 hover:underline">
            {match[1]}
          </Link>
        );
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
            <div
              key={i}
              className="rounded bg-background/50 p-2 text-xs border border-border/50"
            >
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
      if (file.size > 1024 * 1024 * 5) {
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
          fileContent =
            new DOMParser().parseFromString(fileContent, 'text/html').body.textContent || '';
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
            const pageText = (textContent.items as any[])
              .map((item) => item.str)
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
      setUploadedFiles((prev) => [...prev, ...newUploadedFiles]);
      showSuccess(`${newUploadedFiles.length} file(s) added.`);
      setIsNewChatActiveForComposition(true);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    if (uploadedFiles.length === 1 && inputMessage.trim().length === 0 && !currentChatSessionId) {
      setIsNewChatActiveForComposition(false);
    }
  };

  const handleUseThisContent = (content: string) => {
    if (!documentId) {
      showError('Please navigate to a document to insert content.');
      return;
    }
    if (handleAttemptInsertContent) {
      handleAttemptInsertContent(content);
    } else {
      showError('Editor is not ready to receive content. Please try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const hasActiveComposer =
    !!currentChatSessionId || inputMessage.trim().length > 0 || uploadedFiles.length > 0 || isNewChatActiveForComposition;

  const handleOpenReview = (review: AiReview) => {
    setSelectedReview(review);
    setIsReviewDialogOpen(true);
  };

  const handleGenerateReview = async () => {
    if (!documentId || !projectId) {
      showError('Open a document to generate a review.');
      return;
    }
    setIsGeneratingReview(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-review', {
        body: { documentId, projectId },
      });

      if (error) throw error;

      const newReview = data.review as AiReview;
      setReviews((prev) => [newReview, ...prev]);
      setSelectedReview(newReview);
      setIsReviewDialogOpen(true);
      showSuccess('AI review generated.');
    } catch (error: any) {
      console.error('Error generating review:', error);
      showError(`Failed to generate review: ${error.message}`);
    } finally {
      setIsGeneratingReview(false);
    }
  };

  const renderReviewEntry = (review: AiReview) => {
    const reviewAny = review as any;
    const displayDate = review.review_timestamp || reviewAny.created_at || new Date().toISOString();
    
    return (
      <div
        key={review.id}
        className="flex w-full gap-3 justify-start"
      >
        <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-300" />
        </div>
        <div className="px-4 py-3 rounded-2xl bg-card border border-border text-card-foreground rounded-tl-sm w-full">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{formatDateTime(displayDate, 'MMM d, yyyy HH:mm')}</span>
            {review.readiness && (
              <Badge variant={review.readiness === 'ready' ? 'default' : 'secondary'}>
                {review.readiness.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
          </div>
          <p className="text-sm mt-1">
            {review.summary || 'No summary available.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => handleOpenReview(review)}
          >
            View Review
          </Button>
        </div>
      </div>
    );
  };

  if (isLoadingHistory || isLoadingReviews) {
    return (
      <Card className="flex flex-col h-full border-none shadow-none bg-transparent">
        <CardContent className="flex-1 flex flex-col justify-center items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          Loading assistant…
        </CardContent>
      </Card>
    );
  }

  const timelineIsEmpty = timelineEntries.length === 0;

  return (
    <Card className="flex flex-col h-full border-none shadow-none bg-transparent">
      <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-500" />
          <span className="truncate">{getContextTitle()}</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGenerateReview}
            disabled={isGeneratingReview || !documentId}
          >
            {isGeneratingReview ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Review
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleNewChat} className="h-8 w-8">
                  <PlusCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Start New Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsHistoryCollapsed((prev) => !prev)}
                  className="h-8 w-8"
                >
                  <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">View Chat History</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden relative bg-background/50">
        <ScrollArea className="h-full p-4">
          <Collapsible
            open={!isHistoryCollapsed}
            onOpenChange={setIsHistoryCollapsed}
            className="mb-4"
          >
            <CollapsibleContent className="space-y-2 animate-accordion-down">
              {isLoadingSessions ? (
                <div className="text-center text-muted-foreground py-4">
                  Loading sessions...
                </div>
              ) : availableChatSessions.length > 0 ? (
                <div className="space-y-2">
                  {availableChatSessions.map((sessionItem) => (
                    <div
                      key={sessionItem.id}
                      className="flex items-center gap-2"
                    >
                      <Button
                        type="button"
                        variant={
                          sessionItem.id === selectedChatSessionId
                            ? 'secondary'
                            : 'ghost'
                        }
                        className="flex-1 justify-start text-sm h-auto py-2 px-3"
                        onClick={() => handleSelectSession(sessionItem.id)}
                      >
                        <HistoryIcon className="h-4 w-4 mr-2 opacity-70" />
                        <span className="flex-1 text-left truncate">
                          Chat from{' '}
                          {new Date(
                            sessionItem.created_at,
                          ).toLocaleString()}
                        </span>
                        {sessionItem.id === selectedChatSessionId && (
                          <Badge variant="outline" className="ml-2">
                            Active
                          </Badge>
                        )}
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteSession(sessionItem.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Delete this chat
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground italic py-4">
                  No past chats for this context.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-6 pb-4 min-h-[200px]">
            {!timelineIsEmpty && timelineEntries.length === reviews.length && (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground px-8">
                <Bot className="h-12 w-12 mb-3 opacity-20" />
                <p>Ask StrategistAI about your project.</p>
                <p className="text-sm mt-2">
                  Upload files (PDF, DOCX, MD) to get analysis or generate a review first.
                </p>
              </div>
            )}

            {timelineIsEmpty && (
              <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground px-8">
                <Bot className="h-12 w-12 mb-3 opacity-20" />
                <p>Start a conversation with StrategistAI about this project.</p>
                <Button onClick={handleNewChat} className="mt-4">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Start New Chat
                </Button>
              </div>
            )}

            {timelineEntries.map((entry) => {
              if (entry.kind === 'review') {
                return renderReviewEntry(entry.data);
              }

              const msg = entry.data;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex w-full gap-3',
                    msg.sender === 'user' ? 'justify-end' : 'justify-start',
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
                        : 'bg-card border border-border text-card-foreground rounded-tl-sm',
                    )}
                  >
                    {msg.uploadedFiles &&
                      msg.uploadedFiles.length > 0 &&
                      msg.sender === 'user' && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.uploadedFiles.map((fileName, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
                            >
                              <Paperclip className="h-3 w-3 mr-1" />
                              {fileName}
                            </Badge>
                          ))}
                        </div>
                      )}

                    <div className="whitespace-pre-wrap break-words">
                      {renderMessageContent(
                        msg.text.replace(/^\(Files: .*?\) /, ''),
                      )}
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
                    <div className="text-[10px] mt-1 text-right opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}

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

      {uploadedFiles.length > 0 && (
        <div className="px-4 py-2 bg-background border-t border-border flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {uploadedFiles.map((file, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[100px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {hasActiveComposer && (
        <CardFooter className="p-4 pt-2 border-t border-border bg-background">
          <form onSubmit={handleSendMessage} className="flex w-full gap-2 items-end">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                handleFileChange(e);
                if (e.target.files && e.target.files.length > 0) {
                  setIsNewChatActiveForComposition(true);
                }
              }}
              style={{ display: 'none' }}
              multiple
              accept=".docx,.html,.md,.txt,.pdf"
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={uploadedFiles.length > 0 ? 'secondary' : 'outline'}
                    size="icon"
                    onClick={handleFileUploadClick}
                    disabled={isSending}
                    className="shrink-0"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span className="sr-only">Attach File</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Attach Files (.docx, .pdf, .html, .md, .txt)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex-1">
              <textarea
                id="tour-ai-chat-input"
                placeholder={
                  uploadedFiles.length > 0
                    ? `Ask about ${uploadedFiles.length} file(s) or type message...`
                    : 'Ask a question... (Enter = send, Shift+Enter = new line)'
                }
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  if (e.target.value.trim().length > 0) {
                    setIsNewChatActiveForComposition(true);
                  } else if (uploadedFiles.length === 0 && !currentChatSessionId) {
                    setIsNewChatActiveForComposition(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                className="w-full min-h-[40px] max-h-32 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <Button
              type="submit"
              size="icon"
              disabled={
                (!inputMessage.trim() && uploadedFiles.length === 0) || isSending
              }
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </CardFooter>
      )}

      {selectedReview && (
        <ReviewDialog
          isOpen={isReviewDialogOpen}
          onClose={() => setIsReviewDialogOpen(false)}
          review={selectedReview}
        />
      )}
    </Card>
  );
};

export default AiChatbot;