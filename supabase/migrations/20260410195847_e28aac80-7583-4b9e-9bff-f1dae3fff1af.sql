
DROP POLICY IF EXISTS "Service can insert users" ON public.users;
CREATE POLICY "Users can insert own record"
ON public.users FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());
