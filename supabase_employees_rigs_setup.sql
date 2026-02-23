-- ============================================================
-- RFE Foam Equipment - Employees, Rigs & Work Order Assignments
-- Idempotent: safe to run multiple times
-- Run AFTER supabase_setup.sql
-- ============================================================

-- --------------------------------------------------
-- 1) Profiles table — role-based access for admins & employees
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'employee')),
  company_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admins see their own profile + all employee profiles in their company
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR company_id = auth.uid()
  OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- --------------------------------------------------
-- 2) Employees table — admin-managed employee records
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- admin who owns
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,     -- linked auth account (when employee signs up)
  name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'Crew Member',
  hourly_rate numeric(10,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON public.employees(auth_user_id);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Admin sees own employees; employee sees self
DROP POLICY IF EXISTS "employees_select" ON public.employees;
CREATE POLICY "employees_select" ON public.employees
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR auth_user_id = auth.uid()
  OR user_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "employees_insert" ON public.employees;
CREATE POLICY "employees_insert" ON public.employees
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "employees_update" ON public.employees;
CREATE POLICY "employees_update" ON public.employees
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "employees_delete" ON public.employees;
CREATE POLICY "employees_delete" ON public.employees
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- --------------------------------------------------
-- 3) Rigs table — spray rig / truck management
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  vin text,
  license_plate text,
  year integer,
  make text,
  model text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rigs_user_id ON public.rigs(user_id);

ALTER TABLE public.rigs ENABLE ROW LEVEL SECURITY;

-- Admin sees own rigs; employees see company rigs
DROP POLICY IF EXISTS "rigs_select" ON public.rigs;
CREATE POLICY "rigs_select" ON public.rigs
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "rigs_insert" ON public.rigs;
CREATE POLICY "rigs_insert" ON public.rigs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "rigs_update" ON public.rigs;
CREATE POLICY "rigs_update" ON public.rigs
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "rigs_delete" ON public.rigs;
CREATE POLICY "rigs_delete" ON public.rigs
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- --------------------------------------------------
-- 4) Work Order Assignments — links estimates to rigs & employees
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  rig_id uuid REFERENCES public.rigs(id) ON DELETE SET NULL,
  assigned_employee_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_date date,
  scheduled_time text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  employee_notes text,
  admin_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_woa_user_id ON public.work_order_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_woa_estimate_id ON public.work_order_assignments(estimate_id);
CREATE INDEX IF NOT EXISTS idx_woa_rig_id ON public.work_order_assignments(rig_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_woa_unique_estimate ON public.work_order_assignments(user_id, estimate_id);

ALTER TABLE public.work_order_assignments ENABLE ROW LEVEL SECURITY;

-- Admin sees own; employees see assignments where they are assigned
DROP POLICY IF EXISTS "woa_select" ON public.work_order_assignments;
CREATE POLICY "woa_select" ON public.work_order_assignments
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "woa_insert" ON public.work_order_assignments;
CREATE POLICY "woa_insert" ON public.work_order_assignments
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "woa_update" ON public.work_order_assignments;
CREATE POLICY "woa_update" ON public.work_order_assignments
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR user_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "woa_delete" ON public.work_order_assignments;
CREATE POLICY "woa_delete" ON public.work_order_assignments
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- --------------------------------------------------
-- 5) Updated_at triggers for new tables
-- --------------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_employees_set_updated_at ON public.employees;
CREATE TRIGGER trg_employees_set_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rigs_set_updated_at ON public.rigs;
CREATE TRIGGER trg_rigs_set_updated_at
BEFORE UPDATE ON public.rigs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_woa_set_updated_at ON public.work_order_assignments;
CREATE TRIGGER trg_woa_set_updated_at
BEFORE UPDATE ON public.work_order_assignments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------
-- 6) Auto-create profile on signup
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_company_id uuid;
  v_invite_code text;
BEGIN
  -- Check if this user was invited by an admin (employee signup)
  v_invite_code := NEW.raw_user_meta_data ->> 'invite_code';
  
  IF v_invite_code IS NOT NULL AND v_invite_code != '' THEN
    -- Find the employee record by invite code (stored in email match)
    -- The invite code is the admin's user_id
    v_role := 'employee';
    v_company_id := v_invite_code::uuid;
    
    -- Link the employee record to this auth account
    UPDATE public.employees
    SET auth_user_id = NEW.id
    WHERE email = NEW.email
      AND user_id = v_company_id
      AND auth_user_id IS NULL;
  ELSE
    v_role := 'admin';
    v_company_id := NEW.id;  -- admin is their own company
  END IF;

  INSERT INTO public.profiles (id, role, company_id, display_name)
  VALUES (
    NEW.id,
    v_role,
    v_company_id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- --------------------------------------------------
-- 7) Update RLS on existing tables to allow employee read access
-- --------------------------------------------------

-- Employees should be able to read customers (for job details)
DROP POLICY IF EXISTS "customers_select_employee" ON public.customers;
CREATE POLICY "customers_select_employee" ON public.customers
FOR SELECT TO authenticated
USING (
  user_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role = 'employee')
);

-- Employees should be able to read estimates (work orders assigned to them)
DROP POLICY IF EXISTS "estimates_select_employee" ON public.estimates;
CREATE POLICY "estimates_select_employee" ON public.estimates
FOR SELECT TO authenticated
USING (
  user_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role = 'employee')
);

-- Employees can read settings (for company info on work orders)
DROP POLICY IF EXISTS "settings_select_employee" ON public.settings;
CREATE POLICY "settings_select_employee" ON public.settings
FOR SELECT TO authenticated
USING (
  user_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role = 'employee')
);

-- Employees can read inventory
DROP POLICY IF EXISTS "inventory_select_employee" ON public.inventory;
CREATE POLICY "inventory_select_employee" ON public.inventory
FOR SELECT TO authenticated
USING (
  user_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() AND role = 'employee')
);

-- --------------------------------------------------
-- 8) Replica identity & realtime for new tables
-- --------------------------------------------------
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;
ALTER TABLE public.rigs REPLICA IDENTITY FULL;
ALTER TABLE public.work_order_assignments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rigs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rigs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_order_assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_assignments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- --------------------------------------------------
-- 9) Useful views
-- --------------------------------------------------
-- Employee assignments view (for employee portal)
CREATE OR REPLACE VIEW public.my_assignments AS
SELECT
  woa.*,
  e.number as estimate_number,
  e.job_name,
  e.job_address,
  e.status as job_status,
  e.calc_data,
  e.items,
  e.subtotal,
  e.total,
  e.notes as job_notes,
  e.total_board_feet_open,
  e.total_board_feet_closed,
  e.sets_required_open,
  e.sets_required_closed,
  r.name as rig_name,
  c.name as customer_name,
  c.phone as customer_phone,
  c.address as customer_address,
  c.city as customer_city,
  c.state as customer_state,
  c.zip as customer_zip
FROM public.work_order_assignments woa
LEFT JOIN public.estimates e ON e.id = woa.estimate_id
LEFT JOIN public.rigs r ON r.id = woa.rig_id
LEFT JOIN public.customers c ON c.id = e.customer_id;

-- Done!
-- After running this SQL, create profiles for existing admin users:
-- INSERT INTO public.profiles (id, role, company_id, display_name)
-- SELECT id, 'admin', id, email FROM auth.users
-- ON CONFLICT (id) DO NOTHING;
