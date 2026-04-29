import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Package, LogOut, Building2, Settings, Shield, Users, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pharmacy POS", url: "/pos", icon: ShoppingCart },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Patients", url: "/patients", icon: Users },
  { title: "SHA Claims", url: "/claims", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { currentTenant, signOut, user } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsPlatformAdmin(false); return; }
    void supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsPlatformAdmin(!!data));
  }, [user]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-sidebar-foreground">
              {currentTenant?.name ?? "Afya Cloud"}
            </div>
            <div className="truncate text-xs text-sidebar-foreground/60">
              Healthcare Platform
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
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
              {isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/admin"}>
                    <Link to="/admin">
                      <Shield className="h-4 w-4" />
                      <span>Platform Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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