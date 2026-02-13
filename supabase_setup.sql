-- ============================================
-- RFE Foam Equipment - Supabase Setup Script
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Enable Realtime for ALL data tables
-- (estimates and inventory may already be enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE estimates;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;

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
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Read policy (public read for all authenticated users)
CREATE POLICY "Anyone can view job photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-photos');

-- Delete policy (users can delete their own photos)
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Verify realtime is enabled
-- Run this to check which tables have realtime enabled:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
