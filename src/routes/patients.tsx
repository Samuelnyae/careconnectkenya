import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/patients")({
  component: () => <ProtectedLayout><PatientsPage /></ProtectedLayout>,
});

type Patient = {
  id: string; full_name: string; date_of_birth: string | null; gender: string | null;
  phone: string | null; sha_number: string | null; allergies: string | null; chronic_conditions: string | null;
};

function PatientsPage() {
  const { currentTenantId, user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", date_of_birth: "", gender: "", phone: "", email: "", national_id: "", sha_number: "", address: "", allergies: "", chronic_conditions: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const { data } = await supabase.from("patients").select("id, full_name, date_of_birth, gender, phone, sha_number, allergies, chronic_conditions").eq("tenant_id", currentTenantId).order("full_name");
    setPatients((data ?? []) as Patient[]);
  }, [currentTenantId]);
  useEffect(() => { void load(); }, [load]);

  const filtered = patients.filter((p) => {
    const s = q.toLowerCase().trim();
    if (!s) return true;
    return p.full_name.toLowerCase().includes(s) || (p.phone ?? "").includes(s) || (p.sha_number ?? "").toLowerCase().includes(s);
  });

  const save = async () => {
    if (!currentTenantId || !user || !form.full_name.trim()) return toast.error("Name required");
    setSaving(true);
    const { error } = await supabase.from("patients").insert({
      tenant_id: currentTenantId,
      created_by: user.id,
      full_name: form.full_name.trim(),
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      phone: form.phone || null,
      email: form.email || null,
      national_id: form.national_id || null,
      sha_number: form.sha_number || null,
      address: form.address || null,
      allergies: form.allergies || null,
      chronic_conditions: form.chronic_conditions || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Patient added");
    setForm({ full_name: "", date_of_birth: "", gender: "", phone: "", email: "", national_id: "", sha_number: "", address: "", allergies: "", chronic_conditions: "", notes: "" });
    setOpen(false);
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">Manage patient records and visit history.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><UserPlus className="mr-2 h-4 w-4" />Add Patient</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New patient</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
              <div>
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>National ID</Label><Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></div>
              <div><Label>SHA number</Label><Input value={form.sha_number} onChange={(e) => setForm({ ...form, sha_number: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Allergies</Label><Textarea rows={2} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="e.g. penicillin, sulfa" /></div>
              <div className="sm:col-span-2"><Label>Chronic conditions</Label><Textarea rows={2} value={form.chronic_conditions} onChange={(e) => setForm({ ...form, chronic_conditions: e.target.value })} placeholder="e.g. hypertension, diabetes" /></div>
              <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={() => void save()} disabled={saving} className="mt-2">Save patient</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, SHA…" className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>SHA</TableHead>
                <TableHead>Allergies</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.date_of_birth ?? "—"}</TableCell>
                  <TableCell className="capitalize">{p.gender ?? "—"}</TableCell>
                  <TableCell>{p.phone ?? "—"}</TableCell>
                  <TableCell>{p.sha_number ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{p.allergies ?? "—"}</TableCell>
                  <TableCell><Button asChild size="sm" variant="outline"><Link to="/patients/$id" params={{ id: p.id }}>Open</Link></Button></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No patients yet. Click <strong>Add Patient</strong> above.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}