import React from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  mainContent: React.ReactNode;
  aiPanel: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, mainContent, aiPanel }) => {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen w-full rounded-lg border bg-background text-foreground"
    >
      {/* Left Sidebar (Roadmap Navigation) */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="hidden md:block">
        <aside className="h-full p-4 bg-sidebar border-r border-border flex flex-col">
          {sidebar}
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle className="hidden md:flex" />

      {/* Center Content (Document Editor) */}
      <ResizablePanel defaultSize={60} minSize={40}>
        <main className="h-full p-4 overflow-y-auto">
          {mainContent}
        </main>
      </ResizablePanel>
      <ResizableHandle withHandle className="hidden md:flex" />

      {/* Right Sidebar (AI Panel) */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="hidden md:block">
        <aside className="h-full p-4 bg-sidebar border-l border-border flex flex-col">
          {aiPanel}
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default DashboardLayout;