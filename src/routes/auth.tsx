import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, User, ArrowLeft } from "lucide-react";
import logo from "@/assets/careconnect-logo.png";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — CareConnect Kenya" },
      { name: "description", content: "Sign in or create your CareConnect Kenya account to manage patients, prescriptions and pharmacy stock." },
      { property: "og:title", content: "Sign in — CareConnect Kenya" },
      { property: "og:description", content: "Access your clinic, pharmacy or lab workspace on CareConnect Kenya." },
    ],
  }),
});

type Mode = "login" | "register";

function AuthPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading)
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/dashboard" />;

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const signUp = async () => {
    if (!agree) return toast.error("Please accept the Terms of Service and Privacy Policy");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Check your email to confirm, then sign in.");
    setMode("login");
  };

  const forgotPassword = async () => {
    if (!email) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent");
  };

  const fieldClass =
    "h-12 rounded-xl border-border/60 bg-card pl-11 text-sm shadow-sm focus-visible:ring-primary/40";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-card shadow-sm transition-colors hover:bg-accent"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="rounded-3xl bg-card/80 p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-8">
          {/* Brand */}
          <div className="flex flex-col items-center text-center">
            <img src={logo} alt="CareConnect Kenya logo" width={72} height={72} className="h-16 w-16" />
            <h1 className="mt-2 text-2xl font-bold tracking-tight">CareConnect</h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Care Delivered</p>
          </div>

          <div className="mt-6 text-center">
            <h2 className="text-xl font-bold">{mode === "login" ? "Welcome Back" : "Create account"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "login"
                ? "Login to your account and let's deliver care to you"
                : "Register to manage your facility, patients and medicines"}
            </p>
          </div>

          {/* Segmented switcher */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-10 rounded-lg text-sm font-semibold capitalize transition-all ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void (mode === "login" ? signIn() : signUp());
            }}
          >
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className={fieldClass}
                    placeholder="Omar Mohammed"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  autoComplete="email"
                  className={fieldClass}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className={`${fieldClass} pr-11`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    className={`${fieldClass} pr-11`}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "login" ? (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => void forgotPassword()}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            ) : (
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(Boolean(v))} className="mt-0.5" />
                <span>
                  I agree to the <span className="font-semibold text-primary">Terms of Services</span> and{" "}
                  <span className="font-semibold text-primary">Privacy Policy</span>
                </span>
              </label>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold shadow-[var(--shadow-glow)] hover:bg-primary/90"
            >
              {busy ? "…" : mode === "login" ? "Login" : "Register"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">Or continue with</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void oauth("google")}
              className="h-12 w-full rounded-xl"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.8 17.6 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.5 24c0-1.6-.1-2.8-.4-4.1H24v8.3h12.8c-.3 2.1-1.7 5.3-4.9 7.4l7.6 5.9c4.5-4.2 7-10.3 7-17.5z" />
                <path fill="#FBBC05" d="M10.4 28.1a14.6 14.6 0 0 1 0-8.2l-7.8-6.1a23.5 23.5 0 0 0 0 20.4l7.8-6.1z" />
                <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.5-5.6l-7.6-5.9c-2.1 1.4-4.8 2.4-7.9 2.4-6.4 0-11.7-4.3-13.6-10.3l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
              </svg>
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void oauth("apple")}
              className="h-12 w-full rounded-xl"
            >
              <svg className="mr-2 h-4 w-4 fill-current" viewBox="0 0 384 512" aria-hidden="true">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-36.8-2.8-77 21.3-91.7 21.3-15.6 0-51.2-20.3-79.2-20.3C61.4 141.2 8 184.4 8 272.2c0 26 4.8 52.8 14.3 80.5 12.7 36.4 46.5 122.3 92.8 120.9 24.2-.6 41.3-17.2 72.8-17.2 30.6 0 46.4 17.2 73.4 17.2 46.7-.7 77.3-78.3 89.4-114.8-62.5-29.5-31.9-86.7-32-90.1zM255.3 84.3C278.5 56.8 276.4 31.8 275.7 24c-20.5 1.2-44.2 14-57.7 29.7-14.9 16.9-23.6 37.8-21.7 61.3 22.2 1.7 42.5-9.7 58.9-30.7z" />
              </svg>
              Apple
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "login" ? "I don't have an account?" : "I already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "login" ? "Register" : "Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
