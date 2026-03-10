-- TABLA DE HISTORIAL DE ÓRDENES (v1.7.0) --
CREATE TABLE IF NOT EXISTS public.historial_ordenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.ordenes_trabajo(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  user_name TEXT, -- Guardamos el nombre para rapidez de lectura
  action TEXT NOT NULL, -- 'CREACION', 'MODIFICACION', 'CAMBIO_ESTADO'
  details TEXT, -- Descripción de qué cambió
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.historial_ordenes ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
DROP POLICY IF EXISTS "Historial visible" ON public.historial_ordenes;
CREATE POLICY "Historial visible" ON public.historial_ordenes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserción historial" ON public.historial_ordenes;
CREATE POLICY "Inserción historial" ON public.historial_ordenes FOR INSERT WITH CHECK (true);
