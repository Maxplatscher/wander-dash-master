import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import DispatchDashboard from "./pages/DispatchDashboard";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import NotFound from "./pages/NotFound.tsx";
import { CompanySetupRoute, OnboardingRoute } from "@/components/setup/OnboardingRoute";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/setup"
              element={
                <ProtectedRoute>
                  <CompanySetupRoute>
                    <Setup />
                  </CompanySetupRoute>
                </ProtectedRoute>
              }
            />
            {/* Alter Consent-Pfad → neuer Wizard */}
            <Route path="/setup-consent" element={<Navigate to="/setup" replace />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <OnboardingRoute>
                    <DispatchDashboard />
                  </OnboardingRoute>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
