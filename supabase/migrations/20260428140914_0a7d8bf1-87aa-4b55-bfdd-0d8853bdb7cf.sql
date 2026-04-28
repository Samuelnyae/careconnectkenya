-- Add super_admin role to existing enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';