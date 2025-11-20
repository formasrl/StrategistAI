import React, { useRef, useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  mainContent: React.ReactNode;
  aiPanel: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, mainContent, aiPanel }) => {
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const toggleSidebar = () => {
    const sidebar = sidebarRef.current;
    if (sidebar) {
      if (isSidebarCollapsed) {
        sidebar.resize(20);
        setIsSidebarCollapsed(false);
      } else {
        sidebar.collapse();
        setIsSidebarCollapsed(true);
      }
    }
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen w-full rounded-lg border bg-background text-foreground"
    >
      {/* Left Sidebar (Roadmap Navigation) */}
      <ResizablePanel
        ref={sidebarRef}
        defaultSize={0}
        collapsedSize={0}
        collapsible={true}
        minSize={15}
        maxSize={30}
        onCollapse={() => setIsSidebarCollapsed(true)}
        onExpand={() => setIsSidebarCollapsed(false)}
      >
        <aside className="h-full p-4 bg-sidebar border-r border-border flex flex-col overflow-hidden">
          {sidebar}
        </aside>
      </ResizablePanel>
      
      <ResizableHandle withHandle={!isSidebarCollapsed} />

      {/* Center Content */}
      <ResizablePanel defaultSize={80} minSize={40}>
        <div className="h-full flex flex-col">
          {/* Header / Toggle Bar */}
          <div className="flex items-center p-2 border-b border-border bg-background shrink-0">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} title="Toggle Sidebar">
              <PanelLeft className="h-5 w-5" />
            </Button>
          </div>
          
          <main className="flex-1 p-4 overflow-y-auto">
            {mainContent}
          </main>
        </div>
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