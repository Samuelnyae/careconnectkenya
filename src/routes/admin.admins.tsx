import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trash2, ShieldPlus } from "lucide-react";

export const Route = createFileRoute("/admin/admins")({
  component: AdminsPage,
});

type Row = { user_id: string; created_at: string };

function AdminsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [newId, setNewId] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("platform_admins").select("user_id, created_at").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    const id = newId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return toast.error("Enter a valid user UUID");
    setAdding(true);
    const { error } = await supabase.from("platform_admins").insert({ user_id: id });
    setAdding(false);
    if (error) return toast.error(error.message);
    toast.success("Platform admin added");
    setNewId("");
    void load();
  };

  const remove = async (id: string) => {
    if (id === user?.id && !confirm("Remove YOURSELF as platform admin? You will lose access immediately.")) return;
    if (id !== user?.id && !confirm("Remove this platform admin?")) return;
    const { error } = await supabase.from("platform_admins").delete().eq("user_id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    void load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Admins</h1>
        <p className="text-muted-foreground">Super-users with cross-organization access.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldPlus className="h-5 w-5" /> Grant admin</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 max-w-md">
            <Label>User ID (UUID)</Label>
            <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="e.g. 8f9ac634-af20-4507-8e55-0a5cd8f39282" />
            <p className="text-xs text-muted-foreground">Have the user sign up first, then paste their auth user UUID here.</p>
          </div>
          <Button onClick={() => void add()} disabled={adding}>{adding ? "Adding…" : "Add platform admin"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{rows.length} admins</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>User ID</TableHead><TableHead>Added</TableHead><TableHead className="w-20" /></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-mono text-xs">{r.user_id} {r.user_id === user?.id && <Badge className="ml-2">You</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void remove(r.user_id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No platform admins</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}