import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import logo from "@/assets/careconnect-logo.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Reset password — CareConnect Kenya" },
      { name: "description", content: "Choose a new password for your CareConnect Kenya account." },
      { property: "og:title", content: "Reset password — CareConnect Kenya" },
      { property: "og:description", content: "Set a new password to regain access to your CareConnect workspace." },
    ],
  }),
});

function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    await router.navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-3xl bg-card/80 p-8 shadow-[var(--shadow-lg)] backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          <img src={logo} alt="CareConnect Kenya logo" width={64} height={64} className="h-14 w-14" loading="lazy" />
          <h1 className="mt-3 text-xl font-bold">Set a new password</h1>
        </div>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">New password</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                autoComplete="new-password"
                className="h-12 rounded-xl pl-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                autoComplete="new-password"
                className="h-12 rounded-xl pl-11"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl font-semibold">
            {busy ? "…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
