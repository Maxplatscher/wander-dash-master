-- Fix: permission denied for table users
-- RLS-Policies existieren bereits; ohne Table-Grant schlägt SELECT von authenticated fehl.
-- OnboardingRoute / StepPersonal / StepPermissions / get_user_company_id-Pfad brauchen SELECT.

GRANT SELECT, UPDATE, INSERT ON TABLE public.users TO authenticated;
