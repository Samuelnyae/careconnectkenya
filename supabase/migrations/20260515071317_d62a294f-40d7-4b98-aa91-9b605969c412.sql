
-- 1. Fix function search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- 2. Move pg_net out of public schema (drop + recreate; pg_net doesn't support SET SCHEMA)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- 3. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_sale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_county_from_tenant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;

-- 4. Restrict product-images bucket listing to authenticated users.
DROP POLICY IF EXISTS "Product images are publicly viewable" ON storage.objects;
CREATE POLICY "Authenticated users can view product images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'product-images');
