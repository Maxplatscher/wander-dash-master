-- Remove an unused SECURITY DEFINER view that bypasses company RLS.
DROP VIEW IF EXISTS public.companies;
