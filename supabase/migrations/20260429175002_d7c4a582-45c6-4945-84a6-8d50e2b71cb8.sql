-- Patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  phone TEXT,
  email TEXT,
  national_id TEXT,
  nhif_number TEXT,
  address TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_patients_tenant ON public.patients(tenant_id);
CREATE INDEX idx_patients_name ON public.patients(tenant_id, full_name);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view patients" ON public.patients FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert patients" ON public.patients FOR INSERT
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist','staff','cashier']::app_role[]));
CREATE POLICY "Staff update patients" ON public.patients FOR UPDATE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist','staff']::app_role[]));
CREATE POLICY "Admins delete patients" ON public.patients FOR DELETE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::app_role[]));
CREATE POLICY "Platform admins view all patients" ON public.patients FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Patient visits / encounters
CREATE TABLE public.patient_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  diagnosis TEXT,
  vitals JSONB,
  notes TEXT,
  attended_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visits_patient ON public.patient_visits(patient_id);
CREATE INDEX idx_visits_tenant ON public.patient_visits(tenant_id);

ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view visits" ON public.patient_visits FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert visits" ON public.patient_visits FOR INSERT
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist','staff']::app_role[]));
CREATE POLICY "Staff update visits" ON public.patient_visits FOR UPDATE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist','staff']::app_role[]));
CREATE POLICY "Admins delete visits" ON public.patient_visits FOR DELETE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER visits_updated_at BEFORE UPDATE ON public.patient_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prescriptions
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  drug_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  prescribed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rx_patient ON public.prescriptions(patient_id);
CREATE INDEX idx_rx_tenant ON public.prescriptions(tenant_id);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view rx" ON public.prescriptions FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert rx" ON public.prescriptions FOR INSERT
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::app_role[]));
CREATE POLICY "Staff update rx" ON public.prescriptions FOR UPDATE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::app_role[]));
CREATE POLICY "Admins delete rx" ON public.prescriptions FOR DELETE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::app_role[]));

-- Link sales to patients (optional)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL;