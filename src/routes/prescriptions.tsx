import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Pill, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/prescriptions")({
  component: () => <ProtectedLayout><PrescriptionsPage /></ProtectedLayout>,
});

type Rx = {
  id: string; drug_name: string; dosage: string | null; frequency: string | null; duration: string | null;
  quantity: number | null; status: string; created_at: string; dispensed_at: string | null;
  patient_id: string; refills_remaining: number;
  patients: { full_name: string; phone: string | null } | null;
};

const STATUSES = ["all", "active", "dispensed", "cancelled", "expired", "flagged"];

function PrescriptionsPage() {
  const { currentTenantId, user } = useAuth();
  const [items, setItems] = useState<Rx[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const { data } = await supabase
      .from("prescriptions")
      .select("id, drug_name, dosage, frequency, duration, quantity, status, created_at, dispensed_at, patient_id, refills_remaining, patients!inner(full_name, phone)")
      .eq("tenant_id", currentTenantId)
      .order("created_at", { ascending: false })
      .limit(300);
    setItems(((data ?? []) as unknown as Rx[]));
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return r.drug_name.toLowerCase().includes(q) || (r.patients?.full_name ?? "").toLowerCase().includes(q);
    });
  }, [items, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const r of items) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [items]);

  const dispense = async (id: string) => {
    const { error } = await supabase.from("prescriptions").update({ status: "dispensed", dispensed_at: new Date().toISOString(), dispensed_by: user?.id ?? null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked dispensed");
    void load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("prescriptions").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { active: "bg-primary/10 text-primary", dispensed: "bg-success/10 text-success", flagged: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground", expired: "bg-warning/10 text-warning" };
    return <Badge variant="outline" className={map[s] ?? ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Pill className="h-7 w-7" /> Prescriptions</h1>
        <p className="text-muted-foreground">Track every Rx from issue to dispense.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)} className="capitalize">
            {s} <span className="ml-2 text-xs opacity-70">{counts[s] ?? 0}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>All prescriptions</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Drug or patient…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No prescriptions.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Issued</TableHead><TableHead>Patient</TableHead><TableHead>Drug</TableHead><TableHead>Dose / Freq</TableHead><TableHead>Qty</TableHead><TableHead>Refills</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{r.patients?.full_name ?? "—"}</TableCell>
                      <TableCell>{r.drug_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.dosage ?? "—"} · {r.frequency ?? "—"}</TableCell>
                      <TableCell>{r.quantity ?? "—"}</TableCell>
                      <TableCell>{r.refills_remaining}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        {r.status === "active" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => void dispense(r.id)}><CheckCircle2 className="mr-1 h-3 w-3" />Dispense</Button>
                            <Button size="sm" variant="ghost" onClick={() => void cancel(r.id)}>Cancel</Button>
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