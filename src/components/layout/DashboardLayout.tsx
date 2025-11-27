import React, { useRef, useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ImperativePanelHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { 
  PanelLeft, 
  PanelLeftClose, 
  PanelRightClose, 
  MessageSquare,
  PanelRightOpen,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  mainContent: React.ReactNode;
  aiPanel: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, mainContent, aiPanel }) => {
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(true);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const toggleLeftPanel = () => {
    const panel = leftPanelRef.current;
    if (panel) {
      if (isLeftCollapsed) panel.expand();
      else panel.collapse();
    }
  };

  const toggleRightPanel = () => {
    const panel = rightPanelRef.current;
    if (panel) {
      if (isRightCollapsed) panel.expand();
      else panel.collapse();
    }
  };

  return (
    <div className="h-screen w-full flex flex-col rounded-lg border bg-background text-foreground overflow-hidden">
      
      {/* Main content area managed by ResizablePanelGroup */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 w-full h-full"
      >
        {/* Left Sidebar (Desktop) */}
        <ResizablePanel 
          ref={leftPanelRef}
          defaultSize={0} 
          collapsedSize={0}
          collapsible={true}
          minSize={15} 
          maxSize={25} 
          onCollapse={() => setIsLeftCollapsed(true)}
          onExpand={() => setIsLeftCollapsed(false)}
          className="hidden lg:block relative group"
        >
          <aside className="h-full p-4 bg-sidebar border-r border-border flex flex-col overflow-hidden relative">
            {/* Collapse Button (Inside Sidebar) */}
            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={toggleLeftPanel}
                title="Collapse Sidebar"
              >
                <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            {sidebar}
          </aside>
        </ResizablePanel>
        
        <ResizableHandle withHandle className="hidden lg:flex" />

        {/* Central Content */}
        <ResizablePanel defaultSize={75} minSize={40} className="relative flex flex-col">
          
          {/* Left Expand/Toggle Button (Floating) */}
          <div className={`absolute top-3 left-3 z-50 flex gap-2 transition-all duration-300 ${!isLeftCollapsed ? 'lg:hidden' : ''}`}>
             {/* Mobile Sheet Trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 lg:hidden bg-background/80 backdrop-blur-sm shadow-sm" title="Open Menu">
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80 sm:w-96 flex flex-col">
                <aside className="h-full p-4 bg-sidebar border-r border-border flex flex-col overflow-hidden">
                  {sidebar}
                </aside>
              </SheetContent>
            </Sheet>

            {/* Desktop Expand Button */}
            <Button 
              variant="outline" 
              size="icon" 
              className={`h-8 w-8 hidden lg:flex bg-background/80 backdrop-blur-sm shadow-sm`}
              onClick={toggleLeftPanel}
              title="Expand Sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Right Expand/Toggle Button (Floating) */}
          <div className={`absolute top-3 right-3 z-50 flex gap-2 transition-all duration-300 ${!isRightCollapsed ? 'lg:hidden' : ''}`}>
             {/* Desktop Expand Button */}
             <Button 
              variant="outline" 
              size="icon" 
              className={`h-8 w-8 hidden lg:flex bg-background/80 backdrop-blur-sm shadow-sm`}
              onClick={toggleRightPanel}
              title="Expand AI Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>

            {/* Mobile Sheet Trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 lg:hidden bg-background/80 backdrop-blur-sm shadow-sm" title="Open AI Chat">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0 w-80 sm:w-96 flex flex-col pt-10">
                <aside className="h-full p-4 bg-sidebar border-l border-border flex flex-col overflow-hidden">
                  {aiPanel}
                </aside>
              </SheetContent>
            </Sheet>
          </div>

          <main className="h-full p-4 overflow-y-auto bg-background">
            {mainContent}
          </main>
        </ResizablePanel>
        
        <ResizableHandle withHandle className="hidden lg:flex" />

        {/* Right Sidebar (AI Panel) (Desktop) */}
        <ResizablePanel 
          ref={rightPanelRef}
          defaultSize={25} 
          collapsedSize={0}
          collapsible={true}
          minSize={20} 
          maxSize={35} 
          onCollapse={() => setIsRightCollapsed(true)}
          onExpand={() => setIsRightCollapsed(false)}
          className="hidden lg:block relative group"
        >
          <aside className="h-full p-4 bg-sidebar border-l border-border flex flex-col relative">
             {/* Collapse Button (Inside Sidebar) */}
             <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
               <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={toggleRightPanel}
                title="Collapse AI Chat"
              >
                <PanelRightClose className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            {aiPanel}
          </aside>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DashboardLayout;