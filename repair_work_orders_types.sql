-- SCRIPT DE REPARACIÓN DE TIPOS PARA ÓRDENES DE TRABAJO (v1.5.4) --
-- Ejecuta esto en el Editor SQL de Supabase --

-- 1. Eliminar la columna problemática y recrearla con el tipo correcto
ALTER TABLE public.ordenes_trabajo 
DROP COLUMN IF EXISTS budget_id;

ALTER TABLE public.ordenes_trabajo 
ADD COLUMN budget_id BIGINT REFERENCES public.presupuestos(id) ON DELETE SET NULL;

-- 2. Asegurar que assigned_to sea UUID pero permita nulos
ALTER TABLE public.ordenes_trabajo 
ALTER COLUMN assigned_to TYPE UUID USING assigned_to::uuid;

-- 3. Comentario de verificación
COMMENT ON COLUMN public.ordenes_trabajo.budget_id IS 'ID numérico del presupuesto relacionado';
