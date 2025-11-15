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
import ProjectDetails from "./pages/ProjectDetails"; // New import
import { SessionContextProvider } from "./integrations/supabase/SessionContextProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/project/new" element={<ProjectCreation />} />
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
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;