
-- 1. company
CREATE TABLE public.company (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;

-- 2. plan_run
CREATE TABLE public.plan_run (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT,
  input_snapshot JSONB,
  result_snapshot JSONB
);
ALTER TABLE public.plan_run ENABLE ROW LEVEL SECURITY;

-- 3. vehicle
CREATE TABLE public.vehicle (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT,
  capacity INTEGER
);
ALTER TABLE public.vehicle ENABLE ROW LEVEL SECURITY;

-- 4. driver
CREATE TABLE public.driver (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  status TEXT,
  shift_start TIME,
  shift_end TIME
);
ALTER TABLE public.driver ENABLE ROW LEVEL SECURITY;

-- 5. shipment
CREATE TABLE public.shipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT,
  demand INTEGER,
  location_x DOUBLE PRECISION,
  location_y DOUBLE PRECISION,
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  service_date DATE,
  intake_source VARCHAR(50),
  intake_status VARCHAR(50),
  customer_name VARCHAR(300),
  delivery_address VARCHAR(2000),
  email_notes VARCHAR(4000),
  seller_email VARCHAR(255),
  raw_email TEXT,
  positionen JSONB,
  weight_kg INTEGER,
  email_received_at TIMESTAMPTZ,
  email_processed_at TIMESTAMPTZ,
  missing_fields JSONB,
  released_at TIMESTAMPTZ,
  released_by VARCHAR(255)
);
ALTER TABLE public.shipment ENABLE ROW LEVEL SECURITY;

-- 6. email_log
CREATE TABLE public.email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id VARCHAR(900) UNIQUE,
  subject VARCHAR(500),
  from_addr VARCHAR(500),
  status VARCHAR(80) NOT NULL,
  error_detail TEXT,
  shipment_id UUID REFERENCES public.shipment(id),
  body_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- 7. touren_plan
CREATE TABLE public.touren_plan (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  date DATE,
  version INTEGER,
  is_active BOOLEAN DEFAULT false,
  plan_run_id UUID REFERENCES public.plan_run(id),
  total_cost DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.touren_plan ENABLE ROW LEVEL SECURITY;

-- 8. tour
CREATE TABLE public.tour (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  plan_version_id UUID REFERENCES public.touren_plan(id),
  date DATE,
  version INTEGER,
  is_active BOOLEAN DEFAULT false,
  plan_run_id UUID REFERENCES public.plan_run(id),
  total_cost DOUBLE PRECISION,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tour ENABLE ROW LEVEL SECURITY;

-- 9. tour_stop
CREATE TABLE public.tour_stop (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id UUID NOT NULL REFERENCES public.tour(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicle(id),
  shipment_id UUID REFERENCES public.shipment(id),
  stop_index INTEGER,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  segment_cost DOUBLE PRECISION,
  driver_completed BOOLEAN DEFAULT false,
  driver_completed_at TIMESTAMPTZ
);
ALTER TABLE public.tour_stop ENABLE ROW LEVEL SECURITY;

-- 10. users
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  company_id UUID REFERENCES public.company(id),
  role TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  driver_id UUID REFERENCES public.driver(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Helper: get company_id for current user
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
$$;

-- company: read own company
CREATE POLICY "Users can view own company" ON public.company
  FOR SELECT TO authenticated
  USING (id = public.get_user_company_id());

-- plan_run
CREATE POLICY "Users can view own plan_runs" ON public.plan_run
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Users can insert own plan_runs" ON public.plan_run
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

-- vehicle
CREATE POLICY "Users can view own vehicles" ON public.vehicle
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Users can manage own vehicles" ON public.vehicle
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- driver
CREATE POLICY "Users can view own drivers" ON public.driver
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Users can manage own drivers" ON public.driver
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- shipment
CREATE POLICY "Users can view own shipments" ON public.shipment
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Users can manage own shipments" ON public.shipment
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- email_log: access via shipment's company
CREATE POLICY "Users can view own email_logs" ON public.email_log
  FOR SELECT TO authenticated
  USING (
    shipment_id IS NULL 
    OR shipment_id IN (SELECT id FROM public.shipment WHERE company_id = public.get_user_company_id())
  );

-- touren_plan
CREATE POLICY "Users can view own touren_plans" ON public.touren_plan
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Users can manage own touren_plans" ON public.touren_plan
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- tour
CREATE POLICY "Users can view own tours" ON public.tour
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Users can manage own tours" ON public.tour
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- tour_stop: access via tour's company
CREATE POLICY "Users can view own tour_stops" ON public.tour_stop
  FOR SELECT TO authenticated
  USING (tour_id IN (SELECT id FROM public.tour WHERE company_id = public.get_user_company_id()));
CREATE POLICY "Users can manage own tour_stops" ON public.tour_stop
  FOR ALL TO authenticated
  USING (tour_id IN (SELECT id FROM public.tour WHERE company_id = public.get_user_company_id()))
  WITH CHECK (tour_id IN (SELECT id FROM public.tour WHERE company_id = public.get_user_company_id()));

-- users: own profile only
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
CREATE INDEX idx_shipment_service_date ON public.shipment(service_date);
CREATE INDEX idx_shipment_intake_status ON public.shipment(intake_status);
CREATE INDEX idx_shipment_company_id ON public.shipment(company_id);
CREATE INDEX idx_tour_date ON public.tour(date);
CREATE INDEX idx_tour_company_id ON public.tour(company_id);
CREATE INDEX idx_tour_stop_shipment_id ON public.tour_stop(shipment_id);
CREATE INDEX ix_email_log_created_at ON public.email_log(created_at);
CREATE INDEX ix_email_log_status ON public.email_log(status);
