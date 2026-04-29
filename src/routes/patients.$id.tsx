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
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Stethoscope, Pill, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/patients/$id")({
  component: () => <ProtectedLayout><PatientDetail /></ProtectedLayout>,
});

type Patient = {
  id: string; full_name: string; date_of_birth: string | null; gender: string | null;
  phone: string | null; email: string | null; sha_number: string | null;
  national_id: string | null; address: string | null;
  allergies: string | null; chronic_conditions: string | null; notes: string | null;
};
type Visit = { id: string; visit_date: string; reason: string | null; diagnosis: string | null; notes: string | null };
type Rx = { id: string; drug_name: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null; created_at: string };

type Interaction = { type: string; severity: "mild" | "moderate" | "severe"; drugs_involved: string[]; description: string; recommendation: string };
type AIReport = { overall_risk: "safe" | "caution" | "danger"; summary: string; interactions: Interaction[] };

function PatientDetail() {
  const { id } = Route.useParams();
  const { currentTenantId, user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [rx, setRx] = useState<Rx[]>([]);
  const [visitOpen, setVisitOpen] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [visitForm, setVisitForm] = useState({ reason: "", diagnosis: "", notes: "" });
  const [rxForm, setRxForm] = useState({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIReport | null>(null);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
    setPatient((p ?? null) as Patient | null);
    const { data: v } = await supabase.from("patient_visits").select("id, visit_date, reason, diagnosis, notes").eq("patient_id", id).order("visit_date", { ascending: false });
    setVisits((v ?? []) as Visit[]);
    const { data: r } = await supabase.from("prescriptions").select("id, drug_name, dosage, frequency, duration, instructions, created_at").eq("patient_id", id).order("created_at", { ascending: false });
    setRx((r ?? []) as Rx[]);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

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

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/patients"><ArrowLeft className="mr-2 h-4 w-4" />Back to patients</Link></Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>{patient.full_name}</CardTitle></CardHeader>
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
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="text-right">{value || "—"}</span></div>;
}