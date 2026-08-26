-- Privater Bucket fuer Fahrerfotos.
-- Objektpfad: {company_id}/{driver_id}/{dateiname}
-- Lesen: Disposition der Company oder der Fahrer selbst.
-- Schreiben: nur Admin/Dispatcher der eigenen Company.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-photos',
  'driver-photos',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Dispatch staff can read driver photos" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can read own photos" ON storage.objects;
DROP POLICY IF EXISTS "Company can read driver photos" ON storage.objects;
DROP POLICY IF EXISTS "Dispatch staff can upload driver photos" ON storage.objects;
DROP POLICY IF EXISTS "Dispatch staff can update driver photos" ON storage.objects;
DROP POLICY IF EXISTS "Dispatch staff can delete driver photos" ON storage.objects;

CREATE POLICY "Company can read driver photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'driver-photos'
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
    OR split_part(name, '/', 2) = public.get_current_driver_id()::text
  )
);

CREATE POLICY "Dispatch staff can upload driver photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'driver-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
  AND EXISTS (
    SELECT 1
    FROM public.driver AS d
    WHERE d.id::text = split_part(name, '/', 2)
      AND d.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Dispatch staff can update driver photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'driver-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
)
WITH CHECK (
  bucket_id = 'driver-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
);

CREATE POLICY "Dispatch staff can delete driver photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'driver-photos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'dispatcher')
  )
  AND split_part(name, '/', 1) = public.get_user_company_id()::text
);
