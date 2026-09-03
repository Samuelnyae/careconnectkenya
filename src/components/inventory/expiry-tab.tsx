import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EXPIRY_LABEL, daysUntil, expiryStatus } from "@/lib/inventory";
import type { Batch, Product } from "./types";

export function ExpiryTab({ tenantId, userId, products, canManage, onChanged, refreshKey }: {
  tenantId: string; userId: string; products: Product[]; canManage: boolean; onChanged: () => void; refreshKey: number;
}) {
  const [batches, setBatches] = useState<Batch[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("product_batches").select("*").eq("tenant_id", tenantId).gt("quantity", 0)
      .order("expiry_date", { ascending: true, nullsFirst: false });
    setBatches((data ?? []) as Batch[]);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "Unknown product";

  const at_risk = batches.filter((b) => ["expired", "critical", "soon"].includes(expiryStatus(b.expiry_date)));

  const quarantine = async (b: Batch) => {
    const { error } = await supabase.from("product_batches").update({ status: "quarantined" }).eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Batch quarantined");
    void load();
  };

  const dispose = async (b: Batch) => {
    const { error } = await supabase.from("stock_movements").insert({
      tenant_id: tenantId, product_id: b.product_id, batch_id: b.id,
      movement_type: "disposal", quantity: -b.quantity, unit_cost: b.cost_price,
      reason: expiryStatus(b.expiry_date) === "expired" ? "Expired" : "Withdrawn from sale",
      reference: b.batch_number, performed_by: userId,
    });
    if (error) return toast.error(error.message);
    await supabase.from("product_batches").update({ status: "disposed" }).eq("id", b.id);
    toast.success("Batch disposed and stock deducted");
    void load();
    onChanged();
  };

  const release = async (b: Batch) => {
    const { error } = await supabase.from("product_batches").update({ status: "available" }).eq("id", b.id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expiry, quarantine & disposal ({at_risk.length} at risk)</CardTitle>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No batches with stock on hand.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Qty</TableHead>
                <TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {batches.map((b) => {
                  const es = expiryStatus(b.expiry_date);
                  const d = daysUntil(b.expiry_date);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{nameOf(b.product_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.batch_number}</TableCell>
                      <TableCell>{b.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {b.expiry_date ?? "—"}{d !== null && <div className="text-xs">{d < 0 ? `${-d}d ago` : `in ${d}d`}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={es === "expired" ? "destructive" : es === "critical" ? "default" : "secondary"}>{EXPIRY_LABEL[es]}</Badge>
                          {b.status !== "available" && <Badge variant="outline">{b.status}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            {b.status === "quarantined"
                              ? <Button size="sm" variant="ghost" onClick={() => void release(b)}>Release</Button>
                              : <Button size="sm" variant="ghost" onClick={() => void quarantine(b)}>Quarantine</Button>}
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void dispose(b)}>Dispose</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
