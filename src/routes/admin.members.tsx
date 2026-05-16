import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/admin/members")({
  component: MembersPage,
});

type Row = {
  id: string; user_id: string; role: string; tenant_id: string;
  tenants: { name: string; slug: string } | null;
};

const ROLES: AppRole[] = ["owner", "admin", "doctor", "pharmacist", "cashier", "staff", "chv"];

function MembersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("memberships")
      .select("id, user_id, role, tenant_id, tenants(name, slug)")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as unknown as Row[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateRole = async (id: string, role: AppRole) => {
    const { error } = await supabase.from("memberships").update({ role }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this member from the organization?")) return;
    const { error } = await supabase.from("memberships").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    void load();
  };

  const filtered = rows.filter((r) =>
    !q ||
    r.tenants?.name.toLowerCase().includes(q.toLowerCase()) ||
    r.tenants?.slug.toLowerCase().includes(q.toLowerCase()) ||
    r.user_id.toLowerCase().includes(q.toLowerCase()) ||
    r.role.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">All members across every organization.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search org / user id / role" className="pl-8" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{filtered.length} memberships</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead><TableHead>User ID</TableHead><TableHead>Role</TableHead><TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.tenants?.name ?? "—"}<div className="text-xs text-muted-foreground font-mono">{r.tenants?.slug}</div></TableCell>
                  <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                  <TableCell>
                    <Select value={r.role} onValueChange={(v) => void updateRole(r.id, v as AppRole)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No members</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}