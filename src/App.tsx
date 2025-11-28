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
import DashboardHome from "./pages/DashboardHome"; // Import the new homepage
import ProjectDetails from "./pages/ProjectDetails";
import UserSettings from "./pages/UserSettings";
import Profile from "./pages/Profile";
import StepWorkspace from "./pages/StepWorkspace";
import AdminMigration from "./pages/AdminMigration";
import AdminSplitMigration from "./pages/AdminSplitMigration";
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
                  {/* Use DashboardHome for the index route */}
                  <Route index element={<DashboardHome />} />
                  <Route path=":projectId" element={<ProjectDetails />} />
                  <Route path=":projectId/step/:stepId" element={<StepWorkspace />} />
                  <Route path=":projectId/document/:documentId" element={<StepWorkspace />} />
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