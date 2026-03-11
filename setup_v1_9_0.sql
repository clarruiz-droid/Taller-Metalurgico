-- ACTUALIZACIÓN PARA DESCUENTO DE STOCK (v1.9.0) --
ALTER TABLE public.ordenes_trabajo 
ADD COLUMN IF NOT EXISTS stock_discounted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.ordenes_trabajo.stock_discounted IS 'Indica si los materiales del presupuesto ya fueron descontados del stock';
