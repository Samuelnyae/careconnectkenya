import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Send, CheckCircle2, XCircle, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/claims")({
  component: () => <ProtectedLayout><ClaimsPage /></ProtectedLayout>,
});

type ClaimStatus = "draft" | "submitted" | "approved" | "rejected" | "paid";
type Patient = { id: string; full_name: string; sha_number: string | null };
type Claim = {
  id: string;
  claim_number: string | null;
  patient_id: string;
  patients: { full_name: string; sha_number: string | null } | null;
  services_rendered: string | null;
  diagnosis: string | null;
  amount_claimed: number;
  amount_approved: number | null;
  status: ClaimStatus;
  submission_date: string | null;
  response_date: string | null;
  rejection_reason: string | null;
  created_at: string;
};

const STATUS_TONE: Record<ClaimStatus, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "outline",
  submitted: "default",
  approved: "secondary",
  rejected: "destructive",
  paid: "secondary",
};

function ClaimsPage() {
  const { currentTenantId, user, currentRole } = useAuth();
  const canManage = ["owner", "admin", "pharmacist", "staff"].includes(currentRole ?? "");
  const canDelete = ["owner", "admin"].includes(currentRole ?? "");

  const [claims, setClaims] = useState<Claim[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | ClaimStatus>("all");
  const [form, setForm] = useState({
    patient_id: "", claim_number: "", services_rendered: "", diagnosis: "",
    amount_claimed: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const { data } = await supabase
      .from("sha_claims")
      .select("id, claim_number, patient_id, services_rendered, diagnosis, amount_claimed, amount_approved, status, submission_date, response_date, rejection_reason, created_at, patients(full_name, sha_number)")
      .eq("tenant_id", currentTenantId)
      .order("created_at", { ascending: false });
    setClaims((data ?? []) as unknown as Claim[]);
    const { data: p } = await supabase.from("patients").select("id, full_name, sha_number").eq("tenant_id", currentTenantId).order("full_name");
    setPatients((p ?? []) as Patient[]);
  }, [currentTenantId]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => filter === "all" ? claims : claims.filter((c) => c.status === filter), [claims, filter]);

  const totals = useMemo(() => {
    const sum = (s: ClaimStatus) => claims.filter((c) => c.status === s).reduce((a, c) => a + Number(c.amount_claimed), 0);
    return {
      submitted: sum("submitted"),
      approved: claims.filter((c) => c.status === "approved").reduce((a, c) => a + Number(c.amount_approved ?? c.amount_claimed), 0),
      paid: claims.filter((c) => c.status === "paid").reduce((a, c) => a + Number(c.amount_approved ?? c.amount_claimed), 0),
      rejected: sum("rejected"),
    };
  }, [claims]);

  const save = async () => {
    if (!currentTenantId || !user) return;
    if (!form.patient_id) return toast.error("Select a patient");
    if (!form.amount_claimed) return toast.error("Enter an amount");
    setSaving(true);
    const { error } = await supabase.from("sha_claims").insert({
      tenant_id: currentTenantId,
      created_by: user.id,
      patient_id: form.patient_id,
      claim_number: form.claim_number || null,
      services_rendered: form.services_rendered || null,
      diagnosis: form.diagnosis || null,
      amount_claimed: Number(form.amount_claimed),
      notes: form.notes || null,
      status: "draft",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Claim drafted");
    setForm({ patient_id: "", claim_number: "", services_rendered: "", diagnosis: "", amount_claimed: "", notes: "" });
    setOpen(false);
    void load();
  };

  const updateStatus = async (id: string, status: ClaimStatus, extra: { amount_approved?: number; rejection_reason?: string } = {}) => {
    const patch: {
      status: ClaimStatus;
      submission_date?: string;
      response_date?: string;
      amount_approved?: number;
      rejection_reason?: string;
    } = { status, ...extra };
    if (status === "submitted") patch.submission_date = new Date().toISOString();
    if (status === "approved" || status === "rejected" || status === "paid") patch.response_date = new Date().toISOString();
    const { error } = await supabase.from("sha_claims").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Claim ${status}`);
    void load();
  };

  const removeClaim = async (id: string) => {
    if (!confirm("Delete this claim?")) return;
    const { error } = await supabase.from("sha_claims").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Claim deleted");
    void load();
  };

  const fmt = (n: number | null | undefined) => "KSh " + Number(n ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SHA Claims</h1>
          <p className="text-muted-foreground">Manage Social Health Authority insurance claims.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />New claim</Button></DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New SHA claim</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Patient *</Label>
                  <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.length === 0 && <div className="p-3 text-sm text-muted-foreground">No patients yet</div>}
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}{p.sha_number ? ` (SHA: ${p.sha_number})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Claim number</Label><Input value={form.claim_number} onChange={(e) => setForm({ ...form, claim_number: e.target.value })} placeholder="Auto / from SHA portal" /></div>
                <div><Label>Amount claimed (KSh) *</Label><Input type="number" min="0" value={form.amount_claimed} onChange={(e) => setForm({ ...form, amount_claimed: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Diagnosis</Label><Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Services rendered</Label><Textarea rows={3} value={form.services_rendered} onChange={(e) => setForm({ ...form, services_rendered: e.target.value })} placeholder="Consultation, lab tests, medications…" /></div>
                <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <Button onClick={() => void save()} disabled={saving} className="mt-2">Save as draft</Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Submitted" value={fmt(totals.submitted)} icon={Send} tone="primary" />
        <KPI label="Approved" value={fmt(totals.approved)} icon={CheckCircle2} tone="success" />
        <KPI label="Paid" value={fmt(totals.paid)} icon={Wallet} tone="success" />
        <KPI label="Rejected" value={fmt(totals.rejected)} icon={XCircle} tone="destructive" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Claims ({filtered.length})</CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>SHA #</TableHead>
                <TableHead>Claim #</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead className="text-right">Claimed</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.patients?.full_name ?? "—"}</TableCell>
                  <TableCell>{c.patients?.sha_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.claim_number ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{c.diagnosis ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmt(c.amount_claimed)}</TableCell>
                  <TableCell className="text-right">{c.amount_approved != null ? fmt(c.amount_approved) : "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_TONE[c.status]}>{c.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="flex gap-1">
                    {canManage && c.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => void updateStatus(c.id, "submitted")}>Submit</Button>
                    )}
                    {canManage && c.status === "submitted" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => {
                          const v = prompt("Approved amount (KSh)", String(c.amount_claimed));
                          if (v == null) return;
                          void updateStatus(c.id, "approved", { amount_approved: Number(v) });
                        }}>Approve</Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                          const r = prompt("Rejection reason");
                          if (!r) return;
                          void updateStatus(c.id, "rejected", { rejection_reason: r });
                        }}>Reject</Button>
                      </>
                    )}
                    {canManage && c.status === "approved" && (
                      <Button size="sm" variant="outline" onClick={() => void updateStatus(c.id, "paid")}>Mark paid</Button>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void removeClaim(c.id)}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">No claims yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${tone}/10 text-${tone}`}><Icon className="h-4 w-4" /></div>
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}