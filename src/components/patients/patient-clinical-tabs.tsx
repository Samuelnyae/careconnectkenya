import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import {
  ALLERGY_SEVERITIES, ALLERGY_TYPES, DIAGNOSIS_STATUSES, DOCUMENT_TYPES,
  HISTORY_TYPES, canEditClinical, calcBmi, bpStatus,
} from "@/lib/patients";
import { Badge } from "@/components/ui/badge";
import { ClinicalPanel, dateText, dateTimeText, pretty, text, type Row } from "./clinical-panel";

const severityTone = (s: unknown) =>
  s === "life_threatening" || s === "severe" ? "destructive" : s === "moderate" ? "default" : "secondary";

/** Clinical record tabs for a single patient: allergies, diagnoses, vitals, history, immunizations, follow-ups, documents. */
export function PatientClinicalTabs({ patientId }: { patientId: string }) {
  const { currentRole } = useAuth();
  const canEdit = canEditClinical(currentRole);

  return (
    <Tabs defaultValue="allergies" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="allergies">Allergies</TabsTrigger>
        <TabsTrigger value="diagnoses">Diagnoses</TabsTrigger>
        <TabsTrigger value="vitals">Vital signs</TabsTrigger>
        <TabsTrigger value="history">Medical history</TabsTrigger>
        <TabsTrigger value="immunizations">Immunizations</TabsTrigger>
        <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>

      <TabsContent value="allergies">
        <ClinicalPanel
          table="patient_allergies" patientId={patientId} canEdit={canEdit}
          title="Allergies & intolerances" addLabel="Add allergy" orderBy="created_at"
          description="Checked automatically before prescriptions are dispensed."
          fields={[
            { key: "substance", label: "Substance", required: true, half: true, placeholder: "e.g. Penicillin" },
            { key: "allergy_type", label: "Type", type: "select", options: ALLERGY_TYPES, half: true },
            { key: "severity", label: "Severity", type: "select", options: ALLERGY_SEVERITIES, half: true },
            { key: "identified_on", label: "Identified on", type: "date", half: true },
            { key: "reaction", label: "Reaction", placeholder: "e.g. rash, anaphylaxis" },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          columns={[
            { key: "substance", label: "Substance", render: (r) => <strong>{text(r.substance)}</strong> },
            { key: "severity", label: "Severity", render: (r) => <Badge variant={severityTone(r.severity)}>{pretty(r.severity)}</Badge> },
            { key: "allergy_type", label: "Type" },
            { key: "reaction", label: "Reaction" },
            { key: "identified_on", label: "Identified", render: (r) => dateText(r.identified_on) },
            { key: "notes", label: "Notes" },
          ]}
          extraPayload={{ created_by: undefined }}
        />
      </TabsContent>

      <TabsContent value="diagnoses">
        <ClinicalPanel
          table="patient_diagnoses" patientId={patientId} canEdit={canEdit}
          title="Diagnoses" addLabel="Add diagnosis" orderBy="diagnosed_on"
          description="ICD-10 coded problem list."
          fields={[
            { key: "icd10_code", label: "ICD-10 code", half: true, placeholder: "e.g. E11.9" },
            { key: "status", label: "Status", type: "select", options: DIAGNOSIS_STATUSES, half: true },
            { key: "description", label: "Diagnosis", required: true, placeholder: "e.g. Type 2 diabetes mellitus" },
            { key: "diagnosed_on", label: "Diagnosed on", type: "date", half: true },
            { key: "provider", label: "Clinician", half: true },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          columns={[
            { key: "description", label: "Diagnosis", render: (r) => <strong>{text(r.description)}</strong> },
            { key: "icd10_code", label: "ICD-10" },
            { key: "status", label: "Status", render: (r) => <Badge variant={r.status === "active" || r.status === "chronic" ? "default" : "secondary"}>{pretty(r.status)}</Badge> },
            { key: "diagnosed_on", label: "Diagnosed", render: (r) => dateText(r.diagnosed_on) },
            { key: "provider", label: "Clinician" },
            { key: "notes", label: "Notes" },
          ]}
        />
      </TabsContent>

      <TabsContent value="vitals">
        <ClinicalPanel
          table="patient_vitals" patientId={patientId} canEdit={canEdit}
          title="Vital signs" addLabel="Record vitals" orderBy="recorded_at"
          description="Triage observations. BMI is calculated automatically."
          fields={[
            { key: "recorded_at", label: "Recorded at", type: "datetime", half: true },
            { key: "temperature", label: "Temperature (°C)", type: "number", half: true },
            { key: "systolic", label: "Systolic (mmHg)", type: "number", half: true },
            { key: "diastolic", label: "Diastolic (mmHg)", type: "number", half: true },
            { key: "pulse", label: "Pulse (bpm)", type: "number", half: true },
            { key: "respiratory_rate", label: "Respiratory rate", type: "number", half: true },
            { key: "spo2", label: "SpO₂ (%)", type: "number", half: true },
            { key: "blood_glucose", label: "Blood glucose (mmol/L)", type: "number", half: true },
            { key: "weight_kg", label: "Weight (kg)", type: "number", half: true },
            { key: "height_cm", label: "Height (cm)", type: "number", half: true },
            { key: "pain_score", label: "Pain score (0-10)", type: "number", half: true },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          transform={(v) => {
            const bmi = calcBmi(Number(v.weight_kg) || null, Number(v.height_cm) || null);
            const out: Row = { bmi };
            if (!v.recorded_at) out.recorded_at = new Date().toISOString();
            return out;
          }}
          columns={[
            { key: "recorded_at", label: "Recorded", render: (r) => dateTimeText(r.recorded_at) },
            {
              key: "bp", label: "Blood pressure",
              render: (r) => {
                const s = r.systolic as number | null, d = r.diastolic as number | null;
                if (!s || !d) return "—";
                const status = bpStatus(s, d);
                return <span className="flex items-center gap-2">{s}/{d}<Badge variant={status === "high" ? "destructive" : status === "elevated" ? "default" : "secondary"}>{status}</Badge></span>;
              },
            },
            { key: "temperature", label: "Temp (°C)" },
            { key: "pulse", label: "Pulse" },
            { key: "spo2", label: "SpO₂ (%)" },
            { key: "respiratory_rate", label: "Resp. rate" },
            { key: "weight_kg", label: "Weight (kg)" },
            { key: "bmi", label: "BMI" },
            { key: "blood_glucose", label: "Glucose" },
            { key: "pain_score", label: "Pain" },
            { key: "notes", label: "Notes" },
          ]}
        />
      </TabsContent>

      <TabsContent value="history">
        <ClinicalPanel
          table="patient_history" patientId={patientId} canEdit={canEdit}
          title="Medical & family history" addLabel="Add history" orderBy="occurred_on"
          fields={[
            { key: "history_type", label: "Type", type: "select", options: HISTORY_TYPES, half: true },
            { key: "occurred_on", label: "Date", type: "date", half: true },
            { key: "condition", label: "Condition / event", required: true, placeholder: "e.g. Appendectomy" },
            { key: "provider", label: "Facility / clinician", half: true },
            { key: "details", label: "Details", type: "textarea" },
          ]}
          columns={[
            { key: "condition", label: "Condition", render: (r) => <strong>{text(r.condition)}</strong> },
            { key: "history_type", label: "Type" },
            { key: "occurred_on", label: "Date", render: (r) => dateText(r.occurred_on) },
            { key: "provider", label: "Facility" },
            { key: "details", label: "Details" },
          ]}
        />
      </TabsContent>

      <TabsContent value="immunizations">
        <ClinicalPanel
          table="patient_immunizations" patientId={patientId} canEdit={canEdit}
          title="Immunizations" addLabel="Add vaccination" orderBy="administered_on"
          fields={[
            { key: "vaccine", label: "Vaccine", required: true, half: true, placeholder: "e.g. Measles-Rubella" },
            { key: "dose_label", label: "Dose", half: true, placeholder: "e.g. Dose 1" },
            { key: "administered_on", label: "Administered on", type: "date", half: true },
            { key: "next_dose_on", label: "Next dose due", type: "date", half: true },
            { key: "batch_number", label: "Batch number", half: true },
            { key: "manufacturer", label: "Manufacturer", half: true },
            { key: "provider", label: "Administered by", half: true },
            { key: "location", label: "Site / facility", half: true },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          columns={[
            { key: "vaccine", label: "Vaccine", render: (r) => <strong>{text(r.vaccine)}</strong> },
            { key: "dose_label", label: "Dose" },
            { key: "administered_on", label: "Given", render: (r) => dateText(r.administered_on) },
            { key: "next_dose_on", label: "Next dose", render: (r) => dateText(r.next_dose_on) },
            { key: "batch_number", label: "Batch" },
            { key: "provider", label: "By" },
          ]}
        />
      </TabsContent>

      <TabsContent value="followups">
        <ClinicalPanel
          table="patient_followups" patientId={patientId} canEdit={canEdit}
          title="Follow-ups" addLabel="Schedule follow-up" orderBy="due_on" ascending
          description="Due dates appear on the follow-ups worklist."
          fields={[
            { key: "due_on", label: "Due on", type: "date", required: true, half: true },
            { key: "status", label: "Status", type: "select", options: ["upcoming", "completed", "cancelled"], half: true },
            { key: "reason", label: "Reason", required: true, placeholder: "e.g. BP review" },
            { key: "provider", label: "Clinician", half: true },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          columns={[
            { key: "reason", label: "Reason", render: (r) => <strong>{text(r.reason)}</strong> },
            { key: "due_on", label: "Due", render: (r) => dateText(r.due_on) },
            { key: "status", label: "Status", render: (r) => <Badge variant={r.status === "completed" ? "secondary" : "default"}>{pretty(r.status)}</Badge> },
            { key: "provider", label: "Clinician" },
            { key: "notes", label: "Notes" },
          ]}
        />
      </TabsContent>

      <TabsContent value="documents">
        <ClinicalPanel
          table="patient_documents" patientId={patientId} canEdit={canEdit}
          title="Documents" addLabel="Record document" orderBy="created_at"
          description="Reference for referral letters, consent forms and scanned reports."
          fields={[
            { key: "name", label: "Document name", required: true, half: true },
            { key: "doc_type", label: "Type", type: "select", options: DOCUMENT_TYPES, half: true },
            { key: "file_path", label: "File reference / link" },
            { key: "description", label: "Description", type: "textarea" },
          ]}
          columns={[
            { key: "name", label: "Name", render: (r) => <strong>{text(r.name)}</strong> },
            { key: "doc_type", label: "Type" },
            { key: "created_at", label: "Added", render: (r) => dateTimeText(r.created_at) },
            { key: "file_path", label: "Reference" },
            { key: "description", label: "Description" },
          ]}
        />
      </TabsContent>
    </Tabs>
  );
}
