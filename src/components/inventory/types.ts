export type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit_price: number;
  cost_price: number;
  stock_qty: number;
  reorder_level: number;
  batch_number: string | null;
  expiry_date: string | null;
  supplier: string | null;
  supplier_id: string | null;
  image_url: string | null;
  manufacturer: string | null;
  dosage_form: string | null;
  strength: string | null;
  unit_of_measure: string | null;
  storage_location: string | null;
  is_controlled: boolean;
  is_active: boolean;
};

export type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  lead_time_days: number;
  notes: string | null;
  is_active: boolean;
};

export type Batch = {
  id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string | null;
  quantity: number;
  cost_price: number;
  supplier_id: string | null;
  storage_location: string | null;
  status: string;
  received_at: string;
  notes: string | null;
};

export type Movement = {
  id: string;
  product_id: string;
  batch_id: string | null;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  reason: string | null;
  reference: string | null;
  location_from: string | null;
  location_to: string | null;
  notes: string | null;
  occurred_at: string;
};
