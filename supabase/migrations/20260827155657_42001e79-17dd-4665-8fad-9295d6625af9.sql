-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  lead_time_days integer NOT NULL DEFAULT 7,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated
  USING (private.is_tenant_member(auth.uid(), tenant_id) OR private.is_platform_admin(auth.uid()));
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);

-- ============ PRODUCT EXTRA FIELDS ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS dosage_form text,
  ADD COLUMN IF NOT EXISTS strength text,
  ADD COLUMN IF NOT EXISTS unit_of_measure text,
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ============ BATCHES ============
CREATE TABLE public.product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  expiry_date date,
  quantity integer NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  storage_location text,
  status text NOT NULL DEFAULT 'available',
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_batches TO authenticated;
GRANT ALL ON public.product_batches TO service_role;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches_select" ON public.product_batches FOR SELECT TO authenticated
  USING (private.is_tenant_member(auth.uid(), tenant_id) OR private.is_platform_admin(auth.uid()));
CREATE POLICY "batches_insert" ON public.product_batches FOR INSERT TO authenticated
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "batches_update" ON public.product_batches FOR UPDATE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "batches_delete" ON public.product_batches FOR DELETE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_batches_tenant_product ON public.product_batches(tenant_id, product_id);
CREATE INDEX idx_batches_expiry ON public.product_batches(tenant_id, expiry_date);

-- ============ STOCK MOVEMENTS ============
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.product_batches(id) ON DELETE SET NULL,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  reason text,
  reference text,
  location_from text,
  location_to text,
  notes text,
  performed_by uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movements_select" ON public.stock_movements FOR SELECT TO authenticated
  USING (private.is_tenant_member(auth.uid(), tenant_id) OR private.is_platform_admin(auth.uid()));
CREATE POLICY "movements_insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist','cashier']::public.app_role[]));
CREATE INDEX idx_movements_tenant_product ON public.stock_movements(tenant_id, product_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
    SET stock_qty = GREATEST(stock_qty + NEW.quantity, 0), updated_at = now()
    WHERE id = NEW.product_id;
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE public.product_batches
      SET quantity = GREATEST(quantity + NEW.quantity, 0), updated_at = now()
      WHERE id = NEW.batch_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- ============ PURCHASE ORDERS ============
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_select" ON public.purchase_orders FOR SELECT TO authenticated
  USING (private.is_tenant_member(auth.uid(), tenant_id) OR private.is_platform_admin(auth.uid()));
CREATE POLICY "po_insert" ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "po_update" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "po_delete" ON public.purchase_orders FOR DELETE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_po_tenant ON public.purchase_orders(tenant_id, order_date DESC);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  received_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_items_select" ON public.purchase_order_items FOR SELECT TO authenticated
  USING (private.is_tenant_member(auth.uid(), tenant_id) OR private.is_platform_admin(auth.uid()));
CREATE POLICY "po_items_insert" ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "po_items_update" ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "po_items_delete" ON public.purchase_order_items FOR DELETE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));
CREATE INDEX idx_po_items_po ON public.purchase_order_items(po_id);

-- ============ STOCK TAKES ============
CREATE TABLE public.stock_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_takes TO authenticated;
GRANT ALL ON public.stock_takes TO service_role;
ALTER TABLE public.stock_takes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "takes_select" ON public.stock_takes FOR SELECT TO authenticated
  USING (private.is_tenant_member(auth.uid(), tenant_id) OR private.is_platform_admin(auth.uid()));
CREATE POLICY "takes_insert" ON public.stock_takes FOR INSERT TO authenticated
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "takes_update" ON public.stock_takes FOR UPDATE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "takes_delete" ON public.stock_takes FOR DELETE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_takes_updated BEFORE UPDATE ON public.stock_takes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_takes_tenant ON public.stock_takes(tenant_id, started_at DESC);

CREATE TABLE public.stock_take_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  take_id uuid NOT NULL REFERENCES public.stock_takes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  system_qty integer NOT NULL DEFAULT 0,
  counted_qty integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_take_lines TO authenticated;
GRANT ALL ON public.stock_take_lines TO service_role;
ALTER TABLE public.stock_take_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "take_lines_select" ON public.stock_take_lines FOR SELECT TO authenticated
  USING (private.is_tenant_member(auth.uid(), tenant_id) OR private.is_platform_admin(auth.uid()));
CREATE POLICY "take_lines_insert" ON public.stock_take_lines FOR INSERT TO authenticated
  WITH CHECK (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "take_lines_update" ON public.stock_take_lines FOR UPDATE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "take_lines_delete" ON public.stock_take_lines FOR DELETE TO authenticated
  USING (private.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));
CREATE INDEX idx_take_lines_take ON public.stock_take_lines(take_id);