import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Activity, MapPin, AlertTriangle, TrendingUp } from "lucide-react";
import { KENYA_COUNTIES } from "@/lib/kenya-counties";

export const Route = createFileRoute("/disease-trends")({
  component: () => <ProtectedLayout><DiseaseTrendsPage /></ProtectedLayout>,
});

type Visit = { id: string; diagnosis: string | null; county: string | null; visit_date: string };

function DiseaseTrendsPage() {
  const { currentTenantId } = useAuth();
  const [days, setDays] = useState<number>(30);
  const [scope, setScope] = useState<"tenant" | "all">("tenant");
  const [county, setCounty] = useState<string>("all");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    setLoading(true);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    let q = supabase
      .from("patient_visits")
      .select("id, diagnosis, county, visit_date")
      .gte("visit_date", since)
      .not("diagnosis", "is", null)
      .limit(1000);
    if (scope === "tenant") q = q.eq("tenant_id", currentTenantId);
    const { data } = await q;
    setVisits((data ?? []) as Visit[]);
    setLoading(false);
  }, [currentTenantId, days, scope]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(
    () => (county === "all" ? visits : visits.filter((v) => v.county === county)),
    [visits, county],
  );

  const byCounty = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of visits) {
      const c = v.county ?? "Unknown";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [visits]);

  const byDisease = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of filtered) {
      const key = (v.diagnosis ?? "").trim().toLowerCase();
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [filtered]);

  // Outbreak detection: a disease whose last-7d count exceeds 2x its prior baseline
  const alerts = useMemo(() => {
    const recentCutoff = Date.now() - 7 * 86_400_000;
    const byKey = new Map<string, { recent: number; prior: number; county: string }>();
    for (const v of filtered) {
      const key = `${(v.diagnosis ?? "").trim().toLowerCase()}|${v.county ?? "Unknown"}`;
      if (!key.startsWith("|") === false) continue;
      if (!v.diagnosis) continue;
      const t = new Date(v.visit_date).getTime();
      const slot = byKey.get(key) ?? { recent: 0, prior: 0, county: v.county ?? "Unknown" };
      if (t >= recentCutoff) slot.recent++; else slot.prior++;
      byKey.set(key, slot);
    }
    const out: { disease: string; county: string; recent: number; prior: number }[] = [];
    for (const [key, v] of byKey) {
      if (v.recent >= 5 && v.recent >= 2 * Math.max(v.prior, 1)) {
        out.push({ disease: key.split("|")[0], county: v.county, recent: v.recent, prior: v.prior });
      }
    }
    return out.sort((a, b) => b.recent - a.recent).slice(0, 10);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Activity className="h-7 w-7 text-primary" /> Disease Trends
        </h1>
        <p className="text-muted-foreground">Track outbreaks and chronic disease patterns by Kenyan county.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scope} onValueChange={(v) => setScope(v as "tenant" | "all")}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tenant">My clinic only</SelectItem>
            <SelectItem value="all">All clinics (network)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={county} onValueChange={setCounty}>
          <SelectTrigger className="w-56"><SelectValue placeholder="County" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All counties</SelectItem>
            {KENYA_COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Total visits</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{filtered.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Counties reporting</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{byCounty.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Outbreak alerts</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{alerts.length}</CardContent>
        </Card>
      </div>

      {alerts.length > 0 && (
        <Card className="border-amber-300/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" /> Possible outbreaks (last 7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Disease</TableHead><TableHead>County</TableHead><TableHead>Last 7d</TableHead><TableHead>Prior</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="capitalize">{a.disease}</TableCell>
                    <TableCell>{a.county}</TableCell>
                    <TableCell className="font-semibold text-amber-700">{a.recent}</TableCell>
                    <TableCell className="text-muted-foreground">{a.prior}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> By county</CardTitle></CardHeader>
          <CardContent>
            {byCounty.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visit data yet.</p>
            ) : (
              <div className="space-y-2">
                {byCounty.slice(0, 15).map(([c, n]) => {
                  const pct = (n / byCounty[0][1]) * 100;
                  return (
                    <div key={c}>
                      <div className="flex justify-between text-sm"><span>{c}</span><span className="text-muted-foreground">{n}</span></div>
                      <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Top diagnoses</CardTitle></CardHeader>
          <CardContent>
            {byDisease.length === 0 ? (
              <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "No diagnoses recorded yet."}</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Diagnosis</TableHead><TableHead className="text-right">Cases</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byDisease.map(([d, n]) => (
                    <TableRow key={d}><TableCell className="capitalize">{d}</TableCell><TableCell className="text-right font-medium">{n}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}