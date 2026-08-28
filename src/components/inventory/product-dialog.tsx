import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Product, Supplier } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  suppliers: Supplier[];
  product?: Product | null;
  onSaved: () => void;
};

const empty = {
  name: "", sku: "", barcode: "", category: "", manufacturer: "", dosage_form: "",
  strength: "", unit_of_measure: "", storage_location: "", unit_price: "", cost_price: "",
  stock_qty: "", reorder_level: "10", batch_number: "", expiry_date: "", supplier_id: "",
  image_url: "", notes: "",
};

export function ProductDialog({ open, onOpenChange, tenantId, suppliers, product, onSaved }: Props) {
  const [form, setForm] = useState({ ...empty });
  const [controlled, setControlled] = useState(false);
  const [active, setActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const editing = !!product;

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name, sku: product.sku ?? "", barcode: product.barcode ?? "",
        category: product.category ?? "", manufacturer: product.manufacturer ?? "",
        dosage_form: product.dosage_form ?? "", strength: product.strength ?? "",
        unit_of_measure: product.unit_of_measure ?? "", storage_location: product.storage_location ?? "",
        unit_price: String(product.unit_price), cost_price: String(product.cost_price),
        stock_qty: String(product.stock_qty), reorder_level: String(product.reorder_level),
        batch_number: product.batch_number ?? "", expiry_date: product.expiry_date ?? "",
        supplier_id: product.supplier_id ?? "", image_url: product.image_url ?? "", notes: "",
      });
      setControlled(product.is_controlled);
      setActive(product.is_active);
    } else {
      setForm({ ...empty });
      setControlled(false);
      setActive(true);
    }
  }, [open, product]);

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${tenantId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    set("image_url", data.publicUrl);
    setUploading(false);
    toast.success("Image uploaded");
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      sku: form.sku || null,
      barcode: form.barcode || null,
      category: form.category || null,
      manufacturer: form.manufacturer || null,
      dosage_form: form.dosage_form || null,
      strength: form.strength || null,
      unit_of_measure: form.unit_of_measure || null,
      storage_location: form.storage_location || null,
      unit_price: Number(form.unit_price) || 0,
      cost_price: Number(form.cost_price) || 0,
      reorder_level: Number(form.reorder_level) || 0,
      batch_number: form.batch_number || null,
      expiry_date: form.expiry_date || null,
      supplier_id: form.supplier_id || null,
      supplier: suppliers.find((s) => s.id === form.supplier_id)?.name ?? null,
      image_url: form.image_url || null,
      is_controlled: controlled,
      is_active: active,
    };

    if (editing && product) {
      const { error } = await supabase.from("products").update(payload).eq("id", product.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Product updated");
    } else {
      const openingQty = Number(form.stock_qty) || 0;
      const { data, error } = await supabase
        .from("products")
        .insert({ ...payload, stock_qty: 0 })
        .select("id")
        .single();
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
      if (openingQty > 0) {
        const { data: batch } = await supabase.from("product_batches").insert({
          tenant_id: tenantId, product_id: data.id,
          batch_number: form.batch_number || "OPENING",
          expiry_date: form.expiry_date || null,
          quantity: 0,
          cost_price: Number(form.cost_price) || 0,
          supplier_id: form.supplier_id || null,
          storage_location: form.storage_location || null,
        }).select("id").single();
        await supabase.from("stock_movements").insert({
          tenant_id: tenantId, product_id: data.id, batch_id: batch?.id ?? null,
          movement_type: "stock_in", quantity: openingQty,
          unit_cost: Number(form.cost_price) || 0,
          reason: "Opening stock", reference: "OPENING",
          location_to: form.storage_location || null,
        });
      }
      setSaving(false);
      toast.success("Product added");
    }
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label>Product image</Label>
            <div className="flex items-center gap-3">
              {form.image_url ? (
                <img src={form.image_url} alt="preview" className="h-16 w-16 rounded-md object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">No image</div>
              )}
              <Input type="file" accept="image/*" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }} className="cursor-pointer" />
            </div>
          </div>
          <div className="sm:col-span-2 space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1"><Label>SKU</Label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} /></div>
          <div className="space-y-1"><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} /></div>
          <div className="space-y-1"><Label>Category</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Antibiotics" /></div>
          <div className="space-y-1"><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></div>
          <div className="space-y-1"><Label>Dosage form</Label><Input value={form.dosage_form} onChange={(e) => set("dosage_form", e.target.value)} placeholder="Tablet / Syrup" /></div>
          <div className="space-y-1"><Label>Strength</Label><Input value={form.strength} onChange={(e) => set("strength", e.target.value)} placeholder="500mg" /></div>
          <div className="space-y-1"><Label>Unit of measure</Label><Input value={form.unit_of_measure} onChange={(e) => set("unit_of_measure", e.target.value)} placeholder="Pack of 10" /></div>
          <div className="space-y-1"><Label>Storage location</Label><Input value={form.storage_location} onChange={(e) => set("storage_location", e.target.value)} placeholder="Shelf A2 / Cold room" /></div>
          <div className="space-y-1">
            <Label>Supplier</Label>
            <Select value={form.supplier_id} onValueChange={(v) => set("supplier_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.length === 0 && <SelectItem value="none" disabled>No suppliers yet</SelectItem>}
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Unit price (KSh)</Label><Input type="number" value={form.unit_price} onChange={(e) => set("unit_price", e.target.value)} /></div>
          <div className="space-y-1"><Label>Cost price (KSh)</Label><Input type="number" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} /></div>
          {!editing && (
            <div className="space-y-1"><Label>Opening stock qty</Label><Input type="number" value={form.stock_qty} onChange={(e) => set("stock_qty", e.target.value)} /></div>
          )}
          <div className="space-y-1"><Label>Reorder level</Label><Input type="number" value={form.reorder_level} onChange={(e) => set("reorder_level", e.target.value)} /></div>
          <div className="space-y-1"><Label>Batch number</Label><Input value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} /></div>
          <div className="space-y-1"><Label>Expiry date</Label><Input type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><Label>Controlled drug</Label><p className="text-xs text-muted-foreground">Requires stricter tracking</p></div>
            <Switch checked={controlled} onCheckedChange={setControlled} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><Label>Active</Label><p className="text-xs text-muted-foreground">Inactive items are hidden from POS</p></div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          {editing && (
            <div className="sm:col-span-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Stock on hand ({product?.stock_qty}) can only change through stock movements — use Stock in / out / adjust so the audit trail stays intact.
            </div>
          )}
          {!editing && (
            <div className="sm:col-span-2 space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving || !form.name.trim()}>
            {editing ? "Save changes" : "Save product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
