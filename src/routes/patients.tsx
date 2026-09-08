import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Download, ListChecks, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { cacheList, readCache } from "@/lib/offline/db";
import { RegistrationDialog } from "@/components/patients/registration-dialog";
import {
  ageBand, ageFromDob, canManagePatients, computePatientStats, toCsv, type PatientLike,
} from "@/lib/patients";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patients — CareConnect Kenya" },
      { name: "description", content: "Register patients, search records by name or MRN, and track visits, follow-ups and insurance cover in one place." },
      { property: "og:title", content: "Patients — CareConnect Kenya" },
      { property: "og:description", content: "Central patient register with MRN search, clinical history, follow-ups and insurance details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ProtectedLayout><PatientsPage /></ProtectedLayout>,
});

type Patient = PatientLike & {
  national_id: string | null;
  county: string | null;
  tags: string[] | null;
  insurance_provider: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
};

function PatientsPage() {
  const { currentTenantId, currentRole } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [dueFollowUps, setDueFollowUps] = useState(0);
  const [apptsToday, setApptsToday] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [cohort, setCohort] = useState("all");
  const [open, setOpen] = useState(false);
  const canManage = canManagePatients(currentRole);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const [{ data, error }, queue, follow, appts] = await Promise.all([
      supabase.from("patients")
        .select("id, mrn, full_name, date_of_birth, gender, phone, national_id, sha_number, insurance_provider, allergies, chronic_conditions, county, status, tags, is_chronic, created_at, last_visit_at")
        .eq("tenant_id", currentTenantId).order("created_at", { ascending: false }),
      supabase.from("patient_queue").select("id", { count: "exact", head: true })
        .eq("tenant_id", currentTenantId).in("stage", ["checked_in", "waiting", "with_clinician", "awaiting_lab", "awaiting_pharmacy"]),
      supabase.from("patient_followups").select("id", { count: "exact", head: true })
        .eq("tenant_id", currentTenantId).eq("status", "upcoming").lte("due_on", today.toISOString().slice(0, 10)),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .eq("tenant_id", currentTenantId).gte("scheduled_at", today.toISOString()).lt("scheduled_at", tomorrow.toISOString()),
    ]);
    setQueueCount(queue.count ?? 0);
    setDueFollowUps(follow.count ?? 0);
    setApptsToday(appts.count ?? 0);
    if (!error && data) {
      setPatients(data as unknown as Patient[]);
      void cacheList("cache_patients", currentTenantId, data);
    } else {
      const cached = await readCache("cache_patients", currentTenantId);
      if (cached) setPatients(cached as unknown as Patient[]);
    }
  }, [currentTenantId]);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => computePatientStats(patients), [patients]);

  const filtered = useMemo(() => patients.filter((p) => {
    const s = q.toLowerCase().trim();
    const matchesSearch = !s
      || p.full_name.toLowerCase().includes(s)
      || (p.mrn ?? "").toLowerCase().includes(s)
      || (p.phone ?? "").includes(s)
      || (p.sha_number ?? "").toLowerCase().includes(s)
      || (p.national_id ?? "").toLowerCase().includes(s);
    if (!matchesSearch) return false;
    if (status !== "all" && (p.status ?? "active") !== status) return false;
    if (cohort === "chronic" && !p.is_chronic) return false;
    if (cohort === "insured" && !p.insurance_provider && !p.sha_number) return false;
    if (cohort === "self_pay" && (p.insurance_provider || p.sha_number)) return false;
    if (cohort === "children" && !["0-4", "5-14"].includes(ageBand(ageFromDob(p.date_of_birth)))) return false;
    if (cohort === "elderly" && ageBand(ageFromDob(p.date_of_birth)) !== "65+") return false;
    return true;
  }), [patients, q, status, cohort]);

  const exportCsv = () => {
    const rows = filtered.map((p) => ({
      mrn: p.mrn ?? "", name: p.full_name, age: ageFromDob(p.date_of_birth) ?? "",
      gender: p.gender ?? "", county: p.county ?? "", status: p.status ?? "active",
      insurance: p.insurance_provider ?? (p.sha_number ? "SHA" : "self-pay"),
      last_visit: p.last_visit_at ? new Date(p.last_visit_at).toLocaleDateString() : "",
    }));
    const blob = new Blob([toCsv(rows, ["mrn", "name", "age", "gender", "county", "status", "insurance", "last_visit"])], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} patients`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
          <p className="text-muted-foreground">Register, find and follow up on every patient record.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/queue"><ListChecks className="mr-2 h-4 w-4" />Today's queue</Link></Button>
          <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export</Button>
          {canManage && (
            <Button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground">
              <UserPlus className="mr-2 h-4 w-4" />Register patient
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total patients" value={stats.total} hint={`${stats.active} active · ${stats.inactive} archived`} />
        <Kpi label="New patients" value={stats.newToday} hint={`${stats.newThisWeek} this week · ${stats.newThisMonth} this month`} />
        <Kpi label="Waiting now" value={queueCount} hint={`${apptsToday} appointments today`} />
        <Kpi label="Follow-ups due" value={dueFollowUps} hint={`${stats.chronic} chronic patients`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Age distribution</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(Object.entries(stats.ageBands) as [string, number][]).map(([band, n]) => (
              <Badge key={band} variant="outline">{band}: {n}</Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Cover & demographics</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">Insured: {stats.insured}</Badge>
            <Badge variant="outline">Self-pay: {stats.selfPay}</Badge>
            <Badge variant="outline">Male: {stats.male}</Badge>
            <Badge variant="outline">Female: {stats.female}</Badge>
            <Badge variant="outline">Unspecified: {stats.other}</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, MRN, phone, SHA or ID…" className="pl-9" />
          </div>
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cohort} onValueChange={setCohort}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="chronic">Chronic care</SelectItem>
                <SelectItem value="insured">Insured</SelectItem>
                <SelectItem value="self_pay">Self-pay</SelectItem>
                <SelectItem value="children">Children</SelectItem>
                <SelectItem value="elderly">65 and over</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Cover</TableHead>
                  <TableHead>Last visit</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const age = ageFromDob(p.date_of_birth);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.mrn ?? "—"}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          {p.full_name}
                          {p.is_chronic && <Badge variant="destructive">Chronic</Badge>}
                          {(p.status ?? "active") !== "active" && <Badge variant="outline">Archived</Badge>}
                          {(p.tags ?? []).slice(0, 2).map((t) => <Badge key={t} variant="secondary" className="capitalize">{t}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>{age ?? "—"}</TableCell>
                      <TableCell className="capitalize">{p.gender ?? "—"}</TableCell>
                      <TableCell>{p.phone ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.insurance_provider ?? (p.sha_number ? "SHA" : "Self-pay")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.last_visit_at ? new Date(p.last_visit_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell><Button asChild size="sm" variant="outline"><Link to="/patients/$id" params={{ id: p.id }}>Open</Link></Button></TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
                      {patients.length === 0 ? <>No patients yet. Click <strong>Register patient</strong> above.</> : "No patients match these filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RegistrationDialog open={open} onOpenChange={setOpen} existingPatients={patients} onSaved={() => void load()} />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
