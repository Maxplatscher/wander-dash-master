-- Fix: permission denied for table users
-- RLS-Policies existieren bereits; ohne Table-Grant schlägt SELECT von authenticated fehl.

GRANT SELECT ON TABLE public.users TO authenticated;
