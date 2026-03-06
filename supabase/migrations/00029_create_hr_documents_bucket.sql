-- Create private storage bucket for HR compliance documents.
-- Uses signed URLs for secure download access.
-- Idempotent: safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-documents',
  'hr-documents',
  FALSE,
  10485760,  -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the hr-documents bucket

-- HR admins can upload files
DROP POLICY IF EXISTS "HR admins can upload hr documents" ON storage.objects;
CREATE POLICY "HR admins can upload hr documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hr-documents'
    AND public.is_hr_admin()
  );

-- HR admins can read (download) all files
DROP POLICY IF EXISTS "HR admins can read hr documents" ON storage.objects;
CREATE POLICY "HR admins can read hr documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND public.is_hr_admin()
  );

-- Users can read their own documents (path starts with their user ID)
DROP POLICY IF EXISTS "Users can read own hr documents" ON storage.objects;
CREATE POLICY "Users can read own hr documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- HR admins can delete files
DROP POLICY IF EXISTS "HR admins can delete hr documents" ON storage.objects;
CREATE POLICY "HR admins can delete hr documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND public.is_hr_admin()
  );
