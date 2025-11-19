import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface OnboardingTourProps {
  runTour: boolean;
  onTourComplete: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ runTour, onTourComplete }) => {
  const { theme } = useTheme();
  const [tourSteps, setTourSteps] = useState<Step[]>([]);
  const [tourKey, setTourKey] = useState(0);

  useEffect(() => {
    const steps: Step[] = [
      {
        target: '.tour-phase-card',
        content: (
          <div>
            <h3 className="font-bold text-lg mb-2">Phases & Steps</h3>
            <p>Your brand strategy is broken down into manageable phases and steps. Click on a phase to expand its steps.</p>
          </div>
        ),
        placement: 'right',
        disableBeacon: true,
        locale: { last: 'Got it!' },
      },
      {
        target: '#tour-upload-document',
        content: (
          <div>
            <h3 className="font-bold text-lg mb-2">Upload Documents</h3>
            <p>Easily upload existing documents (DOCX, HTML, Markdown) or start writing directly in the editor.</p>
          </div>
        ),
        placement: 'left',
        locale: { last: 'Got it!' },
      },
      {
        target: '#tour-ai-chat-input',
        content: (
          <div>
            <h3 className="font-bold text-lg mb-2">Ask AI Questions</h3>
            <p>Chat with your AI Brand Strategist for guidance, feedback, or to brainstorm ideas. The AI uses your project context for better answers.</p>
          </div>
        ),
        placement: 'left',
        locale: { last: 'Got it!' },
      },
      {
        target: '#tour-generate-review',
        content: (
          <div>
            <h3 className="font-bold text-lg mb-2">Get AI Reviews</h3>
            <p>Generate AI-powered reviews for your documents to get insights on strengths, issues, and suggestions for improvement.</p>
          </div>
        ),
        placement: 'left',
        locale: { last: 'Got it!' },
      },
      {
        target: '#tour-ai-memory',
        content: (
          <div>
            <h3 className="font-bold text-lg mb-2">How AI Memory Works</h3>
            <p>When you "Publish" a document, its key decisions and summaries are added to the AI's memory, allowing it to provide more consistent and relevant advice across your project.</p>
          </div>
        ),
        placement: 'right',
        locale: { last: 'Got it!' },
      },
    ];
    setTourSteps(steps);
    setTourKey(prev => prev + 1);
  }, [theme]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      onTourComplete();
    }
  };

  return (
    <Joyride
      key={tourKey}
      run={runTour}
      steps={tourSteps}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: 'hsl(var(--primary))',
          arrowColor: theme === 'dark' ? 'hsl(var(--card))' : 'hsl(var(--background))',
        },
        tooltip: {
          backgroundColor: theme === 'dark' ? 'hsl(var(--card))' : 'hsl(var(--background))',
          color: theme === 'dark' ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
        buttonClose: {
          color: theme === 'dark' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground))',
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
        },
        buttonBack: {
          color: 'hsl(var(--primary))',
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
    />
  );
};

export default OnboardingTour;