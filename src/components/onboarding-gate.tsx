import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function OnboardingGate() {
  const { user, refreshMemberships } = useAuth();
  const [name, setName] = useState("");
  const [type, setType] = useState("pharmacy");
  const [loading, setLoading] = useState(false);

  const createTenant = async () => {
    if (!user || !name.trim()) return;
    setLoading(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const { data: tenant, error } = await supabase
      .from("tenants")
      .insert({ name: name.trim(), slug, type, created_by: user.id })
      .select()
      .single();
    if (error || !tenant) {
      toast.error(error?.message ?? "Failed to create organization");
      setLoading(false);
      return;
    }
    const { error: mErr } = await supabase
      .from("memberships")
      .insert({ user_id: user.id, tenant_id: tenant.id, role: "owner" });
    if (mErr) {
      toast.error(mErr.message);
      setLoading(false);
      return;
    }
    toast.success("Organization created");
    await refreshMemberships();
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--gradient-subtle)] p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-lg)]">
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>Set up your clinic, pharmacy, or hospital to get started.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nairobi Pharmacy" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="pharmacy">Pharmacy</option>
              <option value="clinic">Clinic</option>
              <option value="hospital">Hospital</option>
              <option value="lab">Diagnostic Lab</option>
              <option value="telemedicine">Telemedicine</option>
            </select>
          </div>
          <Button onClick={() => void createTenant()} disabled={loading || !name.trim()} className="w-full">
            {loading ? "Creating…" : "Create organization"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}