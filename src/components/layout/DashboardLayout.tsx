import React from 'react';

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  mainContent: React.ReactNode;
  aiPanel: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, mainContent, aiPanel }) => {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Left Sidebar (Roadmap Navigation) */}
      <aside className="w-[20%] border-r border-border bg-sidebar p-4 hidden md:block">
        {sidebar}
      </aside>

      {/* Center Content (Document Editor) */}
      <main className="flex-1 w-[60%] p-4">
        {mainContent}
      </main>

      {/* Right Sidebar (AI Panel) */}
      <aside className="w-[20%] border-l border-border bg-sidebar p-4 hidden md:block">
        {aiPanel}
      </aside>
    </div>
  );
};

export default DashboardLayout;