ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS registered_via text DEFAULT 'staff';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  doctor_id uuid,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  type text NOT NULL DEFAULT 'telemedicine',
  status text NOT NULL DEFAULT 'scheduled',
  reason text,
  notes text,
  video_room_url text,
  video_provider text,
  video_room_name text,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_tenant ON public.appointments(tenant_id, scheduled_at DESC);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON public.appointments(doctor_id);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view appointments" ON public.appointments
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Platform admins view all appointments" ON public.appointments
  FOR SELECT USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Staff insert appointments" ON public.appointments
  FOR INSERT WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','doctor','pharmacist','staff','chv']::app_role[]));
CREATE POLICY "Staff update appointments" ON public.appointments
  FOR UPDATE USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','doctor','pharmacist','staff','chv']::app_role[]));
CREATE POLICY "Admins delete appointments" ON public.appointments
  FOR DELETE USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prescription_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  prescription_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  channel text NOT NULL,
  destination text,
  status text NOT NULL DEFAULT 'pending',
  share_token text UNIQUE,
  share_expires_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rx_deliv_tenant ON public.prescription_deliveries(tenant_id);
CREATE INDEX idx_rx_deliv_token ON public.prescription_deliveries(share_token);

ALTER TABLE public.prescription_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view rx deliveries" ON public.prescription_deliveries
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert rx deliveries" ON public.prescription_deliveries
  FOR INSERT WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','doctor','pharmacist','staff']::app_role[]));
CREATE POLICY "Staff update rx deliveries" ON public.prescription_deliveries
  FOR UPDATE USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','doctor','pharmacist','staff']::app_role[]));

ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS appointment_id uuid;