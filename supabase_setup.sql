-- ============================================
-- RFE Foam Equipment - Supabase Backend Setup
-- Idempotent: safe to run multiple times
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- --------------------------------------------------
-- 1) Core tables
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT 'RFE Foam Equipment',
  company_address text,
  company_phone text,
  company_email text,
  logo_url text,
  open_cell_yield numeric(12,2) NOT NULL DEFAULT 16000,
  closed_cell_yield numeric(12,2) NOT NULL DEFAULT 4000,
  open_cell_cost numeric(12,2) NOT NULL DEFAULT 2000,
  closed_cell_cost numeric(12,2) NOT NULL DEFAULT 2600,
  labor_rate numeric(12,2) NOT NULL DEFAULT 85,
  tax_rate numeric(8,3) NOT NULL DEFAULT 7.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL,
  min_level numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  date text,
  status text,
  job_name text,
  job_address text,
  location jsonb,
  images jsonb,
  thumbnails jsonb,
  calc_data jsonb,
  pricing_mode text,
  price_per_sqft_wall numeric(12,2),
  price_per_sqft_roof numeric(12,2),
  total_board_feet_open numeric(12,2) NOT NULL DEFAULT 0,
  total_board_feet_closed numeric(12,2) NOT NULL DEFAULT 0,
  sets_required_open numeric(12,2) NOT NULL DEFAULT 0,
  sets_required_closed numeric(12,2) NOT NULL DEFAULT 0,
  inventory_deducted boolean NOT NULL DEFAULT false,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'ESTIMATE',
  document_number text NOT NULL,
  customer_name text,
  file_path text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Compatibility upgrades for existing deployments
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS thumbnails jsonb;

-- --------------------------------------------------
-- 2) Indexes
-- --------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON public.estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON public.estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON public.inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON public.settings(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pdfs_user_id ON public.saved_pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_pdfs_estimate_id ON public.saved_pdfs(estimate_id);

-- --------------------------------------------------
-- 3) updated_at trigger utility
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_set_updated_at ON public.customers;
CREATE TRIGGER trg_customers_set_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_settings_set_updated_at ON public.settings;
CREATE TRIGGER trg_settings_set_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_set_updated_at ON public.inventory;
CREATE TRIGGER trg_inventory_set_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_estimates_set_updated_at ON public.estimates;
CREATE TRIGGER trg_estimates_set_updated_at
BEFORE UPDATE ON public.estimates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------
-- 4) Row Level Security
-- --------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_pdfs ENABLE ROW LEVEL SECURITY;

-- Customers policies
DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
CREATE POLICY "customers_select_own" ON public.customers
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "customers_insert_own" ON public.customers;
CREATE POLICY "customers_insert_own" ON public.customers
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "customers_update_own" ON public.customers;
CREATE POLICY "customers_update_own" ON public.customers
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "customers_delete_own" ON public.customers;
CREATE POLICY "customers_delete_own" ON public.customers
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Settings policies
DROP POLICY IF EXISTS "settings_select_own" ON public.settings;
CREATE POLICY "settings_select_own" ON public.settings
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "settings_insert_own" ON public.settings;
CREATE POLICY "settings_insert_own" ON public.settings
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "settings_update_own" ON public.settings;
CREATE POLICY "settings_update_own" ON public.settings
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "settings_delete_own" ON public.settings;
CREATE POLICY "settings_delete_own" ON public.settings
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Inventory policies
DROP POLICY IF EXISTS "inventory_select_own" ON public.inventory;
CREATE POLICY "inventory_select_own" ON public.inventory
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "inventory_insert_own" ON public.inventory;
CREATE POLICY "inventory_insert_own" ON public.inventory
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "inventory_update_own" ON public.inventory;
CREATE POLICY "inventory_update_own" ON public.inventory
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "inventory_delete_own" ON public.inventory;
CREATE POLICY "inventory_delete_own" ON public.inventory
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Estimates policies
DROP POLICY IF EXISTS "estimates_select_own" ON public.estimates;
CREATE POLICY "estimates_select_own" ON public.estimates
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "estimates_insert_own" ON public.estimates;
CREATE POLICY "estimates_insert_own" ON public.estimates
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "estimates_update_own" ON public.estimates;
CREATE POLICY "estimates_update_own" ON public.estimates
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "estimates_delete_own" ON public.estimates;
CREATE POLICY "estimates_delete_own" ON public.estimates
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Saved PDFs policies
DROP POLICY IF EXISTS "saved_pdfs_select_own" ON public.saved_pdfs;
CREATE POLICY "saved_pdfs_select_own" ON public.saved_pdfs
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_pdfs_insert_own" ON public.saved_pdfs;
CREATE POLICY "saved_pdfs_insert_own" ON public.saved_pdfs
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_pdfs_update_own" ON public.saved_pdfs;
CREATE POLICY "saved_pdfs_update_own" ON public.saved_pdfs
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_pdfs_delete_own" ON public.saved_pdfs;
CREATE POLICY "saved_pdfs_delete_own" ON public.saved_pdfs
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- --------------------------------------------------
-- 5) Signup bootstrap: create settings row per new user
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.settings (user_id, company_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'company', ''), 'RFE Foam Equipment')
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();

-- --------------------------------------------------
-- 6) Storage buckets
-- --------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('job-photos', 'job-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('saved-pdfs', 'saved-pdfs', true, 10485760, ARRAY['application/pdf']),
  ('logos', 'logos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies (bucket-scoped)
DROP POLICY IF EXISTS "job_photos_select_public" ON storage.objects;
CREATE POLICY "job_photos_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'job-photos');

DROP POLICY IF EXISTS "job_photos_insert_own" ON storage.objects;
CREATE POLICY "job_photos_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "job_photos_update_own" ON storage.objects;
CREATE POLICY "job_photos_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "job_photos_delete_own" ON storage.objects;
CREATE POLICY "job_photos_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "saved_pdfs_select_public" ON storage.objects;
CREATE POLICY "saved_pdfs_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'saved-pdfs');

DROP POLICY IF EXISTS "saved_pdfs_insert_own" ON storage.objects;
CREATE POLICY "saved_pdfs_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'saved-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "saved_pdfs_update_own" ON storage.objects;
CREATE POLICY "saved_pdfs_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'saved-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'saved-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "saved_pdfs_delete_own" ON storage.objects;
CREATE POLICY "saved_pdfs_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'saved-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "logos_select_public" ON storage.objects;
CREATE POLICY "logos_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_insert_own" ON storage.objects;
CREATE POLICY "logos_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "logos_update_own" ON storage.objects;
CREATE POLICY "logos_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "logos_delete_own" ON storage.objects;
CREATE POLICY "logos_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- --------------------------------------------------
-- 7) Realtime publication
-- --------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'customers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'estimates') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estimates;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'inventory') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'saved_pdfs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_pdfs;
  END IF;
END $$;
