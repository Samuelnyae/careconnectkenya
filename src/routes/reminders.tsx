import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendReminderNow } from "@/server/messaging.functions";
import { Bell, Send, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reminders")({
  component: () => <ProtectedLayout><RemindersPage /></ProtectedLayout>,
});

type Reminder = {
  id: string; reminder_type: string; message: string; channels: string[];
  scheduled_at: string; sent_at: string | null; status: string; error_message: string | null;
  patients: { full_name: string; phone: string | null } | null;
};

function RemindersPage() {
  const { currentTenantId } = useAuth();
  const [items, setItems] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "failed">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const send = useServerFn(sendReminderNow);

  const load = useCallback(async () => {
    if (!currentTenantId) return;
    let q = supabase.from("reminders")
      .select("id, reminder_type, message, channels, scheduled_at, sent_at, status, error_message, patients(full_name, phone)")
      .eq("tenant_id", currentTenantId).order("scheduled_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setItems((data ?? []) as unknown as Reminder[]);
  }, [currentTenantId, filter]);
  useEffect(() => { void load(); }, [load]);

  const sendNow = async (id: string) => {
    setBusy(id);
    try {
      const res = await send({ data: { reminderId: id } });
      if (res.ok) toast.success("Sent");
      else toast.error(res.results.map((r: any) => `${r.channel}: ${r.error}`).join("; "));
      void load();
    } catch (e: any) { toast.error(e?.message || "Send failed"); }
    finally { setBusy(null); }
  };

  const cancel = async (id: string) => {
    const { error } = await supabase.from("reminders").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const tone = (s: string) => s === "sent" ? "secondary" : s === "failed" ? "destructive" : s === "cancelled" ? "outline" : "default";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reminders</h1>
          <p className="text-muted-foreground">SMS, WhatsApp & Telegram reminders for patients.</p>
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "sent", "failed"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" />{items.length} reminder{items.length === 1 ? "" : "s"}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No reminders.</div>}
          {items.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{r.patients?.full_name ?? "Patient"}</span>
                  <Badge variant={tone(r.status)}>{r.status}</Badge>
                  <span className="text-xs uppercase text-muted-foreground">{r.reminder_type.replace("_", " ")}</span>
                  <span className="text-xs text-muted-foreground">via {(r.channels ?? []).join(", ")}</span>
                </div>
                <div className="text-sm mt-1">{r.message}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Scheduled {new Date(r.scheduled_at).toLocaleString()}
                  {r.sent_at && ` · Sent ${new Date(r.sent_at).toLocaleString()}`}
                </div>
                {r.error_message && <div className="text-xs text-destructive mt-1">{r.error_message}</div>}
              </div>
              {(r.status === "pending" || r.status === "failed") && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void sendNow(r.id)} disabled={busy === r.id}>
                    {busy === r.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}Send now
                  </Button>
                  {r.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => void cancel(r.id)}><XCircle className="mr-1 h-3 w-3" />Cancel</Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}