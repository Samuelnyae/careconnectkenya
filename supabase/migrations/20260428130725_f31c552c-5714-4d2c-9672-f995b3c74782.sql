
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'pharmacist', 'cashier', 'staff');

-- Tenants (organizations)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'pharmacy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Memberships (user <-> tenant with role)
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Security definer: does this user belong to this tenant?
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = _user_id AND tenant_id = _tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = ANY(_roles)
  );
$$;

-- Products / inventory
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  batch_number TEXT,
  expiry_date DATE,
  supplier TEXT,
  is_controlled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_tenant ON public.products(tenant_id);

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_tenant_date ON public.sales(tenant_id, created_at DESC);

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

-- Trigger: deduct stock on sale item insert
CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
  SET stock_qty = GREATEST(stock_qty - NEW.quantity, 0),
      updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_deduct_stock AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_sale();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Tenants policies
CREATE POLICY "Members can view their tenants" ON public.tenants FOR SELECT
  USING (public.is_tenant_member(auth.uid(), id));
CREATE POLICY "Authenticated users can create tenants" ON public.tenants FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners/admins can update tenant" ON public.tenants FOR UPDATE
  USING (public.has_tenant_role(auth.uid(), id, ARRAY['owner','admin']::public.app_role[]));

-- Memberships policies
CREATE POLICY "Users view own memberships" ON public.memberships FOR SELECT
  USING (user_id = auth.uid() OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "Users can insert own membership (bootstrap)" ON public.memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners/admins manage memberships" ON public.memberships FOR ALL
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));

-- Products policies
CREATE POLICY "Members view products" ON public.products FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Staff can insert products" ON public.products FOR INSERT
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "Staff can update products" ON public.products FOR UPDATE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin','pharmacist']::public.app_role[]));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE
  USING (public.has_tenant_role(auth.uid(), tenant_id, ARRAY['owner','admin']::public.app_role[]));

-- Sales policies
CREATE POLICY "Members view sales" ON public.sales FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Members create sales" ON public.sales FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) AND cashier_id = auth.uid());

-- Sale items policies (via parent sale)
CREATE POLICY "Members view sale items" ON public.sale_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.is_tenant_member(auth.uid(), s.tenant_id)));
CREATE POLICY "Members create sale items" ON public.sale_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.is_tenant_member(auth.uid(), s.tenant_id)));
