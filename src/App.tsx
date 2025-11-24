import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ProjectCreation from "./pages/ProjectCreation";
import Dashboard from "./pages/Dashboard";
import ProjectDetails from "./pages/ProjectDetails";
import DocumentEditor from "./pages/DocumentEditor";
import UserSettings from "./pages/UserSettings";
import Profile from "./pages/Profile";
import StepWorkspace from "./pages/StepWorkspace";
import AdminMigration from "./pages/AdminMigration";
import AdminSplitMigration from "./pages/AdminSplitMigration"; // New import
import { SessionContextProvider } from "./integrations/supabase/SessionContextProvider";
import { ThemeProvider } from "next-themes";
import AppSetupProvider from "./components/layout/AppSetupProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SessionContextProvider>
            <AppSetupProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/project/new" element={<ProjectCreation />} />
                {/* Admin Routes */}
                <Route path="/admin/migration" element={<AdminMigration />} />
                <Route path="/admin/split-migration" element={<AdminSplitMigration />} />
                
                <Route path="/dashboard" element={<Dashboard />}>
                  <Route index element={
                    <div className="flex flex-col items-center justify-center h-full">
                      <h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard!</h1>
                      <p className="text-lg text-muted-foreground">
                        Select a project from the sidebar to view its details.
                      </p>
                    </div>
                  } />
                  <Route path=":projectId" element={<ProjectDetails />} />
                  <Route path=":projectId/step/:stepId" element={<StepWorkspace />} />
                  <Route path=":projectId/document/:documentId" element={<DocumentEditor />} />
                  <Route path="settings" element={<UserSettings />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppSetupProvider>
          </SessionContextProvider>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;