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
export type WorkOrderPriority = 'BAJA' | 'MEDIA' | 'ALTA';

export interface WorkOrder {
  id: string;
  budget_id?: number;
  client_name: string;
  description: string;
  assigned_to?: string;
  assigned_to_name?: string;
  start_date: string;
  estimated_end_date: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  observations?: string;
  images?: string[];
  stock_discounted?: boolean;
}

export interface PurchaseItem {
  material_id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export type PurchaseStatus = 'PAGADA' | 'CTA_CTE' | 'PARCIAL';

export interface Purchase {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  purchase_date: string;
  total_amount: number;
  items: PurchaseItem[];
  observations?: string;
  status: PurchaseStatus;
  created_at: string;
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  PAGADA: 'Pagada',
  CTA_CTE: 'Cuenta Corriente',
  PARCIAL: 'Pago Parcial'
};

export interface WorkOrderHistory {
  id: string;
  order_id: string;
  user_id: string;
  user_name: string;
  action: 'CREACION' | 'MODIFICACION' | 'CAMBIO_ESTADO';
  details: string;
  created_at: string;
}

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  PROCESO: 'En Proceso',
  FINALIZADO: 'Finalizado'
};

export const WORK_ORDER_PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta'
};
