
-- 1. Drop the broad SELECT policy on product-images bucket.
-- Public URLs continue to serve files via the storage CDN.
DROP POLICY IF EXISTS "Authenticated users can view product images" ON storage.objects;

-- 2. Move RLS helper functions into a private schema (out of the exposed public API).
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO postgres, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND tenant_id = _tenant_id); $$;

CREATE OR REPLACE FUNCTION private.has_tenant_role(_user_id uuid, _tenant_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = ANY(_roles)); $$;

CREATE OR REPLACE FUNCTION private.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id); $$;

REVOKE EXECUTE ON FUNCTION private.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.has_tenant_role(uuid, uuid, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_tenant_role(uuid, uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_platform_admin(uuid) TO authenticated;

-- 3. Recreate every policy that referenced the old public.* helpers, pointing at private.*
DO $$
DECLARE
  r RECORD;
  new_qual TEXT;
  new_check TEXT;
  cmd_clause TEXT;
  using_clause TEXT;
  check_clause TEXT;
  roles_clause TEXT;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE (qual ILIKE '%public.is_tenant_member%' OR qual ILIKE '%public.has_tenant_role%' OR qual ILIKE '%public.is_platform_admin%'
        OR with_check ILIKE '%public.is_tenant_member%' OR with_check ILIKE '%public.has_tenant_role%' OR with_check ILIKE '%public.is_platform_admin%'
        OR qual ~ '\mis_tenant_member\(' OR qual ~ '\mhas_tenant_role\(' OR qual ~ '\mis_platform_admin\('
        OR with_check ~ '\mis_tenant_member\(' OR with_check ~ '\mhas_tenant_role\(' OR with_check ~ '\mis_platform_admin\(')
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;
    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '(public\.)?is_tenant_member\(',  'private.is_tenant_member(',  'g');
      new_qual := regexp_replace(new_qual, '(public\.)?has_tenant_role\(',   'private.has_tenant_role(',   'g');
      new_qual := regexp_replace(new_qual, '(public\.)?is_platform_admin\(', 'private.is_platform_admin(', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '(public\.)?is_tenant_member\(',  'private.is_tenant_member(',  'g');
      new_check := regexp_replace(new_check, '(public\.)?has_tenant_role\(',   'private.has_tenant_role(',   'g');
      new_check := regexp_replace(new_check, '(public\.)?is_platform_admin\(', 'private.is_platform_admin(', 'g');
    END IF;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    cmd_clause := CASE r.cmd
      WHEN 'SELECT' THEN 'FOR SELECT'
      WHEN 'INSERT' THEN 'FOR INSERT'
      WHEN 'UPDATE' THEN 'FOR UPDATE'
      WHEN 'DELETE' THEN 'FOR DELETE'
      WHEN 'ALL'    THEN 'FOR ALL'
      ELSE ''
    END;
    roles_clause := 'TO ' || array_to_string(r.roles, ', ');
    using_clause := CASE WHEN new_qual IS NOT NULL THEN 'USING (' || new_qual || ')' ELSE '' END;
    check_clause := CASE WHEN new_check IS NOT NULL THEN 'WITH CHECK (' || new_check || ')' ELSE '' END;

    EXECUTE format('CREATE POLICY %I ON %I.%I %s %s %s %s %s',
      r.policyname,
      r.schemaname,
      r.tablename,
      CASE WHEN r.permissive = 'PERMISSIVE' THEN 'AS PERMISSIVE' ELSE 'AS RESTRICTIVE' END,
      cmd_clause,
      roles_clause,
      using_clause,
      check_clause
    );
  END LOOP;
END $$;

-- 4. Drop the old public helpers (now unused).
DROP FUNCTION IF EXISTS public.is_tenant_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_tenant_role(uuid, uuid, public.app_role[]);
DROP FUNCTION IF EXISTS public.is_platform_admin(uuid);
