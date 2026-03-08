-- SCRIPT FINAL DE CONFIGURACION PARA SUPABASE (Actualizado con Storage Policies) --

-- 1. TIPOS DE ROLES (Evita errores si ya existen)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN', 'GERENTE', 'SUPERVISOR', 'OPERARIO');
    END IF;
END $$;

-- 2. TABLAS PRINCIPALES (Profiles, Clientes)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role user_role DEFAULT 'OPERARIO',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  cuit_dni TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Politicas de acceso
DROP POLICY IF EXISTS "Perfiles visibles" ON public.profiles;
CREATE POLICY "Perfiles visibles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin edita perfiles" ON public.profiles;
CREATE POLICY "Admin edita perfiles" ON public.profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Clientes visibles" ON public.clientes;
CREATE POLICY "Clientes visibles" ON public.clientes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion total clientes" ON public.clientes;
CREATE POLICY "Gestion total clientes" ON public.clientes FOR ALL USING (true);

-- 3. POLITICAS DE STORAGE (PARA IMAGENES)
-- Nota: Primero debes crear los buckets 'materiales' y 'herramientas' en el panel de Storage.

-- Políticas para el bucket 'materiales'
DROP POLICY IF EXISTS "Subida materiales" ON storage.objects;
CREATE POLICY "Subida materiales" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materiales' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Ver materiales" ON storage.objects;
CREATE POLICY "Ver materiales" ON storage.objects FOR SELECT USING (bucket_id = 'materiales');
DROP POLICY IF EXISTS "Borrar materiales" ON storage.objects;
CREATE POLICY "Borrar materiales" ON storage.objects FOR DELETE USING (bucket_id = 'materiales' AND auth.role() = 'authenticated');

-- Políticas para el bucket 'herramientas'
DROP POLICY IF EXISTS "Subida herramientas" ON storage.objects;
CREATE POLICY "Subida herramientas" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'herramientas' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Ver herramientas" ON storage.objects;
CREATE POLICY "Ver herramientas" ON storage.objects FOR SELECT USING (bucket_id = 'herramientas');
DROP POLICY IF EXISTS "Borrar herramientas" ON storage.objects;
CREATE POLICY "Borrar herramientas" ON storage.objects FOR DELETE USING (bucket_id = 'herramientas' AND auth.role() = 'authenticated');

-- 4. FUNCIÓN Y TRIGGER PARA PERFILES AUTOMÁTICOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nuevo Empleado'), 'OPERARIO');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- IMPORTANTE: Recuerda DESACTIVAR "Confirm email" en:
-- Authentication > Providers > Email en tu panel de Supabase.
