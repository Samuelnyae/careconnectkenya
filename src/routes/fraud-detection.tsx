import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { scanDuplicatePrescriptions } from "@/lib/fraud-detection.functions";
import { ShieldAlert, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/fraud-detection")({
  component: () => <ProtectedLayout><FraudPage /></ProtectedLayout>,
});

type Flag = {
  id: string; prescription_id: string | null; flag_type: string; severity: string; reason: string;
  status: string; created_at: string; details: Record<string, unknown> | null;
};

function FraudPage() {
  const { currentTenantId, user } = useAuth();
  const [items, setItems] = useState<Flag[]>([]);
  const [scanning, setScanning] = useState(false);
  const scan = useServerFn(scanDuplicatePrescriptions);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const { data } = await supabase.from("rx_fraud_flags").select("*").eq("tenant_id", currentTenantId).order("created_at", { ascending: false }).limit(200);
    setItems((data ?? []) as Flag[]);
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load]);

  const runScan = async () => {
    if (!currentTenantId) return;
    setScanning(true);
    try {
      const res = await scan({ data: { tenantId: currentTenantId } });
      toast.success(`Scanned ${res.scanned} Rx, found ${res.flagged} issue${res.flagged === 1 ? "" : "s"}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const setStatus = async (id: string, status: "confirmed" | "dismissed" | "reviewing") => {
    const { error } = await supabase.from("rx_fraud_flags").update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const sevBadge = (s: string) => {
    const v: Record<string, "destructive" | "secondary" | "outline"> = { critical: "destructive", high: "destructive", medium: "secondary", low: "outline" };
    return <Badge variant={v[s] ?? "secondary"}>{s}</Badge>;
  };

  const open = items.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ShieldAlert className="h-7 w-7 text-destructive" /> Fraud Detection</h1>
          <p className="text-muted-foreground">AI-powered scan for duplicate and cloned prescriptions.</p>
        </div>
        <Button onClick={() => void runScan()} disabled={scanning}>
          <Sparkles className="mr-2 h-4 w-4" />{scanning ? "Scanning…" : "Run AI scan"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Open flags</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{open}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total flags</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{items.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Confirmed</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{items.filter((i) => i.status === "confirmed").length}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Flags</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No flags. Click "Run AI scan" to analyze recent prescriptions.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Detected</TableHead><TableHead>Type</TableHead><TableHead>Severity</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</TableCell>
                      <TableCell>{f.flag_type}</TableCell>
                      <TableCell>{sevBadge(f.severity)}</TableCell>
                      <TableCell className="max-w-md text-sm">{f.reason}</TableCell>
                      <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {f.status === "open" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="destructive" onClick={() => void setStatus(f.id, "confirmed")}><Check className="mr-1 h-3 w-3" />Confirm</Button>
                            <Button size="sm" variant="ghost" onClick={() => void setStatus(f.id, "dismissed")}><X className="mr-1 h-3 w-3" />Dismiss</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}