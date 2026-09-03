import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Supplier } from "./types";

const empty = { name: "", contact_person: "", phone: "", email: "", address: "", lead_time_days: "7", notes: "" };

export function SuppliersTab({ tenantId, suppliers, canManage, onChanged }: {
  tenantId: string; suppliers: Supplier[]; canManage: boolean; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ ...empty });

  const start = (s?: Supplier) => {
    if (s) {
      setEditing(s);
      setForm({
        name: s.name, contact_person: s.contact_person ?? "", phone: s.phone ?? "",
        email: s.email ?? "", address: s.address ?? "", lead_time_days: String(s.lead_time_days),
        notes: s.notes ?? "",
      });
    } else { setEditing(null); setForm({ ...empty }); }
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const payload = {
      tenant_id: tenantId, name: form.name.trim(),
      contact_person: form.contact_person || null, phone: form.phone || null,
      email: form.email || null, address: form.address || null,
      lead_time_days: Number(form.lead_time_days) || 7, notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Supplier updated" : "Supplier added");
    setOpen(false);
    onChanged();
  };

  const toggleActive = async (s: Supplier) => {
    const { error } = await supabase.from("suppliers").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Suppliers ({suppliers.length})</CardTitle>
        {canManage && <Button size="sm" onClick={() => start()}><Plus className="mr-1 h-4 w-4" />Add supplier</Button>}
      </CardHeader>
      <CardContent>
        {suppliers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No suppliers yet. Add one to link purchases and batches.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Lead time</TableHead>
                <TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.address ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.contact_person ?? "—"}<br />{s.phone ?? ""} {s.email ?? ""}
                    </TableCell>
                    <TableCell>{s.lead_time_days}d</TableCell>
                    <TableCell>
                      {s.is_active
                        ? <Badge className="bg-success text-success-foreground">Active</Badge>
                        : <Badge variant="outline">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => start(s)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => void toggleActive(s)}>
                            {s.is_active ? "Disable" : "Enable"}
                          </Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>Lead time (days)</Label><Input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-1"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-1"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => void save()} disabled={!form.name.trim()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
