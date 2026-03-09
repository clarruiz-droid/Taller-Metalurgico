export type UserRole = 'ADMIN' | 'GERENTE' | 'SUPERVISOR' | 'OPERARIO';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  SUPERVISOR: 'Supervisor',
  OPERARIO: 'Operario'
};

export interface Material {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  min_stock: number;
  image_url?: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  cuit_dni?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  cuit_dni?: string;
  rubro?: string;
}

export type ToolStatus = 'OPERATIVA' | 'REPARACION' | 'EXTRAVIADA';

export interface Tool {
  id: string;
  description: string;
  brand: string;
  status: ToolStatus;
  responsible_id?: string;
  image_url?: string;
}

export const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  OPERATIVA: 'Operativa',
  REPARACION: 'En Reparación',
  EXTRAVIADA: 'Extraviada'
};

export interface BudgetItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export type BudgetStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface Budget {
  id: string;
  order_number: number;
  client_id: string;
  client_name?: string;
  created_at: string;
  validity_days: number;
  short_description: string;
  long_description: string;
  images: string[];
  materials: { id: string; description: string; quantity: number }[];
  tools: string[]; // IDs de herramientas
  estimated_value: number;
  status: 'PENDIENTE' | 'EN_PREPARACION' | 'ENVIADO' | 'APROBADO' | 'RECHAZADO' | 'FINALIZADO';
  created_by?: string;
  creator_name?: string;
}

export type WorkOrderStatus = 'PENDIENTE' | 'PROCESO' | 'FINALIZADO';

export interface WorkOrder {
  id: string;
  budget_id?: string;
  client_name: string;
  description: string;
  assigned_to?: string;
  start_date: string;
  estimated_end_date: string;
  status: WorkOrderStatus;
  priority: 'BAJA' | 'MEDIA' | 'ALTA';
}

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  PROCESO: 'En Proceso',
  FINALIZADO: 'Finalizado'
};
