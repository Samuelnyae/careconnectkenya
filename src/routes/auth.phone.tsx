import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Phone, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth/phone")({
  component: PhoneAuth,
});

function PhoneAuth() {
  const { user, loading } = useAuth();
  const [phone, setPhone] = useState("+254");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/dashboard" />;

  const sendCode = async () => {
    if (!/^\+?[0-9]{9,15}$/.test(phone)) return toast.error("Enter a valid phone number");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("send-otp", { body: { phone } });
    setBusy(false);
    if (error || data?.error) return toast.error(error?.message ?? data?.error);
    setChallenge(data.challenge);
    setDevCode(data.devCode ?? null);
    if (data.smsStatus === "dev_mode") {
      toast.warning(`SMS provider not configured — dev code shown below`);
    } else {
      toast.success("Code sent via SMS");
    }
  };

  const verify = async () => {
    if (!challenge) return;
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("verify-otp", { body: { phone, code, challenge } });
    setBusy(false);
    if (error || data?.error) return toast.error(error?.message ?? data?.error);
    if (data?.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      toast.success("Welcome!");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary"><Phone className="h-5 w-5" /><CardTitle>Sign in by phone</CardTitle></div>
          <CardDescription>For patients in rural areas — no email needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!challenge ? (
            <>
              <div>
                <Label>Phone number</Label>
                <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2547XXXXXXXX" />
                <p className="text-xs text-muted-foreground mt-1">Include country code, e.g. +254 for Kenya.</p>
              </div>
              <Button onClick={() => void sendCode()} disabled={busy} className="w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}Send code
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label>6-digit code</Label>
                <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="text-center text-2xl tracking-widest" />
                {devCode && <p className="mt-2 text-xs text-amber-600">Dev mode code: <strong>{devCode}</strong></p>}
              </div>
              <Button onClick={() => void verify()} disabled={busy} className="w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Verify & sign in
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setChallenge(null); setCode(""); setDevCode(null); }} className="w-full">Use a different number</Button>
            </>
          )}
          <Button asChild variant="link" size="sm" className="w-full">
            <Link to="/auth"><ArrowLeft className="mr-1 h-3 w-3" />Back to email sign-in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}