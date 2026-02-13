-- ============================================
-- RFE Foam Equipment - Supabase Setup Script
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Enable Realtime for ALL data tables
-- Only adds tables that aren't already members of the publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'customers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE settings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'estimates') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE estimates;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'inventory') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
  END IF;
END $$;

-- 2. Add thumbnails column to estimates table (for photo thumbnails)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS thumbnails jsonb DEFAULT NULL;

-- 3. Create the job-photos storage bucket for image uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  true,
  5242880, -- 5MB max per file (images are compressed before upload)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies: allow authenticated users to manage their own photos
-- Upload policy
DROP POLICY IF EXISTS "Users can upload their own photos" ON storage.objects;
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Read policy (public read for all authenticated users)
DROP POLICY IF EXISTS "Anyone can view job photos" ON storage.objects;
CREATE POLICY "Anyone can view job photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-photos');

-- Delete policy (users can delete their own photos)
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Create table for saved PDF metadata
CREATE TABLE IF NOT EXISTS saved_pdfs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  estimate_id uuid REFERENCES estimates(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL DEFAULT 'ESTIMATE',
  document_number text NOT NULL,
  customer_name text,
  file_path text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  created_at timestamptz DEFAULT now()
);

-- RLS for saved_pdfs
ALTER TABLE saved_pdfs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved PDFs" ON saved_pdfs;
CREATE POLICY "Users can view own saved PDFs"
ON saved_pdfs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own saved PDFs" ON saved_pdfs;
CREATE POLICY "Users can insert own saved PDFs"
ON saved_pdfs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own saved PDFs" ON saved_pdfs;
CREATE POLICY "Users can delete own saved PDFs"
ON saved_pdfs FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 6. Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'saved-pdfs',
  'saved-pdfs',
  true,
  10485760, -- 10MB max per file
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for PDFs
DROP POLICY IF EXISTS "Users can upload their own PDFs" ON storage.objects;
CREATE POLICY "Users can upload their own PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'saved-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Anyone can view saved PDFs" ON storage.objects;
CREATE POLICY "Anyone can view saved PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'saved-pdfs');

DROP POLICY IF EXISTS "Users can delete their own PDFs" ON storage.objects;
CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'saved-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Add realtime for saved_pdfs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'saved_pdfs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE saved_pdfs;
  END IF;
END $$;

-- 7. Verify realtime is enabled
-- Run this to check which tables have realtime enabled:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
