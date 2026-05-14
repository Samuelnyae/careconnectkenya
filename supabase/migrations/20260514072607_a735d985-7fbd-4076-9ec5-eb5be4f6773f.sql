
-- County tagging for disease trend tracking (Kenya 47 counties)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE public.patient_visits ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS county text;

CREATE INDEX IF NOT EXISTS idx_visits_county_date ON public.patient_visits (county, visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_diagnosis ON public.patient_visits (diagnosis);
CREATE INDEX IF NOT EXISTS idx_sales_county_date ON public.sales (county, created_at);

-- Auto-fill county from tenant when not provided
CREATE OR REPLACE FUNCTION public.fill_county_from_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.county IS NULL THEN
    SELECT county INTO NEW.county FROM public.tenants WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_visits_fill_county ON public.patient_visits;
CREATE TRIGGER trg_visits_fill_county BEFORE INSERT ON public.patient_visits
  FOR EACH ROW EXECUTE FUNCTION public.fill_county_from_tenant();

DROP TRIGGER IF EXISTS trg_sales_fill_county ON public.sales;
CREATE TRIGGER trg_sales_fill_county BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.fill_county_from_tenant();

DROP TRIGGER IF EXISTS trg_patients_fill_county ON public.patients;
CREATE TRIGGER trg_patients_fill_county BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.fill_county_from_tenant();
