"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AiChatbot from './AiChatbot';
import { AiReview } from '@/types/supabase';
import { Brain, MessageCircle } from 'lucide-react';
import AiPanelContent from './AiPanelContent';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea

interface AiPanelProps {
  projectId?: string;
  phaseId?: string; // Changed from number to string | undefined
  stepId?: string;  // Changed from number to string | undefined
  documentId?: string;
  aiReview: AiReview | null;
  isAiReviewLoading: boolean;
  onGenerateReview: (docId: string) => void;
}

const AiPanel: React.FC<AiPanelProps> = ({
  projectId,
  phaseId,
  stepId,
  documentId,
  aiReview,
  isAiReviewLoading,
  onGenerateReview,
}) => {
  return (
    <Tabs defaultValue="chat" className="h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="chat" className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> Chat
        </TabsTrigger>
        <TabsTrigger value="review" className="flex items-center gap-2" disabled={!documentId}>
          <Brain className="h-4 w-4" /> Review
        </TabsTrigger>
      </TabsList>
      <TabsContent value="chat" className="flex-1 mt-0 data-[state=inactive]:hidden">
        <AiChatbot
          projectId={projectId}
          phaseId={phaseId}
          stepId={stepId}
          documentId={documentId}
        />
      </TabsContent>
      <TabsContent value="review" className="flex-1 mt-0 data-[state=inactive]:hidden">
        <ScrollArea className="h-full pr-2"> {/* Wrap AiPanelContent in ScrollArea */}
          <AiPanelContent
            documentId={documentId}
            aiReview={aiReview}
            isAiReviewLoading={isAiReviewLoading}
            onGenerateReview={onGenerateReview}
          />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};

export default AiPanel;