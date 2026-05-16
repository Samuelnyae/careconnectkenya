import { type ReactNode, useEffect, useState } from "react";
import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Activity,
  ArrowLeft,
  LogOut,
} from "lucide-react";

const items = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard },
  { title: "Organizations", url: "/admin/tenants", icon: Building2 },
  { title: "Members", url: "/admin/members", icon: Users },
  { title: "Platform Admins", url: "/admin/admins", icon: UserCog },
  { title: "System Health", url: "/admin/health", icon: Activity },
];

function AdminSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut } = useAuth();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-sidebar-foreground">Platform Admin</div>
            <div className="truncate text-xs text-sidebar-foreground/60">Super-user console</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Switch</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/dashboard">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to workspace</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <Button variant="ghost" size="sm" onClick={() => void signOut()} className="justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setChecked(true); return; }
    void supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setIsAdmin(!!data); setChecked(true); });
  }, [user]);

  if (loading || !checked) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="text-sm font-medium text-muted-foreground">Platform Admin Console</div>
          </header>
          <main className="flex-1 p-6">{children ?? <Outlet />}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}