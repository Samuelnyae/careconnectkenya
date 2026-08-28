import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MOVEMENT_LABEL, signedQuantity, type MovementType } from "@/lib/inventory";
import type { Batch, Product, Supplier } from "./types";

const REASONS: Record<MovementType, string[]> = {
  stock_in: ["Purchase received", "Donation", "Transfer in", "Opening stock"],
  stock_out: ["Internal use", "Ward issue", "Transfer out", "Sample"],
  transfer: ["Ward transfer", "Branch transfer", "Store to counter"],
  adjustment: ["Stock take variance", "Data entry correction", "Recount"],
  return: ["Customer return", "Ward return", "Supplier credit reversal"],
  disposal: ["Expired", "Damaged", "Recalled", "Contaminated"],
  dispense: ["Prescription dispensed"],
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  userId: string;
  product: Product | null;
  type: MovementType;
  suppliers: Supplier[];
  onDone: () => void;
};

export function StockMoveDialog({ open, onOpenChange, tenantId, userId, product, type, suppliers, onDone }: Props) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [newBatch, setNewBatch] = useState({ batch_number: "", expiry_date: "", cost_price: "", supplier_id: "" });
  const [qty, setQty] = useState("");
  const [sign, setSign] = useState<"+" | "-">("+");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setBatchId(""); setQty(""); setReason(""); setReference(""); setNotes("");
    setSign("+"); setFrom(product.storage_location ?? ""); setTo("");
    setNewBatch({ batch_number: "", expiry_date: "", cost_price: String(product.cost_price), supplier_id: product.supplier_id ?? "" });
    void supabase
      .from("product_batches")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", product.id)
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .then(({ data }) => setBatches((data ?? []) as Batch[]));
  }, [open, product, tenantId]);

  const isIn = type === "stock_in" || type === "return";

  const submit = async () => {
    if (!product) return;
    const n = Number(qty);
    if (!n || n <= 0) return toast.error("Enter a quantity greater than zero");
    setSaving(true);

    let useBatch = batchId || null;
    if (isIn && !useBatch && newBatch.batch_number.trim()) {
      const { data, error } = await supabase.from("product_batches").insert({
        tenant_id: tenantId, product_id: product.id,
        batch_number: newBatch.batch_number.trim(),
        expiry_date: newBatch.expiry_date || null,
        quantity: 0,
        cost_price: Number(newBatch.cost_price) || 0,
        supplier_id: newBatch.supplier_id || null,
        storage_location: to || product.storage_location || null,
      }).select("id").single();
      if (error) { setSaving(false); return toast.error(error.message); }
      useBatch = data.id;
    }

    const delta = signedQuantity(type, type === "adjustment" ? (sign === "-" ? -n : n) : n);
    const { error } = await supabase.from("stock_movements").insert({
      tenant_id: tenantId, product_id: product.id, batch_id: useBatch,
      movement_type: type, quantity: delta,
      unit_cost: Number(newBatch.cost_price) || Number(product.cost_price) || 0,
      reason: reason || null, reference: reference || null,
      location_from: from || null, location_to: to || null,
      notes: notes || null, performed_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);

    if (type === "transfer" && useBatch && to) {
      await supabase.from("product_batches").update({ storage_location: to }).eq("id", useBatch);
    }
    toast.success(`${MOVEMENT_LABEL[type]} recorded`);
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{MOVEMENT_LABEL[type]}</DialogTitle>
          <DialogDescription>{product?.name} — on hand {product?.stock_qty}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Batch</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger><SelectValue placeholder={isIn ? "New batch (fill below)" : "Select batch"} /></SelectTrigger>
              <SelectContent>
                {batches.length === 0 && <SelectItem value="none" disabled>No batches recorded</SelectItem>}
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.batch_number} · {b.quantity} left {b.expiry_date ? `· exp ${b.expiry_date}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isIn && !batchId && (
            <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
              <div className="sm:col-span-2 text-xs font-medium text-muted-foreground">New batch details</div>
              <div className="space-y-1"><Label>Batch number</Label><Input value={newBatch.batch_number} onChange={(e) => setNewBatch({ ...newBatch, batch_number: e.target.value })} /></div>
              <div className="space-y-1"><Label>Expiry date</Label><Input type="date" value={newBatch.expiry_date} onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>Unit cost</Label><Input type="number" value={newBatch.cost_price} onChange={(e) => setNewBatch({ ...newBatch, cost_price: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Supplier</Label>
                <Select value={newBatch.supplier_id} onValueChange={(v) => setNewBatch({ ...newBatch, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.length === 0 && <SelectItem value="none" disabled>No suppliers</SelectItem>}
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {type === "adjustment" && (
              <div className="space-y-1">
                <Label>Direction</Label>
                <Select value={sign} onValueChange={(v) => setSign(v as "+" | "-")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+">Increase (+)</SelectItem>
                    <SelectItem value="-">Decrease (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1"><Label>Quantity *</Label><Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>{REASONS[type].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(type === "transfer" || type === "stock_out") && (
              <div className="space-y-1"><Label>From location</Label><Input value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            )}
            {(type === "transfer" || isIn) && (
              <div className="space-y-1"><Label>To location</Label><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Shelf B1 / Ward 3" /></div>
            )}
            <div className="space-y-1"><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO / invoice / requisition no." /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          {type === "transfer" && <p className="text-xs text-muted-foreground">Transfers move stock between locations without changing total quantity on hand.</p>}
        </div>
        <DialogFooter><Button onClick={() => void submit()} disabled={saving}>Record {MOVEMENT_LABEL[type].toLowerCase()}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
