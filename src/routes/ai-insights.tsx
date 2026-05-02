import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, AlertTriangle, Activity, Wallet, PackageSearch } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ai-insights")({
  component: () => <ProtectedLayout><AIInsights /></ProtectedLayout>,
});

type Anomaly = { prescription_id: string; drug: string; patient?: string; severity: "low"|"medium"|"high"; issue: string; recommendation: string };
type Outbreak = { suspected_condition: string; drugs_spiking: string[]; spike_pct?: number; confidence: "low"|"medium"|"high"; recommendation: string };
type CreditScore = { customer_id: string; name: string; risk: "low"|"medium"|"high"; score: number; rationale: string; recommended_credit_limit_kes: number };
type Reorder = { product_id: string; name: string; current_stock: number; days_remaining: number; urgency: "low"|"medium"|"high"|"critical"; suggested_reorder_qty: number; reason: string };

function severityTone(sev: string): "default" | "secondary" | "destructive" {
  if (sev === "high" || sev === "critical") return "destructive";
  if (sev === "medium") return "default";
  return "secondary";
}

function AIInsights() {
  const { currentTenantId } = useAuth();

  const [rxLoading, setRxLoading] = useState(false);
  const [rxData, setRxData] = useState<{ summary: string; anomalies: Anomaly[] } | null>(null);

  const [obLoading, setObLoading] = useState(false);
  const [obData, setObData] = useState<{ summary: string; alerts: Outbreak[] } | null>(null);

  const [crLoading, setCrLoading] = useState(false);
  const [crData, setCrData] = useState<{ summary: string; scores: CreditScore[] } | null>(null);

  const [roLoading, setRoLoading] = useState(false);
  const [roData, setRoData] = useState<{ summary: string; recommendations: Reorder[] } | null>(null);

  const run = async <T,>(fn: string, setLoading: (b: boolean) => void, setData: (d: T) => void) => {
    if (!currentTenantId) return toast.error("No tenant selected");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke(fn, { body: { tenant_id: currentTenantId } });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data?.error) return toast.error(data.error);
    setData(data as T);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI Insights</h1>
          <p className="text-sm text-muted-foreground">AI-powered analysis of clinical and operational data.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prescription anomalies */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Prescription Anomaly Detection</CardTitle>
              <CardDescription>Flag unusual dosages, conflicts, and risky patterns in recent prescriptions.</CardDescription>
            </div>
            <Button size="sm" onClick={() => void run("ai-anomaly-rx", setRxLoading, setRxData)} disabled={rxLoading}>
              {rxLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              Analyze
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!rxData && <p className="text-sm text-muted-foreground">Click Analyze to scan the last 30 days of prescriptions.</p>}
            {rxData && (
              <>
                <p className="text-sm">{rxData.summary}</p>
                {rxData.anomalies.length === 0 && <p className="text-sm text-muted-foreground">No anomalies detected.</p>}
                {rxData.anomalies.map((a, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={severityTone(a.severity)}>{a.severity.toUpperCase()}</Badge>
                      <span className="text-sm font-medium">{a.drug}</span>
                      {a.patient && <span className="text-xs text-muted-foreground">· {a.patient}</span>}
                    </div>
                    <p className="text-sm">{a.issue}</p>
                    <p className="text-sm text-muted-foreground italic">→ {a.recommendation}</p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Outbreak detection */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Disease Outbreak Early Warning</CardTitle>
              <CardDescription>Detects sales spikes that may signal an emerging outbreak.</CardDescription>
            </div>
            <Button size="sm" onClick={() => void run("ai-outbreak-detect", setObLoading, setObData)} disabled={obLoading}>
              {obLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              Analyze
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!obData && <p className="text-sm text-muted-foreground">Click Analyze to scan 60 days of pharmacy sales.</p>}
            {obData && (
              <>
                <p className="text-sm">{obData.summary}</p>
                {obData.alerts.length === 0 && <p className="text-sm text-muted-foreground">No outbreak signals detected.</p>}
                {obData.alerts.map((a, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={severityTone(a.confidence)}>{a.confidence.toUpperCase()} CONFIDENCE</Badge>
                      <span className="text-sm font-medium">{a.suspected_condition}</span>
                      {typeof a.spike_pct === "number" && <span className="text-xs text-muted-foreground">+{Math.round(a.spike_pct)}%</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">Drugs: {a.drugs_spiking.join(", ")}</p>
                    <p className="text-sm text-muted-foreground italic">→ {a.recommendation}</p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Credit risk */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" />Credit Risk Scoring</CardTitle>
              <CardDescription>Score customers buying on credit by repayment risk.</CardDescription>
            </div>
            <Button size="sm" onClick={() => void run("ai-credit-risk", setCrLoading, setCrData)} disabled={crLoading}>
              {crLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              Analyze
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!crData && <p className="text-sm text-muted-foreground">Uses sales with payment_method = "credit" from the last 180 days.</p>}
            {crData && (
              <>
                <p className="text-sm">{crData.summary}</p>
                {crData.scores.length === 0 && <p className="text-sm text-muted-foreground">No customers to score.</p>}
                {crData.scores.map((s, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={severityTone(s.risk)}>{s.risk.toUpperCase()}</Badge>
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Score {Math.round(s.score)}/100</span>
                    </div>
                    <p className="text-sm">{s.rationale}</p>
                    <p className="text-sm text-muted-foreground">Suggested credit limit: KES {s.recommended_credit_limit_kes.toLocaleString()}</p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Reorder forecast */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><PackageSearch className="h-4 w-4" />Smart Reorder Forecasting</CardTitle>
              <CardDescription>Predicts which products to restock based on 90-day sales velocity.</CardDescription>
            </div>
            <Button size="sm" onClick={() => void run("ai-reorder-forecast", setRoLoading, setRoData)} disabled={roLoading}>
              {roLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              Analyze
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!roData && <p className="text-sm text-muted-foreground">Click Analyze to forecast reorder needs.</p>}
            {roData && (
              <>
                <p className="text-sm">{roData.summary}</p>
                {roData.recommendations.length === 0 && <p className="text-sm text-muted-foreground">No reorders needed right now.</p>}
                {roData.recommendations.map((r, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={severityTone(r.urgency)}>{r.urgency.toUpperCase()}</Badge>
                        <span className="text-sm font-medium">{r.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Stock: {r.current_stock} · {Math.round(r.days_remaining)}d left</span>
                    </div>
                    <p className="text-sm">{r.reason}</p>
                    <p className="text-sm text-muted-foreground">Suggested reorder: <span className="font-medium text-foreground">{r.suggested_reorder_qty} units</span></p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">⚠ AI suggestions are advisory. Verify clinical and financial decisions before acting.</p>
    </div>
  );
}