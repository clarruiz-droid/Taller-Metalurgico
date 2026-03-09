-- TABLA DE PROVEEDORES (v1.4.0) --
CREATE TABLE IF NOT EXISTS public.proveedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  cuit_dni TEXT,
  rubro TEXT, -- Campo adicional para proveedores
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

-- Politicas de acceso
DROP POLICY IF EXISTS "Proveedores visibles" ON public.proveedores;
CREATE POLICY "Proveedores visibles" ON public.proveedores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion total proveedores" ON public.proveedores;
CREATE POLICY "Gestion total proveedores" ON public.proveedores FOR ALL USING (true);
