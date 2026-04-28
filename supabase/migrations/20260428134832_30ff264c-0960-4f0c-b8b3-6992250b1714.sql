-- Fix tenant insert policy: explicitly target authenticated users
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

CREATE POLICY "Authenticated users can create tenants"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Also ensure the post-insert SELECT works for the creator (before membership exists)
DROP POLICY IF EXISTS "Members can view their tenants" ON public.tenants;

CREATE POLICY "Members or creator can view tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (is_tenant_member(auth.uid(), id) OR created_by = auth.uid());