import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { FolderHeart, Search, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/records")({
  component: () => <ProtectedLayout><RecordsPage /></ProtectedLayout>,
});

type PatientRow = {
  id: string; full_name: string; phone: string | null; date_of_birth: string | null; gender: string | null;
  is_chronic: boolean; chronic_conditions: string | null; county: string | null; national_id: string | null;
};

type Stats = { patients: number; visits: number; rx: number; labs: number; chronic: number };

function RecordsPage() {
  const { currentTenantId, currentTenant } = useAuth();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [stats, setStats] = useState<Stats>({ patients: 0, visits: 0, rx: 0, labs: 0, chronic: 0 });
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const [p, v, rx, l] = await Promise.all([
      supabase.from("patients").select("id, full_name, phone, date_of_birth, gender, is_chronic, chronic_conditions, county, national_id").eq("tenant_id", currentTenantId).order("created_at", { ascending: false }).limit(500),
      supabase.from("patient_visits").select("id", { count: "exact", head: true }).eq("tenant_id", currentTenantId),
      supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("tenant_id", currentTenantId),
      supabase.from("lab_results").select("id", { count: "exact", head: true }).eq("tenant_id", currentTenantId),
    ]);
    const rows = (p.data ?? []) as PatientRow[];
    setPatients(rows);
    setStats({ patients: rows.length, visits: v.count ?? 0, rx: rx.count ?? 0, labs: l.count ?? 0, chronic: rows.filter((r) => r.is_chronic).length });
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return patients.slice(0, 50);
    return patients.filter((p) =>
      p.full_name.toLowerCase().includes(term) ||
      (p.phone ?? "").includes(term) ||
      (p.national_id ?? "").includes(term),
    ).slice(0, 100);
  }, [patients, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><FolderHeart className="h-7 w-7 text-primary" /> Patient Records</h1>
        <p className="text-muted-foreground">Centralized EMR for {currentTenant?.name ?? "your facility"}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Patients</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.patients}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Visits</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.visits}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Prescriptions</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.rx}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Lab results</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.labs}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Chronic care</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.chronic}</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Search records</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Name, phone, or national ID…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No matching patients.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => (
                <Link key={p.id} to="/patients/$id" params={{ id: p.id }} className="flex items-center justify-between gap-4 py-3 hover:bg-muted/40 px-2 rounded">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{p.full_name}</div>
                      {p.is_chronic && <Badge variant="outline" className="text-xs">Chronic</Badge>}
                      {p.county && <Badge variant="secondary" className="text-xs">{p.county}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{p.phone ?? "—"} · {p.gender ?? "—"} · {p.date_of_birth ?? "DOB unknown"}</div>
                    {p.chronic_conditions && <div className="text-xs text-muted-foreground truncate">{p.chronic_conditions}</div>}
                  </div>
                  <Button variant="ghost" size="sm">Open<ChevronRight className="ml-1 h-4 w-4" /></Button>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}