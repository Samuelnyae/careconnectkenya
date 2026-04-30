import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { CalendarPlus, Video, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/appointments")({
  component: () => <ProtectedLayout><AppointmentsPage /></ProtectedLayout>,
});

type Appt = {
  id: string; scheduled_at: string; duration_minutes: number; status: string;
  reason: string | null; type: string; video_room_url: string | null;
  patient_id: string; doctor_id: string | null;
  patients: { full_name: string; phone: string | null } | null;
};
type PatientLite = { id: string; full_name: string; phone: string | null };

function AppointmentsPage() {
  const { currentTenantId, user } = useAuth();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", scheduled_at: "", duration_minutes: 30, reason: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("appointments")
        .select("id, scheduled_at, duration_minutes, status, reason, type, video_room_url, patient_id, doctor_id, patients(full_name, phone)")
        .eq("tenant_id", currentTenantId).order("scheduled_at", { ascending: false }).limit(100),
      supabase.from("patients").select("id, full_name, phone").eq("tenant_id", currentTenantId).order("full_name"),
    ]);
    setAppts((a ?? []) as unknown as Appt[]);
    setPatients((p ?? []) as PatientLite[]);
  }, [currentTenantId]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!currentTenantId || !user) return;
    if (!form.patient_id) return toast.error("Pick a patient");
    if (!form.scheduled_at) return toast.error("Pick date & time");
    setSaving(true);
    const { error } = await supabase.from("appointments").insert({
      tenant_id: currentTenantId, patient_id: form.patient_id, doctor_id: user.id,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes, type: "telemedicine",
      reason: form.reason || null, notes: form.notes || null, created_by: user.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment scheduled");
    setForm({ patient_id: "", scheduled_at: "", duration_minutes: 30, reason: "", notes: "" });
    setOpen(false);
    void load();
  };

  const tone = (s: string) =>
    s === "completed" ? "secondary" : s === "in_progress" ? "default" : s === "cancelled" ? "destructive" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telemedicine</h1>
          <p className="text-muted-foreground">Schedule and join video consultations.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><CalendarPlus className="mr-2 h-4 w-4" />New appointment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Schedule consultation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}{p.phone ? ` · ${p.phone}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date & time</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
                <div><Label>Duration (min)</Label><Input type="number" min={5} max={240} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 30 })} /></div>
              </div>
              <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. follow-up, fever" /></div>
              <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={() => void create()} disabled={saving} className="w-full">Schedule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Upcoming & recent ({appts.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {appts.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No appointments yet.</div>}
          {appts.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.patients?.full_name ?? "Patient"}</span>
                  <Badge variant={tone(a.status)}>{a.status.replace("_", " ")}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(a.scheduled_at).toLocaleString()} · {a.duration_minutes} min{a.reason ? ` · ${a.reason}` : ""}
                </div>
              </div>
              <Button asChild size="sm">
                <Link to="/consult/$id" params={{ id: a.id }}><Video className="mr-1 h-4 w-4" />Join</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}