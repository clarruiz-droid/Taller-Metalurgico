-- MÓDULO DE COMPRAS Y FOTOS (v1.8.0) --

-- 1. TABLA DE COMPRAS
CREATE TABLE IF NOT EXISTS public.compras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.proveedores(id),
  purchase_date DATE DEFAULT CURRENT_DATE,
  total_amount DECIMAL(12,2) DEFAULT 0,
  items JSONB DEFAULT '[]', -- Array de {material_id, description, quantity, unit_price}
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. AÑADIR IMÁGENES A ÓRDENES DE TRABAJO
ALTER TABLE public.ordenes_trabajo 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- 3. Habilitar RLS para Compras
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Compras visibles" ON public.compras;
CREATE POLICY "Compras visibles" ON public.compras FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion total compras" ON public.compras;
CREATE POLICY "Gestion total compras" ON public.compras FOR ALL USING (true);

-- 4. Comentario de version
COMMENT ON TABLE public.compras IS 'Registro de compras de insumos v1.8.0';
