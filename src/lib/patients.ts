/**
 * Pure domain logic for the Patients module. Everything here is side-effect free
 * so it can be unit tested without a database.
 */

export type PatientLike = {
  id: string;
  full_name: string;
  mrn?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  status?: string | null;
  insurance_provider?: string | null;
  sha_number?: string | null;
  is_chronic?: boolean | null;
  created_at?: string | null;
  last_visit_at?: string | null;
};

/** Age in whole years from an ISO date string. */
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age < 0 || age > 130 ? null : age;
}

export type AgeBand = "0-4" | "5-14" | "15-24" | "25-44" | "45-64" | "65+" | "unknown";

export function ageBand(age: number | null): AgeBand {
  if (age === null) return "unknown";
  if (age < 5) return "0-4";
  if (age < 15) return "5-14";
  if (age < 25) return "15-24";
  if (age < 45) return "25-44";
  if (age < 65) return "45-64";
  return "65+";
}

/** BMI in kg/m², rounded to one decimal. Returns null for unusable input. */
export function calcBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  if (!Number.isFinite(bmi) || bmi <= 0 || bmi > 200) return null;
  return Math.round(bmi * 10) / 10;
}

/** Blood-pressure classification used for the vitals badge. */
export function bpStatus(systolic?: number | null, diastolic?: number | null): "low" | "normal" | "elevated" | "high" | "unknown" {
  if (!systolic || !diastolic) return "unknown";
  if (systolic < 90 || diastolic < 60) return "low";
  if (systolic >= 140 || diastolic >= 90) return "high";
  if (systolic >= 130 || diastolic >= 80) return "elevated";
  return "normal";
}

/** Builds a display name from optional name parts, falling back to full_name. */
export function composeName(parts: { first_name?: string; middle_name?: string; last_name?: string }, fallback = ""): string {
  const joined = [parts.first_name, parts.middle_name, parts.last_name]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || fallback.trim();
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-9);

/**
 * Scores how likely an existing patient is a duplicate of the record being
 * registered. 0 = unrelated, 100 = near-certain match.
 */
export function duplicateScore(
  candidate: { full_name?: string; date_of_birth?: string | null; phone?: string | null; national_id?: string | null },
  existing: PatientLike & { national_id?: string | null },
): number {
  let score = 0;
  const cn = norm(candidate.full_name);
  const en = norm(existing.full_name);
  if (cn && en) {
    if (cn === en) score += 55;
    else {
      const cParts = new Set(norm(candidate.full_name).length ? (candidate.full_name ?? "").toLowerCase().split(/\s+/).map(norm).filter(Boolean) : []);
      const eParts = (existing.full_name ?? "").toLowerCase().split(/\s+/).map(norm).filter(Boolean);
      const shared = eParts.filter((p) => cParts.has(p)).length;
      if (shared >= 2) score += 40;
      else if (shared === 1) score += 15;
    }
  }
  if (candidate.phone && digits(candidate.phone) && digits(candidate.phone) === digits(existing.phone)) score += 35;
  if (candidate.date_of_birth && existing.date_of_birth && candidate.date_of_birth === existing.date_of_birth) score += 25;
  if (candidate.national_id && norm(candidate.national_id) && norm(candidate.national_id) === norm(existing.national_id)) score += 60;
  return Math.min(score, 100);
}

/** Existing patients that likely duplicate the record being registered. */
export function findDuplicates(
  candidate: { full_name?: string; date_of_birth?: string | null; phone?: string | null; national_id?: string | null },
  patients: (PatientLike & { national_id?: string | null })[],
  threshold = 55,
): { patient: PatientLike; score: number }[] {
  return patients
    .map((p) => ({ patient: p, score: duplicateScore(candidate, p) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export type PatientStats = {
  total: number;
  newToday: number;
  newThisWeek: number;
  newThisMonth: number;
  active: number;
  inactive: number;
  chronic: number;
  insured: number;
  selfPay: number;
  male: number;
  female: number;
  other: number;
  ageBands: Record<AgeBand, number>;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Aggregates dashboard KPIs from the patient list. */
export function computePatientStats(patients: PatientLike[], now: Date = new Date()): PatientStats {
  const today = startOfDay(now);
  const weekAgo = today - 6 * 86_400_000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const stats: PatientStats = {
    total: patients.length,
    newToday: 0, newThisWeek: 0, newThisMonth: 0,
    active: 0, inactive: 0, chronic: 0, insured: 0, selfPay: 0,
    male: 0, female: 0, other: 0,
    ageBands: { "0-4": 0, "5-14": 0, "15-24": 0, "25-44": 0, "45-64": 0, "65+": 0, unknown: 0 },
  };
  for (const p of patients) {
    const created = p.created_at ? new Date(p.created_at).getTime() : NaN;
    if (!Number.isNaN(created)) {
      if (created >= today) stats.newToday += 1;
      if (created >= weekAgo) stats.newThisWeek += 1;
      if (created >= monthStart) stats.newThisMonth += 1;
    }
    if ((p.status ?? "active") === "active") stats.active += 1;
    else stats.inactive += 1;
    if (p.is_chronic) stats.chronic += 1;
    if (p.insurance_provider || p.sha_number) stats.insured += 1;
    else stats.selfPay += 1;
    const g = (p.gender ?? "").toLowerCase();
    if (g === "male") stats.male += 1;
    else if (g === "female") stats.female += 1;
    else stats.other += 1;
    stats.ageBands[ageBand(ageFromDob(p.date_of_birth, now))] += 1;
  }
  return stats;
}

export const QUEUE_STAGES = [
  "checked_in",
  "waiting",
  "with_clinician",
  "awaiting_lab",
  "awaiting_pharmacy",
  "completed",
  "no_show",
  "cancelled",
] as const;
export type QueueStage = (typeof QUEUE_STAGES)[number];

export const OPEN_QUEUE_STAGES: QueueStage[] = ["checked_in", "waiting", "with_clinician", "awaiting_lab", "awaiting_pharmacy"];

export function queueStageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Minutes a patient has been waiting in the queue. */
export function waitMinutes(arrivedAt: string, now: Date = new Date()): number {
  const t = new Date(arrivedAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((now.getTime() - t) / 60_000));
}

export type FollowUpStatus = "upcoming" | "due_today" | "overdue" | "completed" | "cancelled";

/** Derives a follow-up's live status from its stored status and due date. */
export function followUpStatus(stored: string, dueOn: string, now: Date = new Date()): FollowUpStatus {
  if (stored === "completed" || stored === "cancelled") return stored;
  const due = new Date(`${dueOn}T00:00:00`).getTime();
  const today = startOfDay(now);
  if (Number.isNaN(due)) return "upcoming";
  if (due < today) return "overdue";
  if (due === today) return "due_today";
  return "upcoming";
}

export const ALLERGY_SEVERITIES = ["mild", "moderate", "severe", "life_threatening"] as const;
export const ALLERGY_TYPES = ["drug", "food", "environmental", "other"] as const;
export const DIAGNOSIS_STATUSES = ["active", "chronic", "resolved", "ruled_out"] as const;
export const HISTORY_TYPES = [
  "illness", "surgery", "hospitalisation", "family", "social", "immunisation", "obstetric", "injury", "procedure",
] as const;
export const DOCUMENT_TYPES = [
  "report", "lab_report", "imaging", "referral", "discharge_summary", "consent", "insurance", "prescription", "other",
] as const;
export const PATIENT_TAGS = [
  "new", "returning", "follow-up", "chronic care", "antenatal", "pediatric", "emergency", "inpatient", "high-risk",
] as const;

/** Roles allowed to edit clinical patient data. */
export function canEditClinical(role: string | null | undefined): boolean {
  return ["owner", "admin", "doctor", "pharmacist", "staff", "super_admin"].includes(role ?? "");
}

/** Roles allowed to register or change patient demographics. */
export function canManagePatients(role: string | null | undefined): boolean {
  return ["owner", "admin", "doctor", "pharmacist", "staff", "chv", "super_admin"].includes(role ?? "");
}

/** Rows -> CSV text with escaped values. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n");
}
