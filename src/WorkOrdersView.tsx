import React, { useState, useEffect } from 'react';
import type { WorkOrder, User, WorkOrderHistory } from './types';
import { supabase } from './lib/supabase';
import { WORK_ORDER_STATUS_LABELS } from './types';
import './WorkOrders.css';

interface WorkOrdersViewProps {
  onBack: () => void;
  currentUser: User | null;
}

const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({ onBack, currentUser }) => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<WorkOrderHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);

  const [formData, setFormData] = useState<Partial<WorkOrder>>({
    client_name: '',
    description: '',
    status: 'PENDIENTE',
    priority: 'MEDIA',
    estimated_end_date: '',
    assigned_to: '',
    observations: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woRes, uRes] = await Promise.all([
        supabase.from('ordenes_trabajo').select('*, profiles:assigned_to(full_name)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role').order('full_name')
      ]);

      if (!woRes.error) {
        setWorkOrders(woRes.data.map((wo: any) => ({
          ...wo,
          assigned_to_name: wo.profiles?.full_name || 'Sin asignar'
        })));
      }
      
      if (!uRes.error) {
        const mappedUsers = uRes.data
          .filter((p: any) => p.role === 'OPERARIO' || p.role === 'SUPERVISOR')
          .map((p: any) => ({
            id: p.id,
            name: p.full_name,
            role: p.role,
            username: ''
          }));
        setUsers(mappedUsers);
      }
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (orderId: string) => {
    const { data, error } = await supabase
      .from('historial_ordenes')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    
    if (!error) setHistory(data || []);
  };

  const logChange = async (orderId: string, action: string, details: string) => {
    await supabase.from('historial_ordenes').insert([{
      order_id: orderId,
      user_id: currentUser?.id,
      user_name: currentUser?.name || 'Sistema',
      action,
      details
    }]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = {
        client_name: formData.client_name,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        estimated_end_date: formData.estimated_end_date,
        assigned_to: formData.assigned_to || null,
        observations: formData.observations,
        budget_id: formData.budget_id
      };

      if (editingOrder) {
        const { error } = await supabase.from('ordenes_trabajo').update(dataToSave).eq('id', editingOrder.id);
        if (error) throw error;
        
        // Detectar cambios detallados para el historial
        const changes: string[] = [];
        const fieldLabels: Record<string, string> = {
          status: 'Estado',
          priority: 'Prioridad',
          assigned_to: 'Asignación',
          client_name: 'Cliente',
          description: 'Descripción',
          estimated_end_date: 'Fecha Entrega',
          observations: 'Observaciones'
        };

        (Object.keys(dataToSave) as Array<keyof typeof dataToSave>).forEach(key => {
          const oldVal = editingOrder[key as keyof WorkOrder];
          const newVal = dataToSave[key];

          if (oldVal !== newVal) {
            const label = fieldLabels[key] || key;
            
            // Formateo especial para asignación (nombres en lugar de IDs)
            if (key === 'assigned_to') {
              const oldUser = users.find(u => u.id === oldVal)?.name || 'Sin asignar';
              const newUser = users.find(u => u.id === newVal)?.name || 'Sin asignar';
              changes.push(`${label}: [${oldUser}] ➔ [${newUser}]`);
            } else {
              changes.push(`${label}: [${oldVal || 'Vacío'}] ➔ [${newVal || 'Vacío'}]`);
            }
          }
        });
        
        if (changes.length > 0) {
          await logChange(editingOrder.id, 'MODIFICACION', changes.join(' | '));
        }
      } else {
        const { data, error } = await supabase.from('ordenes_trabajo').insert([dataToSave]).select().single();
        if (error) throw error;
        await logChange(data.id, 'CREACION', 'Orden de trabajo iniciada');
      }
      
      alert('Orden guardada con éxito');
      setShowForm(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error al guardar orden:', error);
      alert('Error: ' + (error.message || 'No se pudo guardar la orden'));
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (wo: WorkOrder) => {
    setEditingOrder(wo);
    setFormData(wo);
    fetchHistory(wo.id);
    setShowForm(true);
  };

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'ALTA': return '#ef4444';
      case 'MEDIA': return '#f59e0b';
      case 'BAJA': return '#3498db';
      default: return 'var(--text-secondary)';
    }
  };

  const filteredOrders = workOrders.filter(wo => 
    (wo.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (wo.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={showForm ? () => setShowForm(false) : onBack}>← Volver</button>
        <h3>{showForm ? 'Detalle de Orden' : 'Órdenes de Trabajo'}</h3>
      </header>

      {!showForm ? (
        <>
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="🔍 Buscar por cliente o trabajo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="material-list">
            {filteredOrders.length === 0 && !loading && <p className="empty-msg">No hay órdenes que coincidan con la búsqueda.</p>}
            {filteredOrders.map(wo => (
              <div key={wo.id} className="material-card wo-card clickable" onClick={() => openEdit(wo)}>
                <div className="wo-priority-indicator" style={{ backgroundColor: getPriorityColor(wo.priority) }}></div>
                <div className="material-info">
                  <div className="tool-header">
                    <h4>{wo.client_name}</h4>
                    <span className={`status-badge status-${wo.status.toLowerCase()}`}>
                      {WORK_ORDER_STATUS_LABELS[wo.status]}
                    </span>
                  </div>
                  <p className="wo-desc">{wo.description}</p>
                  <div className="budget-meta-list">
                    <span className="meta-tag">👤 {wo.assigned_to_name}</span>
                    <span className="meta-tag">📅 Entrega: {new Date(wo.estimated_end_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="material-form-container">
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group">
              <label>Cliente</label>
              <input type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required className="form-input" />
            </div>
            <div className="form-group">
              <label>Descripción del Trabajo</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required className="form-input" rows={3} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Prioridad</label>
                <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})} className="form-input">
                  <option value="BAJA">Baja</option>
                  <option value="MEDIA">Media</option>
                  <option value="ALTA">Alta</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="form-input">
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="PROCESO">En Proceso</option>
                  <option value="FINALIZADO">Finalizado</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Asignar a</label>
                <select value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="form-input">
                  <option value="">Sin asignar</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha Estimada Entrega</label>
                <input type="date" value={formData.estimated_end_date} onChange={e => setFormData({...formData, estimated_end_date: e.target.value})} required className="form-input" />
              </div>
            </div>
            <div className="form-group">
              <label>Observaciones / Notas</label>
              <textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="form-input" rows={2} />
            </div>
            
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>Guardar Cambios</button>
            </div>
          </form>

          {/* SECCIÓN DE HISTORIAL */}
          <div className="history-section">
            <h4>📜 Historial de Cambios</h4>
            <div className="history-timeline">
              {history.length === 0 ? (
                <p className="empty-msg">No hay registros de cambios aún.</p>
              ) : (
                history.map(log => (
                  <div key={log.id} className="history-item">
                    <div className="history-dot"></div>
                    <div className="history-content">
                      <div className="history-header">
                        <strong>{log.user_name}</strong>
                        <span className="history-time">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div className="history-action-badge">{log.action}</div>
                      <p className="history-details">{log.details}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrdersView;
