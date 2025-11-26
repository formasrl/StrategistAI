import React from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"; // New import for overlay sidebar

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  mainContent: React.ReactNode;
  aiPanel: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, mainContent, aiPanel }) => {
  return (
    <div className="h-screen w-full flex flex-col rounded-lg border bg-background text-foreground"> {/* Outer container with border/bg */}
      {/* Header / Toggle Bar */}
      <div className="flex items-center p-2 border-b border-border bg-background shrink-0">
        <Sheet> {/* Wrap Sheet around the trigger and content */}
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" title="Toggle Sidebar">
              <PanelLeft className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 sm:w-96 flex flex-col"> {/* Adjust width as needed */}
            <aside className="h-full p-4 bg-sidebar border-r border-border flex flex-col overflow-hidden">
              {sidebar}
            </aside>
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Main content area managed by ResizablePanelGroup */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 w-full" // flex-1 to take remaining height, no border/bg here
      >
        {/* Central Content (2/3 width) */}
        <ResizablePanel defaultSize={66.66} minSize={40}>
          <main className="h-full p-4 overflow-y-auto">
            {mainContent}
          </main>
        </ResizablePanel>
        
        <ResizableHandle withHandle className="hidden md:flex" /> {/* Keep handle for central/right */}

        {/* Right Sidebar (AI Panel) (1/3 width) */}
        <ResizablePanel defaultSize={33.33} minSize={20} className="hidden md:block">
          <aside className="h-full p-4 bg-sidebar border-l border-border flex flex-col">
            {aiPanel}
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DashboardLayout;