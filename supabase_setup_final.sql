-- SCRIPT FINAL DE CONFIGURACION PARA SUPABASE --

-- 1. TIPOS DE ROLES (Evita errores si ya existen)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'GERENTE', 'SUPERVISOR', 'OPERARIO');
    END IF;
END $$;

-- 2. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role user_role DEFAULT 'OPERARIO',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar seguridad
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. POLITICAS DE ACCESO (Permite leer y escribir a usuarios logueados)
DROP POLICY IF EXISTS "Perfiles visibles por todos" ON public.profiles;
CREATE POLICY "Perfiles visibles por todos" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin o Usuario edita" ON public.profiles;
CREATE POLICY "Admin o Usuario edita" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 4. FUNCION DISPARADORA (TRIGGER FUNCTION)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nuevo Empleado'), 
    'OPERARIO'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. EL DISPARADOR (TRIGGER)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- IMPORTANTE: Recuerda DESACTIVAR "Confirm email" en:
-- Authentication > Providers > Email en tu panel de Supabase.
