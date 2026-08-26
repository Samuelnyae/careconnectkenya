import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText, RefreshCw, Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Trail | CareConnect Kenya" },
      { name: "description", content: "Immutable record of who accessed or changed patient data in your facility." },
      { property: "og:title", content: "Audit Trail | CareConnect Kenya" },
      { property: "og:description", content: "Review every access to patient records in your facility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ProtectedLayout>
      <AuditLogPage />
    </ProtectedLayout>
  ),
});

type Row = {
  id: string;
  actor_email: string | null;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: unknown;
  created_at: string;
};

const ACTION_TONE: Record<string, string> = {
  view: "bg-muted text-muted-foreground",
  create: "bg-primary/10 text-primary",
  update: "bg-accent/20 text-accent-foreground",
  dispense: "bg-primary/10 text-primary",
  send: "bg-accent/20 text-accent-foreground",
  search: "bg-muted text-muted-foreground",
  submit: "bg-primary/10 text-primary",
  data: "bg-destructive/10 text-destructive",
};

function AuditLogPage() {
  const { currentTenantId, currentRole } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");

  const canView = currentRole === "owner" || currentRole === "admin";

  const load = useCallback(async () => {
    if (!currentTenantId || !canView) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, actor_email, actor_id, action, entity, entity_id, meta, created_at")
      .eq("tenant_id", currentTenantId)
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  }, [currentTenantId, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  const entities = useMemo(() => Array.from(new Set(rows.map((r) => r.entity))).sort(), [rows]);

  const filtered = rows.filter((r) => {
    if (entity !== "all" && r.entity !== entity) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      (r.actor_email ?? "").toLowerCase().includes(s) ||
      r.action.toLowerCase().includes(s) ||
      r.entity.toLowerCase().includes(s) ||
      (r.entity_id ?? "").toLowerCase().includes(s)
    );
  });

  const exportCsv = () => {
    const header = ["timestamp", "actor", "action", "entity", "entity_id"];
    const lines = filtered.map((r) =>
      [r.created_at, r.actor_email ?? r.actor_id ?? "", r.action, r.entity, r.entity_id ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <div className="text-lg font-semibold">Restricted</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Only facility owners and administrators can review the audit trail.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground">
            Append-only record of who accessed or changed patient data. Entries cannot be edited or deleted.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            {filtered.length} event{filtered.length === 1 ? "" : "s"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-56"
              placeholder="Search staff, action, record…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All record types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All record types</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No audit events yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const verb = r.action.split(".").pop() ?? r.action;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{r.actor_email ?? r.actor_id?.slice(0, 8) ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={ACTION_TONE[verb] ?? "bg-muted text-muted-foreground"}>{r.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.entity}
                        {r.entity_id ? (
                          <span className="ml-1 text-xs text-muted-foreground">#{r.entity_id.slice(0, 8)}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[22rem] truncate text-xs text-muted-foreground">
                        {r.meta && Object.keys(r.meta as object).length > 0 ? JSON.stringify(r.meta) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
