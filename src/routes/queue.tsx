import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  OPEN_QUEUE_STAGES, QUEUE_STAGES, canEditClinical, followUpStatus, queueStageLabel, waitMinutes,
} from "@/lib/patients";
import { ClipboardList, Clock, UserCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Patient queue & follow-ups — CareConnect" },
      { name: "description", content: "Check patients in, move them through triage, consultation, lab and pharmacy, and work through follow-ups that are due." },
      { property: "og:title", content: "Patient queue & follow-ups — CareConnect" },
      { property: "og:description", content: "Live clinic worklist: check-in, triage, consultation, lab, pharmacy and due follow-ups." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ProtectedLayout><QueuePage /></ProtectedLayout>,
});

type QueueRow = {
  id: string; patient_id: string; stage: string; priority: string; department: string | null;
  reason: string | null; arrived_at: string;
  patients: { full_name: string; mrn: string | null; phone: string | null } | null;
};
type FollowUpRow = {
  id: string; patient_id: string; due_on: string; reason: string; status: string; provider: string | null;
  patients: { full_name: string; mrn: string | null; phone: string | null } | null;
};
type PatientLite = { id: string; full_name: string; mrn: string | null };

function QueuePage() {
  const { currentTenantId, currentRole, user } = useAuth();
  const canEdit = canEditClinical(currentRole);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", priority: "normal", department: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: q }, { data: f }, { data: p }] = await Promise.all([
      supabase.from("patient_queue")
        .select("id, patient_id, stage, priority, department, reason, arrived_at, patients(full_name, mrn, phone)")
        .eq("tenant_id", currentTenantId).order("arrived_at", { ascending: true }).limit(200),
      supabase.from("patient_followups")
        .select("id, patient_id, due_on, reason, status, provider, patients(full_name, mrn, phone)")
        .eq("tenant_id", currentTenantId).eq("status", "upcoming").lte("due_on", today).order("due_on", { ascending: true }).limit(100),
      supabase.from("patients").select("id, full_name, mrn").eq("tenant_id", currentTenantId).order("full_name"),
    ]);
    setQueue((q ?? []) as unknown as QueueRow[]);
    setFollowUps((f ?? []) as unknown as FollowUpRow[]);
    setPatients((p ?? []) as PatientLite[]);
  }, [currentTenantId]);
  useEffect(() => { void load(); }, [load]);

  const active = useMemo(() => queue.filter((r) => OPEN_QUEUE_STAGES.includes(r.stage as never)), [queue]);
  const closed = useMemo(() => queue.filter((r) => !OPEN_QUEUE_STAGES.includes(r.stage as never)).slice(0, 20), [queue]);

  const checkIn = async () => {
    if (!currentTenantId || !user) return;
    if (!form.patient_id) return toast.error("Pick a patient");
    setSaving(true);
    const { error } = await supabase.from("patient_queue").insert({
      tenant_id: currentTenantId, patient_id: form.patient_id, created_by: user.id,
      stage: "waiting", priority: form.priority,
      department: form.department || null, reason: form.reason || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Patient checked in");
    setForm({ patient_id: "", priority: "normal", department: "", reason: "" });
    setOpen(false);
    void load();
  };

  const setStage = async (id: string, stage: string) => {
    const patch: Record<string, unknown> = { stage };
    if (stage === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("patient_queue").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const closeFollowUp = async (id: string) => {
    const { error } = await supabase.from("patient_followups").update({ status: "completed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Follow-up marked done");
    void load();
  };

  const priorityTone = (p: string) => (p === "emergency" ? "destructive" : p === "urgent" ? "default" : "secondary");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Queue & follow-ups</h1>
          <p className="text-muted-foreground">Today's clinic worklist, from check-in to pharmacy.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserCheck className="mr-2 h-4 w-4" />Check in patient</Button></DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader><DialogTitle>Check in patient</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Patient</Label>
                  <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}{p.mrn ? ` · ${p.mrn}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Outpatient" /></div>
                </div>
                <div><Label>Reason for visit</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                <Button onClick={() => void checkIn()} disabled={saving} className="w-full">Check in</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />In the clinic ({active.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {active.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Nobody is waiting right now.</div>}
          {active.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.patients?.full_name ?? "Patient"}</span>
                  {r.patients?.mrn && <span className="font-mono text-xs text-muted-foreground">{r.patients.mrn}</span>}
                  <Badge variant={priorityTone(r.priority)} className="capitalize">{r.priority}</Badge>
                  <Badge variant="outline">{queueStageLabel(r.stage)}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Waiting {waitMinutes(r.arrived_at)} min{r.department ? ` · ${r.department}` : ""}{r.reason ? ` · ${r.reason}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEdit && (
                  <Select value={r.stage} onValueChange={(v) => void setStage(r.id, v)}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QUEUE_STAGES.map((s) => <SelectItem key={s} value={s}>{queueStageLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button asChild size="sm" variant="outline"><Link to="/patients/$id" params={{ id: r.patient_id }}>Open record</Link></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Follow-ups due ({followUps.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {followUps.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No follow-ups due.</div>}
          {followUps.map((f) => {
            const state = followUpStatus(f.status, f.due_on);
            return (
              <div key={f.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.patients?.full_name ?? "Patient"}</span>
                    <Badge variant={state === "overdue" ? "destructive" : "default"}>{queueStageLabel(state)}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {f.reason} · due {new Date(`${f.due_on}T00:00:00`).toLocaleDateString()}{f.provider ? ` · ${f.provider}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canEdit && <Button size="sm" variant="secondary" onClick={() => void closeFollowUp(f.id)}>Mark done</Button>}
                  <Button asChild size="sm" variant="outline"><Link to="/patients/$id" params={{ id: f.patient_id }}>Open record</Link></Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {closed.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recently closed</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {closed.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2">
                <span>{r.patients?.full_name ?? "Patient"}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline">{queueStageLabel(r.stage)}</Badge>
                  {new Date(r.arrived_at).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
