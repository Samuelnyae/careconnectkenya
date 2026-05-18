import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Plus, AlertOctagon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/medication-losses")({
  component: () => <ProtectedLayout><MedicationLossesPage /></ProtectedLayout>,
});

type Loss = {
  id: string; product_name: string; quantity: number; unit_cost: number; total_cost: number;
  reason: string; batch_number: string | null; notes: string | null; occurred_at: string; product_id: string | null;
};
type ProductLite = { id: string; name: string; cost_price: number; batch_number: string | null };

const REASONS = [
  { value: "expired", label: "Expired" },
  { value: "damaged", label: "Damaged" },
  { value: "theft", label: "Theft" },
  { value: "lost", label: "Lost / Misplaced" },
  { value: "recall", label: "Recall" },
  { value: "other", label: "Other" },
];

function MedicationLossesPage() {
  const { currentTenantId, user } = useAuth();
  const [items, setItems] = useState<Loss[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", product_name: "", quantity: "1", unit_cost: "0", reason: "expired", batch_number: "", notes: "" });

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const [l, p] = await Promise.all([
      supabase.from("medication_losses").select("*").eq("tenant_id", currentTenantId).order("occurred_at", { ascending: false }).limit(200),
      supabase.from("products").select("id, name, cost_price, batch_number").eq("tenant_id", currentTenantId).order("name"),
    ]);
    setItems((l.data ?? []) as Loss[]);
    setProducts((p.data ?? []) as ProductLite[]);
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const last30 = items.filter((i) => Date.now() - new Date(i.occurred_at).getTime() < 30 * 86400000);
    return {
      count: items.length,
      value: items.reduce((s, i) => s + Number(i.total_cost || 0), 0),
      recent: last30.length,
      recentValue: last30.reduce((s, i) => s + Number(i.total_cost || 0), 0),
    };
  }, [items]);

  const onPick = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (p) setForm((f) => ({ ...f, product_id: p.id, product_name: p.name, unit_cost: String(p.cost_price ?? 0), batch_number: p.batch_number ?? "" }));
  };

  const save = async () => {
    if (!currentTenantId || !form.product_name.trim()) return;
    const qty = Number(form.quantity) || 0;
    const unit = Number(form.unit_cost) || 0;
    const { error } = await supabase.from("medication_losses").insert({
      tenant_id: currentTenantId,
      product_id: form.product_id || null,
      product_name: form.product_name.trim(),
      quantity: qty,
      unit_cost: unit,
      total_cost: qty * unit,
      reason: form.reason,
      batch_number: form.batch_number || null,
      notes: form.notes || null,
      recorded_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Loss recorded");
    setOpen(false);
    setForm({ product_id: "", product_name: "", quantity: "1", unit_cost: "0", reason: "expired", batch_number: "", notes: "" });
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><AlertOctagon className="h-7 w-7 text-destructive" /> Medication Losses</h1>
          <p className="text-muted-foreground">Track wastage, theft, and expiry to cut leakage.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Record loss</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Record medication loss</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Product (optional)</Label>
                <Select value={form.product_id} onValueChange={onPick}>
                  <SelectTrigger><SelectValue placeholder="Select from inventory" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Product name *</Label><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                <div className="space-y-1"><Label>Unit cost (KSh)</Label><Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Batch number</Label><Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></div>
              <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => void save()}>Save loss</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total events</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.count}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total value lost</CardTitle></CardHeader><CardContent className="text-2xl font-bold">KSh {totals.value.toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Last 30 days</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.recent}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Last 30 days value</CardTitle></CardHeader><CardContent className="text-2xl font-bold">KSh {totals.recentValue.toLocaleString()}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All losses</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No losses recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Reason</TableHead><TableHead>Qty</TableHead><TableHead>Value</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs text-muted-foreground">{new Date(i.occurred_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{i.product_name}{i.batch_number && <div className="text-xs text-muted-foreground">Batch {i.batch_number}</div>}</TableCell>
                      <TableCell><Badge variant={i.reason === "theft" ? "destructive" : "secondary"}>{i.reason}</Badge></TableCell>
                      <TableCell>{i.quantity}</TableCell>
                      <TableCell>KSh {Number(i.total_cost).toLocaleString()}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{i.notes ?? "—"}</TableCell>
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