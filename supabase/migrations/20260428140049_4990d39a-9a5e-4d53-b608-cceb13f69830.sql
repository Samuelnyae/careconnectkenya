-- Add image_url column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

-- Create public bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Product images are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Authenticated users can update/delete their uploads
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');