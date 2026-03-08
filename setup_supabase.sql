CREATE TYPE user_role AS ENUM ('ADMIN', 'GERENTE', 'SUPERVISOR', 'OPERARIO');
CREATE TYPE tool_status AS ENUM ('OPERATIVA', 'REPARACION', 'EXTRAVIADA');
CREATE TYPE budget_status AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');
CREATE TYPE work_order_status AS ENUM ('PENDIENTE', 'PROCESO', 'FINALIZADO');
CREATE TYPE priority_level AS ENUM ('BAJA', 'MEDIA', 'ALTA');

CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role user_role DEFAULT 'OPERARIO',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  cuit_dni TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a autenticados" ON clientes FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE materiales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity DECIMAL DEFAULT 0,
  min_stock DECIMAL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE herramientas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  brand TEXT,
  status tool_status DEFAULT 'OPERATIVA',
  responsible_id UUID REFERENCES profiles(id),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE presupuestos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  work_description TEXT,
  labor_cost DECIMAL DEFAULT 0,
  total_amount DECIMAL DEFAULT 0,
  status budget_status DEFAULT 'PENDIENTE',
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ordenes_trabajo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES presupuestos(id),
  client_name TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  start_date DATE DEFAULT CURRENT_DATE,
  estimated_end_date DATE,
  status work_order_status DEFAULT 'PENDIENTE',
-- Función para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'OPERARIO');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que ejecuta la función después de un INSERT en auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

