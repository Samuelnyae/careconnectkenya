import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { nextPoNumber } from "@/lib/inventory";
import type { Product, Supplier } from "./types";

type PO = {
  id: string; po_number: string; supplier_id: string | null; status: string;
  order_date: string; expected_date: string | null; total: number; notes: string | null;
};
type POItem = {
  id: string; po_id: string; product_id: string | null; product_name: string;
  quantity: number; unit_cost: number; received_qty: number;
};
type Draft = { product_id: string; product_name: string; quantity: string; unit_cost: string };

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary text-primary-foreground",
  partial: "bg-warning text-warning-foreground",
  received: "bg-success text-success-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

export function PurchasingTab({ tenantId, userId, products, suppliers, canManage, onChanged, refreshKey }: {
  tenantId: string; userId: string; products: Product[]; suppliers: Supplier[];
  canManage: boolean; onChanged: () => void; refreshKey: number;
}) {
  const [orders, setOrders] = useState<PO[]>([]);
  const [items, setItems] = useState<POItem[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [expected, setExpected] = useState("");
  const [lines, setLines] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [o, i] = await Promise.all([
      supabase.from("purchase_orders").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("purchase_order_items").select("*").eq("tenant_id", tenantId),
    ]);
    setOrders((o.data ?? []) as PO[]);
    setItems((i.data ?? []) as POItem[]);
  }, [tenantId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const addLine = () => setLines((l) => [...l, { product_id: "", product_name: "", quantity: "1", unit_cost: "0" }]);
  const setLine = (idx: number, patch: Partial<Draft>) =>
    setLines((l) => l.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  const draftTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);

  const createPo = async () => {
    const valid = lines.filter((l) => l.product_name.trim() && Number(l.quantity) > 0);
    if (valid.length === 0) return toast.error("Add at least one line item");
    setSaving(true);
    const poNumber = nextPoNumber(orders.map((o) => o.po_number));
    const { data, error } = await supabase.from("purchase_orders").insert({
      tenant_id: tenantId, supplier_id: supplierId || null, po_number: poNumber,
      status: "submitted", order_date: new Date().toISOString().slice(0, 10),
      expected_date: expected || null, total: draftTotal, created_by: userId,
    }).select("id").single();
    if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const { error: iErr } = await supabase.from("purchase_order_items").insert(
      valid.map((l) => ({
        tenant_id: tenantId, po_id: data.id, product_id: l.product_id || null,
        product_name: l.product_name.trim(), quantity: Number(l.quantity),
        unit_cost: Number(l.unit_cost) || 0,
      })),
    );
    setSaving(false);
    if (iErr) return toast.error(iErr.message);
    toast.success(`${poNumber} created`);
    setOpen(false); setLines([]); setSupplierId(""); setExpected("");
    void load();
  };

  const receive = async (po: PO) => {
    const poItems = items.filter((i) => i.po_id === po.id);
    const pending = poItems.filter((i) => i.received_qty < i.quantity);
    if (pending.length === 0) return toast.info("Everything already received");
    for (const it of pending) {
      const qty = it.quantity - it.received_qty;
      if (it.product_id) {
        const { data: batch } = await supabase.from("product_batches").insert({
          tenant_id: tenantId, product_id: it.product_id,
          batch_number: `${po.po_number}-${it.id.slice(0, 4)}`,
          quantity: 0, cost_price: it.unit_cost, supplier_id: po.supplier_id,
        }).select("id").single();
        await supabase.from("stock_movements").insert({
          tenant_id: tenantId, product_id: it.product_id, batch_id: batch?.id ?? null,
          movement_type: "stock_in", quantity: qty, unit_cost: it.unit_cost,
          reason: "Purchase received", reference: po.po_number, performed_by: userId,
        });
      }
      await supabase.from("purchase_order_items").update({ received_qty: it.quantity }).eq("id", it.id);
    }
    await supabase.from("purchase_orders").update({ status: "received" }).eq("id", po.id);
    toast.success(`${po.po_number} received into stock`);
    void load();
    onChanged();
  };

  const setStatus = async (po: PO, status: string) => {
    const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", po.id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Purchase orders ({orders.length})</CardTitle>
        {canManage && <Button size="sm" onClick={() => { setLines([{ product_id: "", product_name: "", quantity: "1", unit_cost: "0" }]); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />New order</Button>}
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No purchase orders yet.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((po) => {
              const poItems = items.filter((i) => i.po_id === po.id);
              const isOpen = expanded === po.id;
              return (
                <div key={po.id} className="rounded-lg border">
                  <button className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left" onClick={() => setExpanded(isOpen ? null : po.id)}>
                    <div>
                      <div className="font-medium">{po.po_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {suppliers.find((s) => s.id === po.supplier_id)?.name ?? "No supplier"} · ordered {po.order_date}
                        {po.expected_date ? ` · expected ${po.expected_date}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">KSh {Number(po.total).toLocaleString()}</span>
                      <Badge className={STATUS_COLOR[po.status] ?? ""}>{po.status}</Badge>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t p-3">
                      <Table>
                        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Received</TableHead><TableHead>Unit cost</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {poItems.map((i) => (
                            <TableRow key={i.id}>
                              <TableCell>{i.product_name}</TableCell>
                              <TableCell>{i.quantity}</TableCell>
                              <TableCell>{i.received_qty}</TableCell>
                              <TableCell>KSh {Number(i.unit_cost).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {canManage && po.status !== "received" && po.status !== "cancelled" && (
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => void receive(po)}>Receive all into stock</Button>
                          <Button size="sm" variant="outline" onClick={() => void setStatus(po, "cancelled")}>Cancel order</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 && <SelectItem value="none" disabled>No suppliers</SelectItem>}
                  {suppliers.filter((s) => s.is_active).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Expected date</Label><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Line items</Label>
            {lines.map((l, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_80px_110px_40px]">
                <Select
                  value={l.product_id}
                  onValueChange={(v) => {
                    const p = products.find((x) => x.id === v);
                    setLine(idx, { product_id: v, product_name: p?.name ?? "", unit_cost: String(p?.cost_price ?? 0) });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" min="1" value={l.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} />
                <Input type="number" value={l.unit_cost} onChange={(e) => setLine(idx, { unit_cost: e.target.value })} />
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-1 h-3 w-3" />Add line</Button>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Order total</span>
            <span className="text-xl font-bold">KSh {draftTotal.toLocaleString()}</span>
          </div>
          <DialogFooter><Button onClick={() => void createPo()} disabled={saving}>Create order</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
