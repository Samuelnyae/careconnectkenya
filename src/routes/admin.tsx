import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, DollarSign, Package } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => <ProtectedLayout><AdminPage /></ProtectedLayout>,
});

type Tenant = { id: string; name: string; slug: string; type: string; created_at: string };

function AdminPage() {
  const { user, loading } = useAuth();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState({ tenants: 0, members: 0, products: 0, revenue: 0 });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      const ok = !!data;
      setIsAdmin(ok);
      setChecked(true);
      if (!ok) return;
      const [t, m, p, s] = await Promise.all([
        supabase.from("tenants").select("id, name, slug, type, created_at").order("created_at", { ascending: false }),
        supabase.from("memberships").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("sales").select("total"),
      ]);
      setTenants((t.data ?? []) as Tenant[]);
      const revenue = (s.data ?? []).reduce((sum, r) => sum + Number(r.total), 0);
      setStats({ tenants: t.data?.length ?? 0, members: m.count ?? 0, products: p.count ?? 0, revenue });
    })();
  }, [user]);

  if (loading || !checked) return <div className="text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const fmt = (n: number) => "KSh " + n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
  const kpis = [
    { label: "Organizations", value: stats.tenants, icon: Building2 },
    { label: "Total Members", value: stats.members, icon: Users },
    { label: "Total Products", value: stats.products, icon: Package },
    { label: "Platform Revenue", value: fmt(stats.revenue), icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Admin</h1>
        <p className="text-muted-foreground">Cross-organization overview of the SaaS.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Organizations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Type</TableHead><TableHead>Created</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                  <TableCell><Badge variant="secondary">{t.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No organizations yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}