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
  priority priority_level DEFAULT 'MEDIA',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
