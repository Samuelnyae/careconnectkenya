
-- Patient channel preferences and chronic tracking
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS preferred_channels text[] NOT NULL DEFAULT ARRAY['sms']::text[],
  ADD COLUMN IF NOT EXISTS is_chronic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chronic_review_date date;

CREATE INDEX IF NOT EXISTS idx_patients_chronic ON public.patients(tenant_id, is_chronic) WHERE is_chronic = true;
CREATE INDEX IF NOT EXISTS idx_patients_telegram ON public.patients(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

-- Lab results
CREATE TABLE IF NOT EXISTS public.lab_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  visit_id uuid,
  test_name text NOT NULL,
  test_category text,
  result_value text,
  result_unit text,
  reference_range text,
  status text NOT NULL DEFAULT 'normal', -- normal, abnormal, critical, pending
  notes text,
  file_url text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  ordered_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view lab results" ON public.lab_results
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert lab results" ON public.lab_results
  FOR INSERT WITH CHECK (has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'doctor'::app_role,'pharmacist'::app_role,'staff'::app_role]));
CREATE POLICY "Staff update lab results" ON public.lab_results
  FOR UPDATE USING (has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'doctor'::app_role,'pharmacist'::app_role,'staff'::app_role]));
CREATE POLICY "Admins delete lab results" ON public.lab_results
  FOR DELETE USING (has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_lab_results_updated BEFORE UPDATE ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lab_results_patient ON public.lab_results(patient_id, performed_at DESC);

-- Reminders
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  reminder_type text NOT NULL, -- medication, appointment, follow_up, lab, custom
  related_id uuid, -- prescription_id, appointment_id, lab_result_id, etc.
  message text NOT NULL,
  channels text[] NOT NULL DEFAULT ARRAY['sms']::text[], -- sms, whatsapp, telegram
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed, cancelled
  delivery_log jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view reminders" ON public.reminders
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert reminders" ON public.reminders
  FOR INSERT WITH CHECK (has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'doctor'::app_role,'pharmacist'::app_role,'staff'::app_role,'chv'::app_role]));
CREATE POLICY "Staff update reminders" ON public.reminders
  FOR UPDATE USING (has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'doctor'::app_role,'pharmacist'::app_role,'staff'::app_role,'chv'::app_role]));
CREATE POLICY "Admins delete reminders" ON public.reminders
  FOR DELETE USING (has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_reminders_updated BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_reminders_due ON public.reminders(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_patient ON public.reminders(patient_id, scheduled_at DESC);

-- Telegram bot polling state (for future enrollment via /start)
CREATE TABLE IF NOT EXISTS public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins manage telegram state" ON public.telegram_bot_state
  FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

-- Storage bucket for lab reports (PDF/images)
INSERT INTO storage.buckets (id, name, public) VALUES ('lab-results', 'lab-results', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members view lab files" ON storage.objects FOR SELECT
  USING (bucket_id = 'lab-results' AND EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id::text = (storage.foldername(name))[1]
  ));
CREATE POLICY "Staff upload lab files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lab-results' AND EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id::text = (storage.foldername(name))[1]
      AND m.role IN ('owner','admin','doctor','pharmacist','staff')
  ));
CREATE POLICY "Staff delete lab files" ON storage.objects FOR DELETE
  USING (bucket_id = 'lab-results' AND EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.user_id = auth.uid() AND m.tenant_id::text = (storage.foldername(name))[1]
      AND m.role IN ('owner','admin')
  ));
