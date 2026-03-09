import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import './Reports.css';

const ReportsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [stats, setStats] = useState({
    lowStockMaterials: 0,
    budgetsPendingOrder: 0,
    activeWorkOrders: 0,
    toolsInRepair: 0,
    urgentOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 1. Artículos con stock bajo
      const { data: materials } = await supabase.from('materiales').select('quantity, min_stock');
      const lowStock = materials?.filter(m => m.quantity <= m.min_stock).length || 0;

      // 2. Presupuestos aprobados sin orden de trabajo
      const { data: ordersWithBudget } = await supabase.from('ordenes_trabajo').select('budget_id').not('budget_id', 'is', null);
      const budgetIdsInOrders = ordersWithBudget?.map(o => o.budget_id) || [];
      
      const { data: budgets } = await supabase.from('presupuestos').select('id').eq('status', 'APROBADO');
      const pendingOrders = budgets?.filter(b => !budgetIdsInOrders.includes(b.id)).length || 0;

      // 3. Órdenes de trabajo activas (Pendiente o Proceso)
      const { data: activeOrders } = await supabase.from('ordenes_trabajo').select('status, priority, estimated_end_date').in('status', ['PENDIENTE', 'PROCESO']);
      
      // 4. Herramientas fuera de servicio
      const { data: tools } = await supabase.from('herramientas').select('status').neq('status', 'OPERATIVA');

      // 5. Órdenes urgentes (Prioridad ALTA o vencen en < 48hs)
      const now = new Date();
      const urgent = activeOrders?.filter(o => {
        const dueDate = new Date(o.estimated_end_date);
        const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return o.priority === 'ALTA' || (diffHours > 0 && diffHours < 48);
      }).length || 0;

      setStats({
        lowStockMaterials: lowStock,
        budgetsPendingOrder: pendingOrders,
        activeWorkOrders: activeOrders?.length || 0,
        toolsInRepair: tools?.length || 0,
        urgentOrders: urgent
      });
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inventory-view reports-container">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Dashboard de Reportes</h3>
      </header>

      {loading ? (
        <div className="loading-state">Calculando indicadores...</div>
      ) : (
        <div className="reports-grid">
          {/* Fila 1: Estado Crítico */}
          <div className={`report-card ${stats.lowStockMaterials > 0 ? 'alert' : ''}`}>
            <span className="card-icon">📦</span>
            <div className="card-content">
              <h4>Stock Crítico</h4>
              <p className="card-value">{stats.lowStockMaterials}</p>
              <p className="card-label">Materiales bajo el mínimo</p>
            </div>
          </div>

          <div className={`report-card ${stats.urgentOrders > 0 ? 'danger' : ''}`}>
            <span className="card-icon">🚨</span>
            <div className="card-content">
              <h4>Urgencias</h4>
              <p className="card-value">{stats.urgentOrders}</p>
              <p className="card-label">Órdenes críticas o por vencer</p>
            </div>
          </div>

          {/* Fila 2: Operación */}
          <div className="report-card primary">
            <span className="card-icon">⚙️</span>
            <div className="card-content">
              <h4>En Producción</h4>
              <p className="card-value">{stats.activeWorkOrders}</p>
              <p className="card-label">Órdenes de trabajo activas</p>
            </div>
          </div>

          <div className="report-card warning">
            <span className="card-icon">🔧</span>
            <div className="card-content">
              <h4>Mantenimiento</h4>
              <p className="card-value">{stats.toolsInRepair}</p>
              <p className="card-label">Herramientas no operativas</p>
            </div>
          </div>

          {/* Fila 3: Ventas y Pendientes */}
          <div className="report-card info">
            <span className="card-icon">📄</span>
            <div className="card-content">
              <h4>Esperando Orden</h4>
              <p className="card-value">{stats.budgetsPendingOrder}</p>
              <p className="card-label">Presupuestos aprobados listos</p>
            </div>
          </div>
        </div>
      )}

      <footer className="reports-footer">
        <button className="btn-secondary" onClick={fetchStats}>🔄 Actualizar Indicadores</button>
      </footer>
    </div>
  );
};

export default ReportsView;
