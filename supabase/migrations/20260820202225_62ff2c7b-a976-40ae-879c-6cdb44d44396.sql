-- 1. Remove open membership bootstrap policy; create membership via trigger instead
DROP POLICY IF EXISTS "Users can insert own membership (bootstrap)" ON public.memberships;

CREATE OR REPLACE FUNCTION public.create_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, tenant_id, role)
    VALUES (NEW.created_by, NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.create_owner_membership() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tenant_owner_membership ON public.tenants;
CREATE TRIGGER trg_tenant_owner_membership
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.create_owner_membership();

-- 2. Scope product-images storage writes to the owning tenant folder
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

CREATE POLICY "Members upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images' AND EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Members update own tenant product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images' AND EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'product-images' AND EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Members delete own tenant product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images' AND EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id::text = (storage.foldername(name))[1]
  )
);