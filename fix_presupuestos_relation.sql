-- CORRECCIÓN DE CLAVE FORÁNEA PARA PRESUPUESTOS --
-- Permite que la consulta de perfiles funcione correctamente --

ALTER TABLE public.presupuestos 
DROP CONSTRAINT IF EXISTS presupuestos_created_by_fkey;

ALTER TABLE public.presupuestos 
ADD CONSTRAINT presupuestos_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
