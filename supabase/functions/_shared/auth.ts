// Shared tenant-membership guard for AI edge functions.
// Verifies the caller's JWT and that the user belongs to the requested tenant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export async function requireTenantMember(req: Request, tenantId: string): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing authorization" };
  }

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await anon.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return { ok: false, status: 401, error: "Unauthorized" };

  // Membership check runs as the caller; RLS on memberships only exposes their own rows.
  const { data: membership } = await anon
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!membership) {
    const { data: isAdmin } = await anon
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!isAdmin) return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, userId: user.id };
}
