-- TABLA DE ÓRDENES DE TRABAJO (v1.5.0) --
CREATE TABLE IF NOT EXISTS public.ordenes_trabajo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id BIGINT REFERENCES public.presupuestos(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id),
  start_date DATE DEFAULT CURRENT_DATE,
  estimated_end_date DATE,
  status TEXT DEFAULT 'PENDIENTE', -- PENDIENTE, PROCESO, FINALIZADO
  priority TEXT DEFAULT 'MEDIA',   -- BAJA, MEDIA, ALTA
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.ordenes_trabajo ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
DROP POLICY IF EXISTS "Órdenes visibles" ON public.ordenes_trabajo;
CREATE POLICY "Órdenes visibles" ON public.ordenes_trabajo FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestión total órdenes" ON public.ordenes_trabajo;
CREATE POLICY "Gestión total órdenes" ON public.ordenes_trabajo FOR ALL USING (true);
