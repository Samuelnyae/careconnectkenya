import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Database, Cloud, Globe } from "lucide-react";

export const Route = createFileRoute("/admin/health")({
  component: HealthPage,
});

type Counts = Record<string, number | null>;

const TABLES = [
  "tenants", "memberships", "patients", "patient_visits", "products",
  "sales", "appointments", "prescriptions", "reminders", "sha_claims", "lab_results",
] as const;

function HealthPage() {
  const [counts, setCounts] = useState<Counts>({});
  const [dbOk, setDbOk] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const out: Counts = {};
      let ok = true;
      for (const t of TABLES) {
        const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
        out[t] = error ? null : (count ?? 0);
        if (error) ok = false;
      }
      setCounts(out);
      setDbOk(ok);
    })();
  }, []);

  const region = (import.meta.env.VITE_APP_REGION as string | undefined) ?? "nairobi-primary";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
        <p className="text-muted-foreground">Live infrastructure and data status.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dbOk === null ? <div className="text-muted-foreground">Checking…</div> :
              dbOk ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Online</Badge> :
                <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Degraded</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Region</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg font-semibold">{region}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Backup Region</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-lg font-semibold">backup-secondary</div><div className="text-xs text-muted-foreground">Warm standby</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Row counts by table</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TABLES.map((t) => (
              <div key={t} className="flex items-center justify-between rounded-md border p-3">
                <span className="font-mono text-sm">{t}</span>
                <span className={counts[t] === null ? "text-destructive" : "font-semibold"}>
                  {counts[t] === null ? "ERR" : counts[t]?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}