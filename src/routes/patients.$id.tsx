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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useServerFn } from "@tanstack/react-start";
import { sendQuickMessage } from "@/lib/messaging.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Stethoscope, Pill, AlertTriangle, ShieldCheck, Loader2, MessageSquare, FlaskConical, Bell, Upload, ExternalLink, HeartPulse } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/patients/$id")({
  component: () => <ProtectedLayout><PatientDetail /></ProtectedLayout>,
});

type Patient = {
  id: string; full_name: string; date_of_birth: string | null; gender: string | null;
  phone: string | null; email: string | null; sha_number: string | null;
  national_id: string | null; address: string | null;
  allergies: string | null; chronic_conditions: string | null; notes: string | null;
  whatsapp_number: string | null; telegram_chat_id: string | null;
  preferred_channels: string[] | null; is_chronic: boolean; chronic_review_date: string | null;
};
type Visit = { id: string; visit_date: string; reason: string | null; diagnosis: string | null; notes: string | null };
type Rx = { id: string; drug_name: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null; created_at: string };
type Lab = { id: string; test_name: string; test_category: string | null; result_value: string | null; result_unit: string | null; reference_range: string | null; status: string; notes: string | null; file_url: string | null; performed_at: string };
type Reminder = { id: string; reminder_type: string; message: string; channels: string[]; scheduled_at: string; sent_at: string | null; status: string; error_message: string | null };

type Interaction = { type: string; severity: "mild" | "moderate" | "severe"; drugs_involved: string[]; description: string; recommendation: string };
type AIReport = { overall_risk: "safe" | "caution" | "danger"; summary: string; interactions: Interaction[] };

const ALL_CHANNELS = ["sms", "whatsapp", "telegram"] as const;

function PatientDetail() {
  const { id } = Route.useParams();
  const { currentTenantId, user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [rx, setRx] = useState<Rx[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [visitOpen, setVisitOpen] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [remOpen, setRemOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [visitForm, setVisitForm] = useState({ reason: "", diagnosis: "", notes: "" });
  const [rxForm, setRxForm] = useState({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  const [labForm, setLabForm] = useState({ test_name: "", test_category: "", result_value: "", result_unit: "", reference_range: "", status: "normal", notes: "", file: null as File | null });
  const [remForm, setRemForm] = useState({ reminder_type: "medication", message: "", scheduled_at: "", channels: ["sms"] as string[] });
  const [msgForm, setMsgForm] = useState({ message: "", channels: ["sms"] as string[] });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [sending, setSending] = useState(false);
  const sendQuick = useServerFn(sendQuickMessage);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
    setPatient((p ?? null) as Patient | null);
    const { data: v } = await supabase.from("patient_visits").select("id, visit_date, reason, diagnosis, notes").eq("patient_id", id).order("visit_date", { ascending: false });
    setVisits((v ?? []) as Visit[]);
    const { data: r } = await supabase.from("prescriptions").select("id, drug_name, dosage, frequency, duration, instructions, created_at").eq("patient_id", id).order("created_at", { ascending: false });
    setRx((r ?? []) as Rx[]);
    const { data: l } = await supabase.from("lab_results").select("id, test_name, test_category, result_value, result_unit, reference_range, status, notes, file_url, performed_at").eq("patient_id", id).order("performed_at", { ascending: false });
    setLabs((l ?? []) as Lab[]);
    const { data: rm } = await supabase.from("reminders").select("id, reminder_type, message, channels, scheduled_at, sent_at, status, error_message").eq("patient_id", id).order("scheduled_at", { ascending: false }).limit(20);
    setReminders((rm ?? []) as Reminder[]);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const updatePatient = async (patch: Record<string, unknown>) => {
    if (!patient) return;
    const { error } = await supabase.from("patients").update(patch as never).eq("id", patient.id);
    if (error) return toast.error(error.message);
    setPatient({ ...patient, ...(patch as Partial<Patient>) });
    toast.success("Updated");
  };

  const addVisit = async () => {
    if (!currentTenantId || !user) return;
    const { error } = await supabase.from("patient_visits").insert({
      tenant_id: currentTenantId, patient_id: id, attended_by: user.id,
      reason: visitForm.reason || null, diagnosis: visitForm.diagnosis || null, notes: visitForm.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Visit recorded");
    setVisitForm({ reason: "", diagnosis: "", notes: "" });
    setVisitOpen(false);
    void load();
  };

  const addRx = async () => {
    if (!currentTenantId || !user || !rxForm.drug_name.trim()) return toast.error("Drug name required");
    const { error } = await supabase.from("prescriptions").insert({
      tenant_id: currentTenantId, patient_id: id, prescribed_by: user.id,
      drug_name: rxForm.drug_name.trim(),
      dosage: rxForm.dosage || null, frequency: rxForm.frequency || null,
      duration: rxForm.duration || null, instructions: rxForm.instructions || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Prescription added");
    setRxForm({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "" });
    setRxOpen(false);
    void load();
  };

  const addLab = async () => {
    if (!currentTenantId || !user || !labForm.test_name.trim()) return toast.error("Test name required");
    let file_url: string | null = null;
    if (labForm.file) {
      const path = `${currentTenantId}/${id}/${Date.now()}-${labForm.file.name}`;
      const { error: upErr } = await supabase.storage.from("lab-results").upload(path, labForm.file);
      if (upErr) return toast.error(upErr.message);
      file_url = path;
    }
    const { error } = await supabase.from("lab_results").insert({
      tenant_id: currentTenantId, patient_id: id, ordered_by: user.id, created_by: user.id,
      test_name: labForm.test_name.trim(),
      test_category: labForm.test_category || null,
      result_value: labForm.result_value || null,
      result_unit: labForm.result_unit || null,
      reference_range: labForm.reference_range || null,
      status: labForm.status,
      notes: labForm.notes || null,
      file_url,
    });
    if (error) return toast.error(error.message);
    toast.success("Lab result saved");
    setLabForm({ test_name: "", test_category: "", result_value: "", result_unit: "", reference_range: "", status: "normal", notes: "", file: null });
    setLabOpen(false);
    void load();
  };

  const downloadLab = async (path: string) => {
    const { data, error } = await supabase.storage.from("lab-results").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message || "Failed to get file");
    window.open(data.signedUrl, "_blank");
  };

  const addReminder = async () => {
    if (!currentTenantId || !user || !remForm.message.trim() || !remForm.scheduled_at) return toast.error("Message + time required");
    if (remForm.channels.length === 0) return toast.error("Pick at least one channel");
    const { error } = await supabase.from("reminders").insert({
      tenant_id: currentTenantId, patient_id: id, created_by: user.id,
      reminder_type: remForm.reminder_type,
      message: remForm.message.trim(),
      channels: remForm.channels,
      scheduled_at: new Date(remForm.scheduled_at).toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Reminder scheduled");
    setRemForm({ reminder_type: "medication", message: "", scheduled_at: "", channels: ["sms"] });
    setRemOpen(false);
    void load();
  };

  const sendNow = async () => {
    if (!msgForm.message.trim() || msgForm.channels.length === 0) return toast.error("Message & channel required");
    setSending(true);
    try {
      const res = await sendQuick({ data: { patientId: id, message: msgForm.message.trim(), channels: msgForm.channels as ("sms"|"whatsapp"|"telegram")[] } });
      if (res.ok) toast.success("Message sent");
      else toast.error("Send failed: " + res.results.map((r: any) => `${r.channel}: ${r.error}`).join("; "));
      setMsgForm({ message: "", channels: ["sms"] });
      setMsgOpen(false);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally { setSending(false); }
  };

  const checkInteractions = async () => {
    if (rx.length === 0) return toast.error("No prescriptions to check");
    setAiLoading(true);
    setAiReport(null);
    const { data, error } = await supabase.functions.invoke("drug-interactions", {
      body: {
        drugs: rx.map((r) => r.drug_name),
        patientAllergies: patient?.allergies ?? "",
        patientConditions: patient?.chronic_conditions ?? "",
      },
    });
    setAiLoading(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    setAiReport(data as AIReport);
  };

  if (!patient) return <div className="text-muted-foreground">Loading…</div>;

  const riskTone = aiReport?.overall_risk === "danger" ? "destructive" : aiReport?.overall_risk === "caution" ? "default" : "secondary";
  const labStatusTone = (s: string) => s === "critical" ? "destructive" : s === "abnormal" ? "default" : s === "pending" ? "outline" : "secondary";
  const remStatusTone = (s: string) => s === "sent" ? "secondary" : s === "failed" ? "destructive" : s === "cancelled" ? "outline" : "default";
  const prefChannels = patient.preferred_channels ?? ["sms"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/patients"><ArrowLeft className="mr-2 h-4 w-4" />Back to patients</Link></Button>
        <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><MessageSquare className="mr-1 h-4 w-4" />Send message</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader><DialogTitle>Send message to {patient.full_name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <ChannelPicker value={msgForm.channels} onChange={(c) => setMsgForm({ ...msgForm, channels: c })} />
              <div><Label>Message</Label><Textarea rows={4} value={msgForm.message} onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })} placeholder="Type your message…" /></div>
              <Button onClick={() => void sendNow()} disabled={sending} className="w-full">
                {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1 h-4 w-4" />}
                Send now
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{patient.full_name}</span>
              {patient.is_chronic && <Badge variant="destructive" className="gap-1"><HeartPulse className="h-3 w-3" />Chronic</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="DOB" value={patient.date_of_birth} />
            <Row label="Gender" value={patient.gender} />
            <Row label="Phone" value={patient.phone} />
            <Row label="Email" value={patient.email} />
            <Row label="SHA" value={patient.sha_number} />
            <Row label="National ID" value={patient.national_id} />
            <Row label="Address" value={patient.address} />
            <div className="pt-2">
              <div className="text-xs uppercase text-muted-foreground">Allergies</div>
              <div className="text-sm">{patient.allergies || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Chronic conditions</div>
              <div className="text-sm">{patient.chronic_conditions || "—"}</div>
            </div>
            {patient.notes && <div><div className="text-xs uppercase text-muted-foreground">Notes</div><div className="text-sm">{patient.notes}</div></div>}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Communication channels</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>WhatsApp number</Label>
                  <Input defaultValue={patient.whatsapp_number ?? ""} placeholder="+254…" onBlur={(e) => e.target.value !== (patient.whatsapp_number ?? "") && void updatePatient({ whatsapp_number: e.target.value || null })} />
                </div>
                <div>
                  <Label>Telegram chat ID</Label>
                  <Input defaultValue={patient.telegram_chat_id ?? ""} placeholder="numeric chat id" onBlur={(e) => e.target.value !== (patient.telegram_chat_id ?? "") && void updatePatient({ telegram_chat_id: e.target.value || null })} />
                </div>
              </div>
              <div>
                <Label>Preferred channels</Label>
                <div className="mt-1 flex flex-wrap gap-3">
                  {ALL_CHANNELS.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm capitalize">
                      <Checkbox
                        checked={prefChannels.includes(c)}
                        onCheckedChange={(v) => {
                          const next = v ? Array.from(new Set([...prefChannels, c])) : prefChannels.filter((x) => x !== c);
                          void updatePatient({ preferred_channels: next.length ? next : ["sms"] });
                        }}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2 border-t">
                <div>
                  <div className="font-medium flex items-center gap-2"><HeartPulse className="h-4 w-4" />Chronic patient</div>
                  <div className="text-xs text-muted-foreground">Track for follow-ups & periodic review.</div>
                </div>
                <Switch checked={patient.is_chronic} onCheckedChange={(v) => void updatePatient({ is_chronic: v })} />
              </div>
              {patient.is_chronic && (
                <div className="grid gap-1">
                  <Label>Next review date</Label>
                  <Input type="date" defaultValue={patient.chronic_review_date ?? ""} onBlur={(e) => e.target.value !== (patient.chronic_review_date ?? "") && void updatePatient({ chronic_review_date: e.target.value || null })} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" />Visits ({visits.length})</CardTitle>
              <Dialog open={visitOpen} onOpenChange={setVisitOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add visit</Button></DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg">
                  <DialogHeader><DialogTitle>New visit</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Reason</Label><Input value={visitForm.reason} onChange={(e) => setVisitForm({ ...visitForm, reason: e.target.value })} /></div>
                    <div><Label>Diagnosis</Label><Input value={visitForm.diagnosis} onChange={(e) => setVisitForm({ ...visitForm, diagnosis: e.target.value })} /></div>
                    <div><Label>Notes</Label><Textarea rows={3} value={visitForm.notes} onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} /></div>
                    <Button onClick={() => void addVisit()}>Save visit</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {visits.length === 0 && <div className="text-sm text-muted-foreground">No visits recorded yet.</div>}
              {visits.map((v) => (
                <div key={v.id} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{new Date(v.visit_date).toLocaleString()}</div>
                  {v.reason && <div className="text-sm font-medium">{v.reason}</div>}
                  {v.diagnosis && <div className="text-sm">Dx: {v.diagnosis}</div>}
                  {v.notes && <div className="text-sm text-muted-foreground">{v.notes}</div>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4" />Prescriptions ({rx.length})</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void checkInteractions()} disabled={aiLoading || rx.length === 0}>
                  {aiLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
                  Check interactions
                </Button>
                <Dialog open={rxOpen} onOpenChange={setRxOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Prescribe</Button></DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-lg">
                    <DialogHeader><DialogTitle>New prescription</DialogTitle></DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2"><Label>Drug name *</Label><Input value={rxForm.drug_name} onChange={(e) => setRxForm({ ...rxForm, drug_name: e.target.value })} /></div>
                      <div><Label>Dosage</Label><Input placeholder="500mg" value={rxForm.dosage} onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })} /></div>
                      <div><Label>Frequency</Label><Input placeholder="TID" value={rxForm.frequency} onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })} /></div>
                      <div><Label>Duration</Label><Input placeholder="7 days" value={rxForm.duration} onChange={(e) => setRxForm({ ...rxForm, duration: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Instructions</Label><Textarea rows={2} value={rxForm.instructions} onChange={(e) => setRxForm({ ...rxForm, instructions: e.target.value })} /></div>
                    </div>
                    <Button onClick={() => void addRx()} className="mt-2">Save</Button>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {rx.length === 0 && <div className="text-sm text-muted-foreground">No prescriptions yet.</div>}
              {rx.map((r) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{r.drug_name} {r.dosage && <span className="text-muted-foreground">· {r.dosage}</span>}</div>
                      <div className="text-sm text-muted-foreground">
                        {[r.frequency, r.duration].filter(Boolean).join(" · ")}
                      </div>
                      {r.instructions && <div className="text-sm">{r.instructions}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}

              {aiReport && (
                <div className="mt-4 rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={riskTone}>{aiReport.overall_risk.toUpperCase()}</Badge>
                    <span className="text-sm font-medium">AI Drug Interaction Report</span>
                  </div>
                  <p className="text-sm">{aiReport.summary}</p>
                  {aiReport.interactions.length === 0 && <p className="text-sm text-muted-foreground">No interactions identified.</p>}
                  {aiReport.interactions.map((i, idx) => (
                    <div key={idx} className="rounded border-l-4 p-2 bg-muted/30" style={{ borderColor: i.severity === "severe" ? "hsl(var(--destructive))" : i.severity === "moderate" ? "orange" : "gray" }}>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {i.severity.toUpperCase()} · {i.type} · {i.drugs_involved.join(" + ")}
                      </div>
                      <p className="text-sm mt-1">{i.description}</p>
                      <p className="text-sm text-muted-foreground italic">→ {i.recommendation}</p>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">⚠ AI suggestions are advisory; verify with clinical references before dispensing.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" />Lab results ({labs.length})</CardTitle>
              <Dialog open={labOpen} onOpenChange={setLabOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add lab result</Button></DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg">
                  <DialogHeader><DialogTitle>New lab result</DialogTitle></DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Label>Test name *</Label><Input value={labForm.test_name} onChange={(e) => setLabForm({ ...labForm, test_name: e.target.value })} placeholder="e.g. Hemoglobin" /></div>
                    <div><Label>Category</Label><Input value={labForm.test_category} onChange={(e) => setLabForm({ ...labForm, test_category: e.target.value })} placeholder="Hematology" /></div>
                    <div><Label>Status</Label>
                      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={labForm.status} onChange={(e) => setLabForm({ ...labForm, status: e.target.value })}>
                        <option value="normal">Normal</option><option value="abnormal">Abnormal</option>
                        <option value="critical">Critical</option><option value="pending">Pending</option>
                      </select>
                    </div>
                    <div><Label>Value</Label><Input value={labForm.result_value} onChange={(e) => setLabForm({ ...labForm, result_value: e.target.value })} /></div>
                    <div><Label>Unit</Label><Input value={labForm.result_unit} onChange={(e) => setLabForm({ ...labForm, result_unit: e.target.value })} placeholder="g/dL" /></div>
                    <div className="sm:col-span-2"><Label>Reference range</Label><Input value={labForm.reference_range} onChange={(e) => setLabForm({ ...labForm, reference_range: e.target.value })} placeholder="13.5–17.5" /></div>
                    <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={labForm.notes} onChange={(e) => setLabForm({ ...labForm, notes: e.target.value })} /></div>
                    <div className="sm:col-span-2"><Label>Attach report (PDF/Image)</Label><Input type="file" accept="application/pdf,image/*" onChange={(e) => setLabForm({ ...labForm, file: e.target.files?.[0] ?? null })} /></div>
                  </div>
                  <Button onClick={() => void addLab()} className="mt-2"><Upload className="mr-1 h-4 w-4" />Save lab result</Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {labs.length === 0 && <div className="text-sm text-muted-foreground">No lab results yet.</div>}
              {labs.map((l) => (
                <div key={l.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{l.test_name}</span>
                        <Badge variant={labStatusTone(l.status)}>{l.status}</Badge>
                        {l.test_category && <span className="text-xs text-muted-foreground">{l.test_category}</span>}
                      </div>
                      <div className="text-sm">
                        {l.result_value ? <>{l.result_value} {l.result_unit ?? ""}</> : "—"}
                        {l.reference_range && <span className="text-muted-foreground"> · ref {l.reference_range}</span>}
                      </div>
                      {l.notes && <div className="text-sm text-muted-foreground">{l.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{new Date(l.performed_at).toLocaleDateString()}</div>
                      {l.file_url && <Button size="sm" variant="ghost" onClick={() => void downloadLab(l.file_url!)}><ExternalLink className="h-3 w-3 mr-1" />Open</Button>}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" />Reminders ({reminders.length})</CardTitle>
              <Dialog open={remOpen} onOpenChange={setRemOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Schedule reminder</Button></DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg">
                  <DialogHeader><DialogTitle>New reminder</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>Type</Label>
                        <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={remForm.reminder_type} onChange={(e) => setRemForm({ ...remForm, reminder_type: e.target.value })}>
                          <option value="medication">Medication</option><option value="appointment">Appointment</option>
                          <option value="follow_up">Follow-up</option><option value="lab">Lab</option><option value="custom">Custom</option>
                        </select>
                      </div>
                      <div><Label>Send at</Label><Input type="datetime-local" value={remForm.scheduled_at} onChange={(e) => setRemForm({ ...remForm, scheduled_at: e.target.value })} /></div>
                    </div>
                    <ChannelPicker value={remForm.channels} onChange={(c) => setRemForm({ ...remForm, channels: c })} />
                    <div><Label>Message</Label><Textarea rows={4} value={remForm.message} onChange={(e) => setRemForm({ ...remForm, message: e.target.value })} placeholder="e.g. Take Metformin 500mg with breakfast." /></div>
                    <Button onClick={() => void addReminder()} className="w-full">Schedule</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {reminders.length === 0 && <div className="text-sm text-muted-foreground">No reminders yet.</div>}
              {reminders.map((r) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={remStatusTone(r.status)}>{r.status}</Badge>
                        <span className="text-xs uppercase text-muted-foreground">{r.reminder_type.replace("_", " ")}</span>
                        <span className="text-xs text-muted-foreground">via {(r.channels ?? []).join(", ")}</span>
                      </div>
                      <div className="text-sm mt-1">{r.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Scheduled {new Date(r.scheduled_at).toLocaleString()}
                        {r.sent_at && ` · Sent ${new Date(r.sent_at).toLocaleString()}`}
                      </div>
                      {r.error_message && <div className="text-xs text-destructive mt-1">{r.error_message}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChannelPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <Label>Channels</Label>
      <div className="mt-1 flex flex-wrap gap-3">
        {ALL_CHANNELS.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm capitalize">
            <Checkbox
              checked={value.includes(c)}
              onCheckedChange={(v) => {
                const next = v ? Array.from(new Set([...value, c])) : value.filter((x) => x !== c);
                onChange(next);
              }}
            />
            {c}
          </label>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="text-right">{value || "—"}</span></div>;
}