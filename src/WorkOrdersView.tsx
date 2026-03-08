import React, { useState, useEffect } from 'react';
import type { WorkOrder, WorkOrderStatus } from './types';
import { supabase } from './lib/supabase';
import './WorkOrders.css';

const WorkOrdersView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [filter, setFilter] = useState<WorkOrderStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando órdenes:', error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: WorkOrderStatus) => {
    const { error } = await supabase
      .from('ordenes_trabajo')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar estado');
    } else {
      fetchOrders(); // Recargar datos
    }
  };

  const filteredOrders = filter === 'ALL' 
    ? orders 
    : orders.filter(o => o.status === filter);

  return (
    <div className="work-orders-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Órdenes de Trabajo (Nube)</h3>
      </header>

      <div className="filter-tabs">
        <button className={filter === 'ALL' ? 'active' : ''} onClick={() => setFilter('ALL')}>Todas</button>
        <button className={filter === 'PENDIENTE' ? 'active' : ''} onClick={() => setFilter('PENDIENTE')}>Pendientes</button>
        <button className={filter === 'PROCESO' ? 'active' : ''} onClick={() => setFilter('PROCESO')}>Proceso</button>
        <button className={filter === 'FINALIZADO' ? 'active' : ''} onClick={() => setFilter('FINALIZADO')}>Listo</button>
      </div>

      {loading ? <div className="loading-state">Cargando...</div> : (
        <div className="order-list">
          {filteredOrders.length === 0 ? <p className="empty-msg">No hay órdenes en este estado.</p> : (
            filteredOrders.map(order => (
              <div key={order.id} className={`order-card priority-${order.priority.toLowerCase()}`}>
                <div className="order-card-header">
                  <span className="order-id"># {order.id.slice(0, 8)}</span>
                  <span className={`priority-badge`}>{order.priority}</span>
                </div>
                <h4>{order.client_name}</h4>
                <p className="order-desc">{order.description}</p>
                <div className="order-dates">
                  <span>📅 {order.start_date}</span>
                  <span>🏁 Est. {order.estimated_end_date || 'Sin definir'}</span>
                </div>
                
                <div className="order-status-actions">
                  {order.status !== 'FINALIZADO' && (
                    <div className="action-buttons">
                      {order.status === 'PENDIENTE' && (
                        <button className="btn-status process" onClick={() => updateStatus(order.id, 'PROCESO')}>Comenzar</button>
                      )}
                      {order.status === 'PROCESO' && (
                        <button className="btn-status finish" onClick={() => updateStatus(order.id, 'FINALIZADO')}>Finalizar</button>
                      )}
                    </div>
                  )}
                  {order.status === 'FINALIZADO' && <div className="status-badge-big">✅ TRABAJO TERMINADO</div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default WorkOrdersView;
