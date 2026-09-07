import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { enqueue } from "@/lib/offline/db";
import { KENYA_COUNTIES } from "@/lib/kenya-counties";
import { composeName, findDuplicates, PATIENT_TAGS, type PatientLike } from "@/lib/patients";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Existing = PatientLike & { national_id?: string | null };

const empty = {
  first_name: "", middle_name: "", last_name: "", preferred_name: "",
  date_of_birth: "", gender: "", nationality: "Kenyan", marital_status: "", occupation: "",
  phone: "", alt_phone: "", email: "", address: "", city: "", postal_address: "",
  emergency_name: "", emergency_relationship: "", emergency_phone: "", emergency_alt_phone: "", emergency_address: "",
  id_type: "national_id", national_id: "", sha_number: "",
  insurance_provider: "", insurance_member_number: "", insurance_policy_number: "", insurance_scheme: "",
  insurance_principal: "", insurance_relationship: "", insurance_expiry: "",
  allergies: "", chronic_conditions: "", notes: "",
};

export function RegistrationDialog({
  open, onOpenChange, existingPatients, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingPatients: Existing[];
  onSaved: () => void;
}) {
  const { currentTenantId, user } = useAuth();
  const [form, setForm] = useState({ ...empty });
  const [county, setCounty] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [consentMethod, setConsentMethod] = useState("verbal");
  const [saving, setSaving] = useState(false);
  const [dupAcknowledged, setDupAcknowledged] = useState(false);
  const set = (patch: Partial<typeof empty>) => setForm({ ...form, ...patch });

  const fullName = composeName(form);
  const duplicates = useMemo(
    () => (fullName.length < 3 && !form.national_id && !form.phone
      ? []
      : findDuplicates({ full_name: fullName, date_of_birth: form.date_of_birth || null, phone: form.phone, national_id: form.national_id }, existingPatients)),
    [fullName, form.date_of_birth, form.phone, form.national_id, existingPatients],
  );

  const reset = () => {
    setForm({ ...empty }); setCounty(""); setTags([]); setConsent(false);
    setConsentMethod("verbal"); setDupAcknowledged(false);
  };

  const save = async () => {
    if (!currentTenantId || !user) return;
    if (!fullName) return toast.error("First and last name are required");
    if (!consent) return toast.error("Patient consent is required before storing their record");
    if (duplicates.length > 0 && !dupAcknowledged) return toast.error("Review the possible duplicate first");
    setSaving(true);
    const payload = {
      tenant_id: currentTenantId, created_by: user.id,
      full_name: fullName,
      first_name: form.first_name || null, middle_name: form.middle_name || null, last_name: form.last_name || null,
      preferred_name: form.preferred_name || null,
      date_of_birth: form.date_of_birth || null, gender: form.gender || null,
      nationality: form.nationality || null, marital_status: form.marital_status || null, occupation: form.occupation || null,
      phone: form.phone || null, alt_phone: form.alt_phone || null, email: form.email || null,
      address: form.address || null, city: form.city || null, postal_address: form.postal_address || null,
      county: county || null,
      emergency_name: form.emergency_name || null, emergency_relationship: form.emergency_relationship || null,
      emergency_phone: form.emergency_phone || null, emergency_alt_phone: form.emergency_alt_phone || null,
      emergency_address: form.emergency_address || null,
      id_type: form.id_type || null, national_id: form.national_id || null, sha_number: form.sha_number || null,
      insurance_provider: form.insurance_provider || null,
      insurance_member_number: form.insurance_member_number || null,
      insurance_policy_number: form.insurance_policy_number || null,
      insurance_scheme: form.insurance_scheme || null,
      insurance_principal: form.insurance_principal || null,
      insurance_relationship: form.insurance_relationship || null,
      insurance_expiry: form.insurance_expiry || null,
      allergies: form.allergies || null, chronic_conditions: form.chronic_conditions || null, notes: form.notes || null,
      tags, status: "active",
      consent_given: true, consent_method: consentMethod,
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await enqueue({ tenant_id: currentTenantId, table: "patients", payload });
        toast.success("Patient queued offline — will sync when online");
      } catch (e) {
        setSaving(false);
        return toast.error(e instanceof Error ? e.message : "Queue failed");
      }
    } else {
      const { data, error } = await supabase.from("patients").insert(payload).select("id, mrn").single();
      if (error) { setSaving(false); return toast.error(error.message); }
      void logAudit({
        tenantId: currentTenantId, actorId: user.id, actorEmail: user.email ?? null,
        action: "patient.create", entity: "patients", entityId: data?.id,
        meta: { county: county || null, consent_method: consentMethod, mrn: data?.mrn },
      });
      toast.success(`Registered — ${data?.mrn ?? "patient saved"}`);
    }
    setSaving(false);
    reset();
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Register patient</DialogTitle></DialogHeader>

        {duplicates.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />Possible duplicate patient found
            </div>
            <div className="mt-2 space-y-1">
              {duplicates.map(({ patient, score }) => (
                <div key={patient.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background/60 px-2 py-1">
                  <span>
                    <strong>{patient.full_name}</strong>
                    <span className="text-muted-foreground"> · {patient.mrn ?? "no MRN"}{patient.date_of_birth ? ` · ${patient.date_of_birth}` : ""}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{score}% match</Badge>
                    <Button asChild size="sm" variant="outline"><Link to="/patients/$id" params={{ id: patient.id }}>Open</Link></Button>
                  </span>
                </div>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <Checkbox checked={dupAcknowledged} onCheckedChange={(v) => setDupAcknowledged(v === true)} />
              This is a different person — continue registering
            </label>
          </div>
        )}

        <Tabs defaultValue="personal">
          <TabsList className="flex-wrap">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="emergency">Emergency</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
            <TabsTrigger value="clinical">Clinical</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="grid gap-3 sm:grid-cols-2">
            <div><Label>First name *</Label><Input value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} /></div>
            <div><Label>Middle name</Label><Input value={form.middle_name} onChange={(e) => set({ middle_name: e.target.value })} /></div>
            <div><Label>Last name *</Label><Input value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} /></div>
            <div><Label>Preferred name</Label><Input value={form.preferred_name} onChange={(e) => set({ preferred_name: e.target.value })} /></div>
            <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} /></div>
            <div>
              <Label>Sex</Label>
              <Select value={form.gender} onValueChange={(v) => set({ gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="unspecified">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nationality</Label><Input value={form.nationality} onChange={(e) => set({ nationality: e.target.value })} /></div>
            <div>
              <Label>Marital status</Label>
              <Select value={form.marital_status} onValueChange={(v) => set({ marital_status: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["single", "married", "separated", "divorced", "widowed"].map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Occupation</Label><Input value={form.occupation} onChange={(e) => set({ occupation: e.target.value })} /></div>
            <div>
              <Label>Identification type</Label>
              <Select value={form.id_type} onValueChange={(v) => set({ id_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="birth_certificate">Birth certificate</SelectItem>
                  <SelectItem value="other">Other identifier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>ID number</Label><Input value={form.national_id} onChange={(e) => set({ national_id: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <Label>Tags</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {PATIENT_TAGS.map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
                    className={`rounded-full border px-3 py-1 text-xs capitalize transition ${tags.includes(t) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >{t}</button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="grid gap-3 sm:grid-cols-2">
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="07XX XXX XXX" /></div>
            <div><Label>Alternative phone</Label><Input value={form.alt_phone} onChange={(e) => set({ alt_phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></div>
            <div><Label>City / town</Label><Input value={form.city} onChange={(e) => set({ city: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Physical address</Label><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Postal address</Label><Input value={form.postal_address} onChange={(e) => set({ postal_address: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <Label>County</Label>
              <Select value={county} onValueChange={setCounty}>
                <SelectTrigger><SelectValue placeholder="Select county (used for disease trends)" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {KENYA_COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="emergency" className="grid gap-3 sm:grid-cols-2">
            <div><Label>Contact name</Label><Input value={form.emergency_name} onChange={(e) => set({ emergency_name: e.target.value })} /></div>
            <div><Label>Relationship</Label><Input value={form.emergency_relationship} onChange={(e) => set({ emergency_relationship: e.target.value })} placeholder="e.g. spouse, parent" /></div>
            <div><Label>Phone</Label><Input value={form.emergency_phone} onChange={(e) => set({ emergency_phone: e.target.value })} /></div>
            <div><Label>Alternative phone</Label><Input value={form.emergency_alt_phone} onChange={(e) => set({ emergency_alt_phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input value={form.emergency_address} onChange={(e) => set({ emergency_address: e.target.value })} /></div>
          </TabsContent>

          <TabsContent value="insurance" className="grid gap-3 sm:grid-cols-2">
            <div><Label>SHA number</Label><Input value={form.sha_number} onChange={(e) => set({ sha_number: e.target.value })} /></div>
            <div><Label>Insurance provider</Label><Input value={form.insurance_provider} onChange={(e) => set({ insurance_provider: e.target.value })} placeholder="e.g. SHA, AAR, Jubilee" /></div>
            <div><Label>Member number</Label><Input value={form.insurance_member_number} onChange={(e) => set({ insurance_member_number: e.target.value })} /></div>
            <div><Label>Policy number</Label><Input value={form.insurance_policy_number} onChange={(e) => set({ insurance_policy_number: e.target.value })} /></div>
            <div><Label>Scheme</Label><Input value={form.insurance_scheme} onChange={(e) => set({ insurance_scheme: e.target.value })} /></div>
            <div><Label>Principal member</Label><Input value={form.insurance_principal} onChange={(e) => set({ insurance_principal: e.target.value })} /></div>
            <div><Label>Relationship to principal</Label><Input value={form.insurance_relationship} onChange={(e) => set({ insurance_relationship: e.target.value })} /></div>
            <div><Label>Cover expiry</Label><Input type="date" value={form.insurance_expiry} onChange={(e) => set({ insurance_expiry: e.target.value })} /></div>
          </TabsContent>

          <TabsContent value="clinical" className="grid gap-3">
            <div><Label>Known allergies</Label><Textarea rows={2} value={form.allergies} onChange={(e) => set({ allergies: e.target.value })} placeholder="e.g. penicillin, sulfa" /></div>
            <div><Label>Chronic conditions</Label><Textarea rows={2} value={form.chronic_conditions} onChange={(e) => set({ chronic_conditions: e.target.value })} placeholder="e.g. hypertension, diabetes" /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="flex items-start gap-3">
            <Checkbox id="reg-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="reg-consent" className="text-sm font-medium">Patient consent obtained *</Label>
              <p className="text-xs text-muted-foreground">
                Required by the Kenya Data Protection Act, 2019. Confirm the patient agreed to this facility
                storing and processing their health data.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Label className="text-xs">How was consent given?</Label>
            <Select value={consentMethod} onValueChange={setConsentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="verbal">Verbal (in person)</SelectItem>
                <SelectItem value="written">Written / signed form</SelectItem>
                <SelectItem value="sms">SMS confirmation</SelectItem>
                <SelectItem value="chv">Via community health volunteer</SelectItem>
                <SelectItem value="guardian">Guardian / next of kin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={() => void save()} disabled={saving}>Register patient</Button>
      </DialogContent>
    </Dialog>
  );
}
