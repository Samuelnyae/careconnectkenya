
-- ===== Medication losses =====
CREATE TABLE public.medication_losses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  reason text NOT NULL CHECK (reason IN ('expired','damaged','theft','lost','recall','other')),
  batch_number text,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medication_losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view losses" ON public.medication_losses FOR SELECT
  USING (private.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Platform admins view all losses" ON public.medication_losses FOR SELECT
  USING (private.is_platform_admin(auth.uid()));
CREATE POLICY "Staff insert losses" ON public.medication_losses FOR INSERT
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'pharmacist'::app_role,'staff'::app_role]));
CREATE POLICY "Admins delete losses" ON public.medication_losses FOR DELETE
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE INDEX idx_losses_tenant_date ON public.medication_losses(tenant_id, occurred_at DESC);

-- Deduct stock when loss recorded with a product_id
CREATE OR REPLACE FUNCTION public.deduct_stock_on_loss()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock_qty = GREATEST(stock_qty - NEW.quantity::int, 0), updated_at = now()
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_loss_deduct AFTER INSERT ON public.medication_losses
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_loss();

-- ===== Prescription tracking enhancements =====
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','dispensed','cancelled','expired','flagged')),
  ADD COLUMN IF NOT EXISTS dispensed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispensed_by uuid,
  ADD COLUMN IF NOT EXISTS refills_remaining int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity numeric;

CREATE INDEX IF NOT EXISTS idx_rx_tenant_status ON public.prescriptions(tenant_id, status, created_at DESC);

-- ===== Rx fraud flags =====
CREATE TABLE public.rx_fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  prescription_id uuid,
  flag_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  reason text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','confirmed','dismissed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rx_fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view fraud flags" ON public.rx_fraud_flags FOR SELECT
  USING (private.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert fraud flags" ON public.rx_fraud_flags FOR INSERT
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'doctor'::app_role,'pharmacist'::app_role,'staff'::app_role]));
CREATE POLICY "Staff update fraud flags" ON public.rx_fraud_flags FOR UPDATE
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'doctor'::app_role,'pharmacist'::app_role]));
CREATE POLICY "Admins delete fraud flags" ON public.rx_fraud_flags FOR DELETE
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role]));
CREATE POLICY "Platform admins view all fraud flags" ON public.rx_fraud_flags FOR SELECT
  USING (private.is_platform_admin(auth.uid()));

CREATE INDEX idx_fraud_tenant_status ON public.rx_fraud_flags(tenant_id, status, created_at DESC);

-- ===== Bookkeeping: chart of accounts =====
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view accounts" ON public.accounts FOR SELECT
  USING (private.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins manage accounts" ON public.accounts FOR ALL
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role]))
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role]));
CREATE POLICY "Platform admins view all accounts" ON public.accounts FOR SELECT
  USING (private.is_platform_admin(auth.uid()));

-- ===== Journal entries =====
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  memo text,
  reference text,
  posted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view journal entries" ON public.journal_entries FOR SELECT
  USING (private.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert journal entries" ON public.journal_entries FOR INSERT
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'pharmacist'::app_role]));
CREATE POLICY "Staff update journal entries" ON public.journal_entries FOR UPDATE
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'pharmacist'::app_role]));
CREATE POLICY "Admins delete journal entries" ON public.journal_entries FOR DELETE
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role]));
CREATE POLICY "Platform admins view all journal entries" ON public.journal_entries FOR SELECT
  USING (private.is_platform_admin(auth.uid()));

CREATE INDEX idx_journal_tenant_date ON public.journal_entries(tenant_id, entry_date DESC);

-- ===== Journal lines =====
CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  debit numeric NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (debit > 0 AND credit > 0))
);
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view journal lines" ON public.journal_lines FOR SELECT
  USING (private.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff insert journal lines" ON public.journal_lines FOR INSERT
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'pharmacist'::app_role]));
CREATE POLICY "Staff update journal lines" ON public.journal_lines FOR UPDATE
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'pharmacist'::app_role]));
CREATE POLICY "Staff delete journal lines" ON public.journal_lines FOR DELETE
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role,'admin'::app_role,'pharmacist'::app_role]));

CREATE INDEX idx_jlines_entry ON public.journal_lines(entry_id);
CREATE INDEX idx_jlines_account ON public.journal_lines(account_id);

-- Validate posted entries are balanced
CREATE OR REPLACE FUNCTION public.validate_journal_balanced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total_debit numeric; total_credit numeric;
BEGIN
  IF NEW.posted = true THEN
    SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
      INTO total_debit, total_credit
      FROM public.journal_lines WHERE entry_id = NEW.id;
    IF total_debit <> total_credit OR total_debit = 0 THEN
      RAISE EXCEPTION 'Journal entry % is not balanced (debit=%, credit=%)', NEW.id, total_debit, total_credit;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_journal_balanced BEFORE UPDATE OR INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_journal_balanced();
