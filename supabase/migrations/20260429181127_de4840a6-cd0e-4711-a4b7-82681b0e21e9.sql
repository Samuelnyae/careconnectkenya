-- Rename NHIF -> SHA on patients
ALTER TABLE public.patients RENAME COLUMN nhif_number TO sha_number;

-- SHA claims table
CREATE TABLE public.sha_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  claim_number TEXT,
  services_rendered TEXT,
  diagnosis TEXT,
  amount_claimed NUMERIC NOT NULL DEFAULT 0,
  amount_approved NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  submission_date TIMESTAMPTZ,
  response_date TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sha_claims_tenant ON public.sha_claims(tenant_id);
CREATE INDEX idx_sha_claims_patient ON public.sha_claims(patient_id);
CREATE INDEX idx_sha_claims_status ON public.sha_claims(tenant_id, status);

ALTER TABLE public.sha_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sha claims" ON public.sha_claims FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert sha claims" ON public.sha_claims FOR INSERT
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist','staff']::app_role[]));
CREATE POLICY "Staff update sha claims" ON public.sha_claims FOR UPDATE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist','staff']::app_role[]));
CREATE POLICY "Admins delete sha claims" ON public.sha_claims FOR DELETE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::app_role[]));
CREATE POLICY "Platform admins view all sha claims" ON public.sha_claims FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER sha_claims_updated_at BEFORE UPDATE ON public.sha_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();