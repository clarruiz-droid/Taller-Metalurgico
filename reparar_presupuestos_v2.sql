-- ACTUALIZACIÓN DE TABLA PRESUPUESTOS (v1.2.3) --
-- Ejecutar en el Editor SQL de Supabase para habilitar el seguimiento de creador --

ALTER TABLE public.presupuestos 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Comentario para verificar la relación con perfiles en las consultas
COMMENT ON COLUMN public.presupuestos.created_by IS 'Usuario que creó el presupuesto';
