import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { listOutbox } from "@/lib/offline/db";
import { syncOutbox, attachSyncTriggers } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function OfflineIndicator() {
  const { currentTenantId } = useAuth();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    if (!currentTenantId) { setPending(0); return; }
    try {
      const ops = await listOutbox(currentTenantId);
      setPending(ops.length);
    } catch { /* ignore */ }
  }, [currentTenantId]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!currentTenantId) return;
    void refreshCount();
    const detach = attachSyncTriggers(currentTenantId, (r) => {
      if (r.processed) toast.success(`Synced ${r.processed} offline ${r.processed === 1 ? "item" : "items"}`);
      void refreshCount();
    });
    const i = window.setInterval(refreshCount, 5000);
    return () => { detach(); window.clearInterval(i); };
  }, [currentTenantId, refreshCount]);

  const sync = async () => {
    if (!currentTenantId) return;
    setSyncing(true);
    const r = await syncOutbox(currentTenantId);
    setSyncing(false);
    await refreshCount();
    if (r.processed) toast.success(`Synced ${r.processed} items`);
    else if (r.failed) toast.error(`${r.failed} items failed to sync`);
    else toast.info("Nothing to sync");
  };

  if (online && pending === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs">
      {online ? <Wifi className="h-3.5 w-3.5 text-green-600" /> : <WifiOff className="h-3.5 w-3.5 text-amber-600" />}
      <span className="font-medium">{online ? "Online" : "Offline"}</span>
      {pending > 0 && (
        <>
          <span className="text-muted-foreground">·</span>
          <span>{pending} pending</span>
          <Button size="sm" variant="ghost" className="h-6 px-2" disabled={!online || syncing} onClick={() => void sync()}>
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          </Button>
        </>
      )}
    </div>
  );
}