-- ============ helper: tenant-scoped MRN ============
CREATE TABLE IF NOT EXISTS public.tenant_counters (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_seq bigint NOT NULL DEFAULT 0
);
GRANT SELECT ON public.tenant_counters TO authenticated;
GRANT ALL ON public.tenant_counters TO service_role;
ALTER TABLE public.tenant_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters readable by members" ON public.tenant_counters
  FOR SELECT TO authenticated USING (private.is_tenant_member(auth.uid(), tenant_id));

-- ============ patients: demographics & admin fields ============
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS mrn text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS alt_phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_address text,
  ADD COLUMN IF NOT EXISTS emergency_name text,
  ADD COLUMN IF NOT EXISTS emergency_relationship text,
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  ADD COLUMN IF NOT EXISTS emergency_alt_phone text,
  ADD COLUMN IF NOT EXISTS emergency_address text,
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_member_number text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS insurance_scheme text,
  ADD COLUMN IF NOT EXISTS insurance_principal text,
  ADD COLUMN IF NOT EXISTS insurance_relationship text,
  ADD COLUMN IF NOT EXISTS insurance_expiry date,
  ADD COLUMN IF NOT EXISTS insurance_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_visit_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS patients_tenant_mrn_key ON public.patients(tenant_id, mrn) WHERE mrn IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_patient_mrn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nxt bigint;
BEGIN
  IF NEW.mrn IS NULL THEN
    INSERT INTO public.tenant_counters (tenant_id, patient_seq)
      VALUES (NEW.tenant_id, 1)
      ON CONFLICT (tenant_id) DO UPDATE SET patient_seq = public.tenant_counters.patient_seq + 1
      RETURNING patient_seq INTO nxt;
    NEW.mrn := 'HMS-' || lpad(nxt::text, 7, '0');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.assign_patient_mrn() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_patients_mrn ON public.patients;
CREATE TRIGGER trg_patients_mrn BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.assign_patient_mrn();

-- backfill MRNs for existing rows
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT id, tenant_id FROM public.patients WHERE mrn IS NULL ORDER BY created_at LOOP
    INSERT INTO public.tenant_counters (tenant_id, patient_seq) VALUES (r.tenant_id, 1)
      ON CONFLICT (tenant_id) DO UPDATE SET patient_seq = public.tenant_counters.patient_seq + 1
      RETURNING patient_seq INTO n;
    UPDATE public.patients SET mrn = 'HMS-' || lpad(n::text, 7, '0') WHERE id = r.id;
  END LOOP;
END $$;

-- ============ clinical child tables ============
CREATE TABLE public.patient_allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  allergy_type text NOT NULL DEFAULT 'drug',
  substance text NOT NULL,
  reaction text,
  severity text NOT NULL DEFAULT 'moderate',
  identified_on date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  description text NOT NULL,
  icd10_code text,
  diagnosed_on date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'active',
  provider text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  systolic int, diastolic int, pulse int,
  temperature numeric(4,1), respiratory_rate int, spo2 int,
  weight_kg numeric(5,1), height_cm numeric(5,1), bmi numeric(5,2),
  blood_glucose numeric(5,2), pain_score int,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  history_type text NOT NULL DEFAULT 'illness',
  condition text NOT NULL,
  occurred_on date,
  provider text,
  details text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_immunizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  vaccine text NOT NULL,
  dose_label text,
  administered_on date NOT NULL DEFAULT current_date,
  batch_number text,
  manufacturer text,
  next_dose_on date,
  provider text,
  location text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  name text NOT NULL,
  doc_type text NOT NULL DEFAULT 'report',
  description text,
  file_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  reason text NOT NULL,
  due_on date NOT NULL,
  provider text,
  status text NOT NULL DEFAULT 'upcoming',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'checked_in',
  priority text NOT NULL DEFAULT 'normal',
  department text,
  reason text,
  arrived_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ grants + RLS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_allergies','patient_diagnoses','patient_vitals','patient_history','patient_immunizations','patient_documents','patient_followups','patient_queue'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (private.is_tenant_member(auth.uid(), tenant_id))', t);
    EXECUTE format('CREATE POLICY "members insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (private.is_tenant_member(auth.uid(), tenant_id))', t);
    EXECUTE format('CREATE POLICY "staff update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY[''owner'',''admin'',''doctor'',''pharmacist'',''staff'']::app_role[])) WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY[''owner'',''admin'',''doctor'',''pharmacist'',''staff'']::app_role[]))', t);
    EXECUTE format('CREATE POLICY "staff delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY[''owner'',''admin'',''doctor'']::app_role[]))', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- ============ indexes ============
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON public.patient_allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_patient ON public.patient_diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON public.patient_vitals(patient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_patient ON public.patient_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_immun_patient ON public.patient_immunizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_docs_patient ON public.patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_followups_tenant_due ON public.patient_followups(tenant_id, due_on);
CREATE INDEX IF NOT EXISTS idx_queue_tenant_stage ON public.patient_queue(tenant_id, stage, arrived_at);
CREATE INDEX IF NOT EXISTS idx_patients_tenant_status ON public.patients(tenant_id, status);
