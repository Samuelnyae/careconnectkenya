import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Video, Pill, Send, Loader2, ExternalLink, Phone, MessageSquare, FileText, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/consult/$id")({
  component: () => <ProtectedLayout><ConsultRoom /></ProtectedLayout>,
});

type Appt = {
  id: string; tenant_id: string; patient_id: string; scheduled_at: string; status: string;
  reason: string | null; notes: string | null; video_room_url: string | null; video_provider: string | null;
  patients: { full_name: string; phone: string | null; allergies: string | null; chronic_conditions: string | null } | null;
};
type Rx = { id: string; drug_name: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null };

function ConsultRoom() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [appt, setAppt] = useState<Appt | null>(null);
  const [rx, setRx] = useState<Rx[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [rxForm, setRxForm] = useState({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  const [savingRx, setSavingRx] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: a } = await supabase
      .from("appointments")
      .select("id, tenant_id, patient_id, scheduled_at, status, reason, notes, video_room_url, video_provider, patients(full_name, phone, allergies, chronic_conditions)")
      .eq("id", id).maybeSingle();
    setAppt((a ?? null) as unknown as Appt | null);
    if (a) {
      const { data: r } = await supabase.from("prescriptions")
        .select("id, drug_name, dosage, frequency, duration, instructions")
        .eq("appointment_id", id).order("created_at", { ascending: false });
      setRx((r ?? []) as Rx[]);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const startCall = async () => {
    if (!appt) return;
    if (appt.video_room_url) return;
    setCreatingRoom(true);
    const { data, error } = await supabase.functions.invoke("create-video-room", {
      body: { appointmentId: appt.id, patientName: appt.patients?.full_name ?? "Patient" },
    });
    setCreatingRoom(false);
    if (error || data?.error) return toast.error(error?.message ?? data?.error);
    await supabase.from("appointments").update({
      video_room_url: data.url, video_provider: data.provider, video_room_name: data.name,
      status: "in_progress", started_at: new Date().toISOString(),
    }).eq("id", appt.id);
    toast.success(`Room ready (${data.provider})`);
    void load();
  };

  const endCall = async () => {
    if (!appt) return;
    await supabase.from("appointments").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", appt.id);
    toast.success("Consultation ended");
    void load();
  };

  const addRx = async () => {
    if (!appt || !user) return;
    if (!rxForm.drug_name.trim()) return toast.error("Drug name required");
    setSavingRx(true);
    const { error } = await supabase.from("prescriptions").insert({
      tenant_id: appt.tenant_id, patient_id: appt.patient_id, prescribed_by: user.id,
      appointment_id: appt.id,
      drug_name: rxForm.drug_name.trim(), dosage: rxForm.dosage || null,
      frequency: rxForm.frequency || null, duration: rxForm.duration || null,
      instructions: rxForm.instructions || null,
    });
    setSavingRx(false);
    if (error) return toast.error(error.message);
    setRxForm({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "" });
    toast.success("Prescription added");
    void load();
  };

  const send = async (rxId: string, channels: ("inapp" | "sms" | "pdf" | "whatsapp" | "telegram")[]) => {
    if (!appt) return;
    setSendingId(rxId);
    const { data, error } = await supabase.functions.invoke("send-prescription", {
      body: {
        prescriptionId: rxId, channels,
        phone: appt.patients?.phone ?? null,
        appOrigin: typeof window !== "undefined" ? window.location.origin : "",
      },
    });
    setSendingId(null);
    if (error || data?.error) return toast.error(error?.message ?? data?.error);
    type SendResult = { channel: string; status: string; share_url?: string; deep_link?: string; error?: string };
    const results = (data?.results ?? []) as SendResult[];
    for (const r of results) {
      if (r.status === "sent") toast.success(`${r.channel.toUpperCase()} delivered`);
      else if (r.status === "link_ready") toast.success(`${r.channel.toUpperCase()} link ready`);
      else if (r.status === "pending_provider") toast.warning(`${r.channel.toUpperCase()}: ${r.error ?? "provider not configured"}`);
      else if (r.status === "failed") toast.error(`${r.channel.toUpperCase()} failed: ${r.error}`);
    }
    const linkRes = results.find((r) => r.deep_link);
    if (linkRes?.deep_link) window.open(linkRes.deep_link, "_blank");
    if (channels.includes("inapp") || channels.includes("pdf")) {
      const inapp = results.find((r) => r.channel === "inapp");
      if (inapp?.share_url) window.open(inapp.share_url, "_blank");
    }
  };

  if (!appt) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm"><Link to="/appointments"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2"><Video className="h-4 w-4" />Video consultation</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{appt.patients?.full_name} · {new Date(appt.scheduled_at).toLocaleString()}</p>
              </div>
              <Badge variant={appt.status === "completed" ? "secondary" : appt.status === "in_progress" ? "default" : "outline"}>{appt.status.replace("_", " ")}</Badge>
            </CardHeader>
            <CardContent>
              {!appt.video_room_url ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
                  <Video className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No room yet. Start the consultation to create one.</p>
                  <Button onClick={() => void startCall()} disabled={creatingRoom}>
                    {creatingRoom ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                    Start video call
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black">
                    <iframe
                      src={appt.video_room_url}
                      allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
                      className="h-full w-full"
                      title="Video consultation"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={appt.video_room_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Open in new tab</a>
                    </Button>
                    {appt.patients?.phone && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`sms:${appt.patients.phone}?body=${encodeURIComponent(`Join your consultation: ${appt.video_room_url}`)}`}>
                          <MessageSquare className="mr-1 h-4 w-4" />SMS link to patient
                        </a>
                      </Button>
                    )}
                    {appt.patients?.phone && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`tel:${appt.patients.phone}`}><Phone className="mr-1 h-4 w-4" />Call</a>
                      </Button>
                    )}
                    {appt.status !== "completed" && (
                      <Button variant="destructive" size="sm" onClick={() => void endCall()}>End consultation</Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Provider: {appt.video_provider ?? "—"}. {appt.video_provider === "jitsi" && "Add a DAILY_API_KEY secret for HIPAA-friendly rooms."}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4" />E-prescriptions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Drug *</Label><Input value={rxForm.drug_name} onChange={(e) => setRxForm({ ...rxForm, drug_name: e.target.value })} /></div>
                <div><Label>Dosage</Label><Input placeholder="500mg" value={rxForm.dosage} onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })} /></div>
                <div><Label>Frequency</Label><Input placeholder="TID" value={rxForm.frequency} onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })} /></div>
                <div><Label>Duration</Label><Input placeholder="7 days" value={rxForm.duration} onChange={(e) => setRxForm({ ...rxForm, duration: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Instructions</Label><Textarea rows={2} value={rxForm.instructions} onChange={(e) => setRxForm({ ...rxForm, instructions: e.target.value })} /></div>
              </div>
              <Button onClick={() => void addRx()} disabled={savingRx} size="sm">Add prescription</Button>

              <div className="space-y-2 pt-2">
                {rx.length === 0 && <div className="text-sm text-muted-foreground">No prescriptions yet.</div>}
                {rx.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{r.drug_name}{r.dosage ? ` · ${r.dosage}` : ""}</div>
                        <div className="text-sm text-muted-foreground">{[r.frequency, r.duration].filter(Boolean).join(" · ") || "—"}</div>
                        {r.instructions && <div className="text-sm">{r.instructions}</div>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" onClick={() => void send(r.id, ["inapp"])} disabled={sendingId === r.id}>
                          <FileText className="mr-1 h-3 w-3" />View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void send(r.id, ["sms"])} disabled={sendingId === r.id || !appt.patients?.phone}>
                          {sendingId === r.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}SMS
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void send(r.id, ["whatsapp"])} disabled={sendingId === r.id || !appt.patients?.phone}>
                          <MessageCircle className="mr-1 h-3 w-3" />WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void send(r.id, ["telegram"])} disabled={sendingId === r.id}>
                          <Send className="mr-1 h-3 w-3" />Telegram
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-1 h-fit">
          <CardHeader><CardTitle className="text-base">Patient briefing</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><div className="text-xs uppercase text-muted-foreground">Name</div>{appt.patients?.full_name}</div>
            <div><div className="text-xs uppercase text-muted-foreground">Phone</div>{appt.patients?.phone ?? "—"}</div>
            <div><div className="text-xs uppercase text-muted-foreground">Allergies</div>{appt.patients?.allergies ?? "—"}</div>
            <div><div className="text-xs uppercase text-muted-foreground">Chronic conditions</div>{appt.patients?.chronic_conditions ?? "—"}</div>
            <div><div className="text-xs uppercase text-muted-foreground">Reason</div>{appt.reason ?? "—"}</div>
            {appt.notes && <div><div className="text-xs uppercase text-muted-foreground">Notes</div>{appt.notes}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}