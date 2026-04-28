import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/settings")({
  component: () => <ProtectedLayout><SettingsPage /></ProtectedLayout>,
});

type Member = { id: string; user_id: string; role: string };
const ROLES = ["owner", "admin", "pharmacist", "cashier", "staff"] as const;

function SettingsPage() {
  const { currentTenantId, currentTenant, currentRole, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = currentRole === "owner" || currentRole === "admin";

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    const { data } = await supabase.from("memberships").select("id, user_id, role").eq("tenant_id", currentTenantId);
    setMembers((data ?? []) as Member[]);
  }, [currentTenantId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setName(currentTenant?.name ?? ""); }, [currentTenant]);

  const saveName = async () => {
    if (!currentTenantId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("tenants").update({ name: name.trim() }).eq("id", currentTenantId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Organization name updated");
  };

  const updateRole = async (id: string, role: string) => {
    const { error } = await supabase.from("memberships").update({ role: role as AppRole }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    void load();
  };

  const removeMember = async (id: string) => {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("memberships").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    void load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your organization and team.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-md">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
          </div>
          <div className="text-sm text-muted-foreground">Type: {currentTenant?.type} · Slug: {currentTenant?.slug}</div>
          {canManage && <Button onClick={() => void saveName()} disabled={saving}>Save</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team members ({members.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>User ID</TableHead><TableHead>Role</TableHead><TableHead className="w-20" /></TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.user_id === user?.id ? <Badge>You</Badge> : m.user_id.slice(0, 8) + "…"}</TableCell>
                  <TableCell>
                    {canManage && m.user_id !== user?.id ? (
                      <Select value={m.role} onValueChange={(v) => void updateRole(m.id, v)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Badge variant="secondary">{m.role}</Badge>}
                  </TableCell>
                  <TableCell>
                    {canManage && m.user_id !== user?.id && (
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void removeMember(m.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No members</TableCell></TableRow>}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4">
            To add a team member: have them sign up, then share their user ID with an owner/admin to be added directly via the database.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}