import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Trash2, Search } from "lucide-react";
import { KENYA_COUNTIES } from "@/lib/kenya-counties";

export const Route = createFileRoute("/admin/tenants")({
  component: TenantsPage,
});

type Tenant = {
  id: string; name: string; slug: string; type: string; county: string | null; created_at: string;
};

const TYPES = ["pharmacy", "clinic", "hospital", "lab", "chemist", "other"];

function TenantsPage() {
  const [rows, setRows] = useState<Tenant[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Tenant | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("tenants").select("id, name, slug, type, county, created_at").order("created_at", { ascending: false });
    setRows((data ?? []) as Tenant[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}" and all its data? This cannot be undone.`)) return;
    const { error } = await supabase.from("tenants").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Organization deleted");
    void load();
  };

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase.from("tenants").update({
      name: editing.name.trim(),
      type: editing.type,
      county: editing.county || null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    void load();
  };

  const filtered = rows.filter((t) =>
    !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.slug.toLowerCase().includes(q.toLowerCase()) || (t.county ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="text-muted-foreground">All tenants on the platform.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / slug / county" className="pl-8" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{filtered.length} organizations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead>Type</TableHead><TableHead>County</TableHead><TableHead>Created</TableHead><TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs">{t.slug}</TableCell>
                  <TableCell><Badge variant="secondary">{t.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{t.county ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void remove(t.id, t.name)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No organizations</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit organization</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>County</Label>
                <Select value={editing.county ?? ""} onValueChange={(v) => setEditing({ ...editing, county: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="max-h-72">{KENYA_COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void save()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}