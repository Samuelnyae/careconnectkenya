import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { stockTakeVariance } from "@/lib/inventory";
import type { Product } from "./types";

type Take = { id: string; name: string; status: string; started_at: string; completed_at: string | null };
type Line = { id: string; take_id: string; product_id: string | null; product_name: string; system_qty: number; counted_qty: number | null };

export function StockTakeTab({ tenantId, userId, products, canManage, onChanged, refreshKey }: {
  tenantId: string; userId: string; products: Product[]; canManage: boolean; onChanged: () => void; refreshKey: number;
}) {
  const [takes, setTakes] = useState<Take[]>([]);
  const [active, setActive] = useState<Take | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("stock_takes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    const rows = (data ?? []) as Take[];
    setTakes(rows);
    const open = rows.find((t) => t.status === "in_progress") ?? null;
    setActive(open);
    if (open) {
      const { data: l } = await supabase.from("stock_take_lines").select("*").eq("take_id", open.id).order("product_name");
      setLines((l ?? []) as Line[]);
    } else setLines([]);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const startTake = async () => {
    if (products.length === 0) return toast.error("Add products first");
    setBusy(true);
    const name = `Stock take ${new Date().toLocaleDateString()}`;
    const { data, error } = await supabase.from("stock_takes").insert({
      tenant_id: tenantId, name, status: "in_progress", created_by: userId,
    }).select("id").single();
    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Failed"); }
    const { error: lErr } = await supabase.from("stock_take_lines").insert(
      products.map((p) => ({
        tenant_id: tenantId, take_id: data.id, product_id: p.id,
        product_name: p.name, system_qty: p.stock_qty,
      })),
    );
    setBusy(false);
    if (lErr) return toast.error(lErr.message);
    toast.success("Stock take started");
    void load();
  };

  const setCount = async (line: Line, value: string) => {
    const counted = value === "" ? null : Number(value);
    setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, counted_qty: counted } : l)));
    await supabase.from("stock_take_lines").update({ counted_qty: counted }).eq("id", line.id);
  };

  const finish = async () => {
    if (!active) return;
    setBusy(true);
    const counted = lines.filter((l) => l.counted_qty !== null);
    for (const l of counted) {
      const variance = stockTakeVariance(l.system_qty, l.counted_qty);
      if (!variance || !l.product_id) continue;
      await supabase.from("stock_movements").insert({
        tenant_id: tenantId, product_id: l.product_id, movement_type: "adjustment",
        quantity: variance, unit_cost: 0, reason: "Stock take variance",
        reference: active.name, performed_by: userId,
      });
    }
    await supabase.from("stock_takes").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", active.id);
    setBusy(false);
    toast.success(`Stock take closed — ${counted.length} lines reconciled`);
    void load();
    onChanged();
  };

  const countedCount = lines.filter((l) => l.counted_qty !== null).length;
  const varianceCount = lines.filter((l) => l.counted_qty !== null && l.counted_qty !== l.system_qty).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>{active ? active.name : "Stock take"}</CardTitle>
          {canManage && (active
            ? <Button size="sm" disabled={busy || countedCount === 0} onClick={() => void finish()}>Close & reconcile</Button>
            : <Button size="sm" disabled={busy} onClick={() => void startTake()}><ClipboardList className="mr-1 h-4 w-4" />Start stock take</Button>)}
        </CardHeader>
        <CardContent>
          {!active ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No stock take in progress. Starting one snapshots current system quantities for counting.
            </p>
          ) : (
            <>
              <div className="mb-3 flex gap-4 text-sm text-muted-foreground">
                <span>{countedCount}/{lines.length} counted</span>
                <span>{varianceCount} variances</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Product</TableHead><TableHead>System</TableHead>
                    <TableHead>Counted</TableHead><TableHead>Variance</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lines.map((l) => {
                      const v = stockTakeVariance(l.system_qty, l.counted_qty);
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.product_name}</TableCell>
                          <TableCell>{l.system_qty}</TableCell>
                          <TableCell className="w-28">
                            <Input
                              type="number"
                              value={l.counted_qty ?? ""}
                              disabled={!canManage}
                              onChange={(e) => void setCount(l, e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            {v === null ? "—" : v === 0
                              ? <Badge className="bg-success text-success-foreground">Match</Badge>
                              : <Badge variant={v < 0 ? "destructive" : "secondary"}>{v > 0 ? "+" : ""}{v}</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {takes.filter((t) => t.status !== "in_progress").length > 0 && (
        <Card>
          <CardHeader><CardTitle>Past stock takes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {takes.filter((t) => t.status !== "in_progress").map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground">{t.completed_at ? new Date(t.completed_at).toLocaleString() : t.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
