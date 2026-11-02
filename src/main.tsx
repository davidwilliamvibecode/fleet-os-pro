import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { useErrorTracking } from "@/hooks/use-error-tracking";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Vehicles = lazy(() => import("./pages/Vehicles.tsx"));
const VehicleDetail = lazy(() => import("./pages/VehicleDetail.tsx"));
const Drivers = lazy(() => import("./pages/Drivers.tsx"));
const DriverDetail = lazy(() => import("./pages/DriverDetail.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Setup = lazy(() => import("./pages/Setup.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
import { TermsPage, PrivacyPage } from "./pages/Legal";

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Carregando…</div>
    </div>
  );
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">
              Não foi possível abrir esta tela
            </p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              Atualize a página. Se o problema continuar, entre em contato com o
              responsável pelo sistema.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function ErrorTracking() {
  useErrorTracking();
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <ErrorTracking />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/termos" element={<TermsPage />} />
              <Route path="/privacidade" element={<PrivacyPage />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/vehicles"
                element={
                  <RequireAuth>
                    <Vehicles />
                  </RequireAuth>
                }
              />
              <Route
                path="/vehicles/:vehicleId"
                element={
                  <RequireAuth>
                    <VehicleDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="/drivers"
                element={
                  <RequireAuth>
                    <Drivers />
                  </RequireAuth>
                }
              />
              <Route
                path="/drivers/:driverId"
                element={
                  <RequireAuth>
                    <DriverDetail />
                  </RequireAuth>
                }
              />
              {/* O livro de registros agora vive nas Configurações. */}
              <Route
                path="/logbook"
                element={<Navigate to="/settings?tab=logbook" replace />}
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
              <Route
                path="/setup"
                element={
                  <RequireAuth>
                    <Setup />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
