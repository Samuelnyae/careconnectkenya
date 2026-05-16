import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Package, DollarSign, Activity, UserCog } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

type Tenant = { id: string; name: string; slug: string; type: string; county: string | null; created_at: string };

function AdminOverview() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState({ tenants: 0, members: 0, products: 0, revenue: 0, admins: 0, visits: 0 });

  useEffect(() => {
    void (async () => {
      const [t, m, p, s, a, v] = await Promise.all([
        supabase.from("tenants").select("id, name, slug, type, county, created_at").order("created_at", { ascending: false }),
        supabase.from("memberships").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("sales").select("total"),
        supabase.from("platform_admins").select("user_id", { count: "exact", head: true }),
        supabase.from("patient_visits").select("id", { count: "exact", head: true }),
      ]);
      const list = (t.data ?? []) as Tenant[];
      setTenants(list);
      const revenue = (s.data ?? []).reduce((sum, r) => sum + Number(r.total), 0);
      setStats({
        tenants: list.length,
        members: m.count ?? 0,
        products: p.count ?? 0,
        revenue,
        admins: a.count ?? 0,
        visits: v.count ?? 0,
      });
    })();
  }, []);

  const fmt = (n: number) => "KSh " + n.toLocaleString("en-KE", { maximumFractionDigits: 0 });
  const kpis = [
    { label: "Organizations", value: stats.tenants, icon: Building2 },
    { label: "Members", value: stats.members, icon: Users },
    { label: "Products", value: stats.products, icon: Package },
    { label: "Platform Revenue", value: fmt(stats.revenue), icon: DollarSign },
    { label: "Patient Visits", value: stats.visits, icon: Activity },
    { label: "Platform Admins", value: stats.admins, icon: UserCog },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Cross-platform health of the SaaS.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <CardHeader><CardTitle>Recent organizations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>County</TableHead><TableHead>Created</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {tenants.slice(0, 8).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell><Badge variant="secondary">{t.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{t.county ?? "—"}</TableCell>
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