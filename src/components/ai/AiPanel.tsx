import React from 'react';
import AiChatbot from './AiChatbot';

interface AiPanelProps {
  projectId?: string;
  phaseId?: string;
  stepId?: string;
  documentId?: string;
  contentToInsert: string | null;
  setContentToInsert: (content: string | null) => void;
}

const AiPanel: React.FC<AiPanelProps> = ({
  projectId,
  phaseId,
  stepId,
  documentId,
  contentToInsert,
  setContentToInsert,
}) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AiChatbot
        projectId={projectId}
        phaseId={phaseId}
        stepId={stepId}
        documentId={documentId}
        contentToInsert={contentToInsert}
        setContentToInsert={setContentToInsert}
      />
    </div>
  );
};

export default AiPanel;