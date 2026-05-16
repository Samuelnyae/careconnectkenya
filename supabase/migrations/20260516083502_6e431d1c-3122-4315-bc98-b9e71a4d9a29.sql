-- Allow platform admins to manage tenants and memberships across all orgs
CREATE POLICY "Platform admins update all tenants"
ON public.tenants FOR UPDATE
USING (private.is_platform_admin(auth.uid()))
WITH CHECK (private.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins delete tenants"
ON public.tenants FOR DELETE
USING (private.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins manage memberships"
ON public.memberships FOR ALL
USING (private.is_platform_admin(auth.uid()))
WITH CHECK (private.is_platform_admin(auth.uid()));