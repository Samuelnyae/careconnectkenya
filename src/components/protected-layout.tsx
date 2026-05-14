import { type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";
import { OnboardingGate } from "@/components/onboarding-gate";
import { OfflineIndicator } from "@/components/offline-indicator";

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, loading, memberships, currentTenantId } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" />;
  if (memberships.length === 0 || !currentTenantId) return <OnboardingGate />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="text-sm font-medium text-muted-foreground">Afya Cloud</div>
            <div className="ml-auto"><OfflineIndicator /></div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}