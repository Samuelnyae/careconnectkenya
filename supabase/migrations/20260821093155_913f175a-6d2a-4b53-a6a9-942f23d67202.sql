-- 1. Audit log (append-only) for patient-data access & sensitive actions
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  meta jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (tenant_id, entity, entity_id);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (tenant_id, actor_id, created_at DESC);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Any member of the tenant may append their own audit entries.
CREATE POLICY "audit_insert_own" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (private.is_tenant_member(auth.uid(), tenant_id) AND actor_id = auth.uid());

-- Only owners/admins can read the trail; platform admins can read everything.
CREATE POLICY "audit_select_admins" ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE POLICY "audit_select_platform" ON public.audit_logs FOR SELECT TO authenticated
  USING (private.is_platform_admin(auth.uid()));

-- No UPDATE or DELETE policies: the trail is immutable via the Data API.

-- 2. Patient consent capture (Kenya Data Protection Act 2019)
ALTER TABLE public.patients
  ADD COLUMN consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN consent_at timestamp with time zone,
  ADD COLUMN consent_method text,
  ADD COLUMN data_retention_until date;

CREATE OR REPLACE FUNCTION public.stamp_patient_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.consent_given AND NEW.consent_at IS NULL THEN
    NEW.consent_at = now();
  END IF;
  IF NOT NEW.consent_given THEN
    NEW.consent_at = NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_patients_consent
  BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.stamp_patient_consent();

REVOKE EXECUTE ON FUNCTION public.stamp_patient_consent() FROM anon, authenticated;