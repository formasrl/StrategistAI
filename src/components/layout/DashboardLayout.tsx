import React from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PanelLeft, PanelRight, MessageSquare } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  mainContent: React.ReactNode;
  aiPanel: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, mainContent, aiPanel }) => {
  return (
    <div className="h-screen w-full flex flex-col rounded-lg border bg-background text-foreground">
      {/* Header / Toggle Bar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-background shrink-0">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" title="Toggle Sidebar" className="lg:hidden">
              <PanelLeft className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 sm:w-96 flex flex-col">
            <aside className="h-full p-4 bg-sidebar border-r border-border flex flex-col overflow-hidden">
              {sidebar}
            </aside>
          </SheetContent>
        </Sheet>

        <div className="hidden lg:block font-semibold px-2">
          {/* Placeholder for breadcrumbs or title if needed */}
        </div>

        {/* Mobile AI Chat Toggle */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" title="Toggle AI Chat" className="lg:hidden">
              <MessageSquare className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-80 sm:w-96 flex flex-col pt-10">
            <aside className="h-full p-4 bg-sidebar border-l border-border flex flex-col overflow-hidden">
              {aiPanel}
            </aside>
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Main content area managed by ResizablePanelGroup */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 w-full"
      >
        {/* Left Sidebar (Desktop) */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={25} className="hidden lg:block">
          <aside className="h-full p-4 bg-sidebar border-r border-border flex flex-col overflow-hidden">
            {sidebar}
          </aside>
        </ResizablePanel>
        
        <ResizableHandle withHandle className="hidden lg:flex" />

        {/* Central Content */}
        <ResizablePanel defaultSize={55} minSize={40}>
          <main className="h-full p-4 overflow-y-auto bg-background">
            {mainContent}
          </main>
        </ResizablePanel>
        
        <ResizableHandle withHandle className="hidden lg:flex" />

        {/* Right Sidebar (AI Panel) (Desktop) */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="hidden lg:block">
          <aside className="h-full p-4 bg-sidebar border-l border-border flex flex-col">
            {aiPanel}
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DashboardLayout;