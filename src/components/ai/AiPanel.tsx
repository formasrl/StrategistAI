import React from 'react';
import AiChatbot from './AiChatbot';

interface AiPanelProps {
  projectId?: string;
  phaseId?: string;
  stepId?: string;
  documentId?: string;
  contentToInsert: string | null;
  setContentToInsert: (content: string | null) => void;
  handleAttemptInsertContent?: (content: string) => void; // New prop
}

const AiPanel: React.FC<AiPanelProps> = ({
  projectId,
  phaseId,
  stepId,
  documentId,
  contentToInsert,
  setContentToInsert,
  handleAttemptInsertContent, // Destructure new prop
}) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AiChatbot
        projectId={projectId}
        phaseId={phaseId}
        stepId={stepId}
        documentId={documentId}
        contentToInsert={contentToInsert} // Still pass this for now, though its direct use in AiChatbot will change
        setContentToInsert={setContentToInsert} // Still pass this for now
        handleAttemptInsertContent={handleAttemptInsertContent} // Pass the new prop
      />
    </div>
  );
};

export default AiPanel;