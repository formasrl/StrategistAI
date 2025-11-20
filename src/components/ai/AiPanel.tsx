"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AiChatbot from './AiChatbot';
import { AiReview } from '@/types/supabase';
import { Brain, MessageCircle } from 'lucide-react';
import AiPanelContent from './AiPanelContent';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AiPanelProps {
  projectId?: string;
  phaseId?: string;
  stepId?: string;
  documentId?: string;
  // Making these optional as we are moving logic to AiPanelContent
  aiReview?: AiReview | null;
  isAiReviewLoading?: boolean;
  onGenerateReview?: (docId: string) => void;
}

const AiPanel: React.FC<AiPanelProps> = ({
  projectId,
  phaseId,
  stepId,
  documentId,
}) => {
  return (
    <Tabs defaultValue="chat" className="flex h-full min-h-0 flex-col">
      <TabsList className="grid w-full grid-cols-2 shrink-0">
        <TabsTrigger value="chat" className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> Chat
        </TabsTrigger>
        <TabsTrigger value="review" className="flex items-center gap-2">
          <Brain className="h-4 w-4" /> Review
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="chat"
        className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
      >
        <AiChatbot projectId={projectId} phaseId={phaseId} stepId={stepId} documentId={documentId} />
      </TabsContent>
      <TabsContent
        value="review"
        className="mt-0 flex h-full min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
      >
        <ScrollArea className="flex-1 pr-2">
          <AiPanelContent
            documentId={documentId}
            projectId={projectId}
          />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};

export default AiPanel;