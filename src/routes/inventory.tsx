import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Plus, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory")({
  component: () => <ProtectedLayout><InventoryPage /></ProtectedLayout>,
});

type Product = {
  id: string; name: string; sku: string | null; barcode: string | null; category: string | null;
  unit_price: number; cost_price: number; stock_qty: number; reorder_level: number;
  batch_number: string | null; expiry_date: string | null; supplier: string | null;
  image_url: string | null;
};

function InventoryPage() {
  const { currentTenantId } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "", sku: "", barcode: "", category: "", unit_price: "", cost_price: "",
    stock_qty: "", reorder_level: "10", batch_number: "", expiry_date: "", supplier: "",
    image_url: "",
  });

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const { data } = await supabase.from("products").select("*").eq("tenant_id", currentTenantId).order("name");
    setItems((data ?? []) as Product[]);
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!currentTenantId || !form.name.trim()) return;
    const { error } = await supabase.from("products").insert({
      tenant_id: currentTenantId,
      name: form.name.trim(),
      sku: form.sku || null,
      barcode: form.barcode || null,
      category: form.category || null,
      unit_price: Number(form.unit_price) || 0,
      cost_price: Number(form.cost_price) || 0,
      stock_qty: Number(form.stock_qty) || 0,
      reorder_level: Number(form.reorder_level) || 10,
      batch_number: form.batch_number || null,
      expiry_date: form.expiry_date || null,
      supplier: form.supplier || null,
      image_url: form.image_url || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Product added");
    setOpen(false);
    setForm({ name: "", sku: "", barcode: "", category: "", unit_price: "", cost_price: "", stock_qty: "", reorder_level: "10", batch_number: "", expiry_date: "", supplier: "", image_url: "" });
    void load();
  };

  const onUpload = async (file: File) => {
    if (!currentTenantId) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${currentTenantId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast.success("Image uploaded");
  };

  const statusBadge = (p: Product) => {
    if (p.stock_qty === 0) return <Badge variant="destructive">Out of stock</Badge>;
    if (p.stock_qty <= p.reorder_level) return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90"><AlertTriangle className="mr-1 h-3 w-3" />Low</Badge>;
    if (p.expiry_date) {
      const days = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000);
      if (days <= 60) return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90"><Clock className="mr-1 h-3 w-3" />Expiring</Badge>;
    }
    return <Badge className="bg-success text-success-foreground hover:bg-success/90">OK</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track stock, batches, and expiry dates.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-[#0a3d2e] text-white hover:bg-[#0a3d2e]/90 shadow-[var(--shadow-glow)]"><Plus className="mr-2 h-4 w-4" />Add product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add product</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>Product image</Label>
                <div className="flex items-center gap-3">
                  {form.image_url ? (
                    <img src={form.image_url} alt="preview" className="h-16 w-16 rounded-md object-cover border" />
                  ) : (
                    <div className="h-16 w-16 rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">No image</div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }}
                    className="cursor-pointer"
                  />
                </div>
                {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
              </div>
              <div className="sm:col-span-2 space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div className="space-y-1"><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
              <div className="space-y-1"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div className="space-y-1"><Label>Supplier</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
              <div className="space-y-1"><Label>Unit price (KSh)</Label><Input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
              <div className="space-y-1"><Label>Cost price (KSh)</Label><Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
              <div className="space-y-1"><Label>Stock qty</Label><Input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} /></div>
              <div className="space-y-1"><Label>Reorder level</Label><Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></div>
              <div className="space-y-1"><Label>Batch number</Label><Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></div>
              <div className="space-y-1"><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => void save()} disabled={!form.name.trim()}>Save product</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All products ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No products yet. Click "Add product" to start.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.batch_number && <div className="text-xs text-muted-foreground">Batch {p.batch_number}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                      <TableCell>KSh {Number(p.unit_price).toLocaleString()}</TableCell>
                      <TableCell>{p.stock_qty}</TableCell>
                      <TableCell className="text-muted-foreground">{p.expiry_date ?? "—"}</TableCell>
                      <TableCell>{statusBadge(p)}</TableCell>
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
