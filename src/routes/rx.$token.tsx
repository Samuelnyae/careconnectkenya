import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill, Printer, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rx/$token")({
  head: () => ({ meta: [{ title: "Your prescription · Afya Cloud" }, { name: "description", content: "View and print your e-prescription." }] }),
  component: PublicRx,
});

type Data = {
  rx: { drug_name: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null; created_at: string } | null;
  patient: { full_name: string } | null;
  tenant: { name: string } | null;
};

function PublicRx() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: res, error: e } = await supabase.functions.invoke("public-prescription", {
        body: undefined, method: "GET",
        // pass token as query
      });
      // The invoke helper doesn't allow query params; call via fetch instead
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-prescription?token=${encodeURIComponent(token)}`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } });
        const j = await r.json();
        if (!r.ok || j.error) { setError(j.error ?? "Could not load"); return; }
        setData(j);
      } catch (err) {
        setError((err as Error).message);
      }
      void res; void e;
    })();
  }, [token]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full"><CardContent className="pt-6 text-center space-y-2">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold">Cannot open prescription</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </CardContent></Card>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-muted/30 p-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="print:shadow-none print:border-0">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" />E-Prescription</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{data.tenant?.name ?? "Afya Cloud"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
                <Printer className="mr-1 h-4 w-4" />Print
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs uppercase text-muted-foreground">Patient</div>
              <div className="font-medium">{data.patient?.full_name ?? "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase text-muted-foreground">Medication</div>
              <div className="text-2xl font-bold">{data.rx?.drug_name}</div>
              {data.rx?.dosage && <div className="text-lg">{data.rx.dosage}</div>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs uppercase text-muted-foreground">Frequency</div>{data.rx?.frequency ?? "—"}</div>
              <div><div className="text-xs uppercase text-muted-foreground">Duration</div>{data.rx?.duration ?? "—"}</div>
            </div>
            {data.rx?.instructions && (
              <div>
                <div className="text-xs uppercase text-muted-foreground">Instructions</div>
                <p className="text-sm">{data.rx.instructions}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-3 border-t">
              Issued {data.rx?.created_at ? new Date(data.rx.created_at).toLocaleDateString() : ""}. Present this prescription at any licensed pharmacy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}