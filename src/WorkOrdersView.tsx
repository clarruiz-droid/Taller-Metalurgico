import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { WorkOrder, User, WorkOrderHistory, Tool } from './types';
import { supabase } from './lib/supabase';
import { WORK_ORDER_STATUS_LABELS } from './types';
import './WorkOrders.css';

interface WorkOrdersViewProps {
  onBack: () => void;
  currentUser: User | null;
}

const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({ onBack, currentUser }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [budgetInfo, setBudgetInfo] = useState<{ materials: any[], tools: string[] } | null>(null);
  const [history, setHistory] = useState<WorkOrderHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);

  const [formData, setFormData] = useState<Partial<WorkOrder>>({
    client_name: '',
    description: '',
    status: 'PENDIENTE',
    priority: 'MEDIA',
    estimated_end_date: '',
    assigned_to: '',
    observations: '',
    images: []
  });

  useEffect(() => {
    init();
  }, [routeId]);

  const init = async () => {
    setLoading(true);
    await fetchData();
    if (routeId) {
      await loadSingleOrder(routeId);
    } else {
      setEditingOrder(null);
    }
    setLoading(false);
  };

  const fetchData = async () => {
    try {
      const [woRes, uRes, tRes] = await Promise.all([
        supabase.from('ordenes_trabajo').select('*, profiles:assigned_to(full_name)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role').order('full_name'),
        supabase.from('herramientas').select('*')
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

      if (!tRes.error) setAllTools(tRes.data || []);
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  };

  const loadSingleOrder = async (id: string) => {
    const { data, error } = await supabase
      .from('ordenes_trabajo')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!error && data) {
      setEditingOrder(data);
      setFormData(data);
      fetchHistory(id);
      if (data.budget_id) fetchBudgetDetails(data.budget_id);
    }
  };

  const fetchBudgetDetails = async (budgetId: number) => {
    const { data, error } = await supabase
      .from('presupuestos')
      .select('materials, tools')
      .eq('id', budgetId)
      .single();
    
    if (!error && data) {
      setBudgetInfo(data);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingOrder) return;

    setLoading(true);
    try {
      const newImages = [...(formData.images || [])];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `work-orders/${editingOrder.id}/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from('presupuestos')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('presupuestos')
          .getPublicUrl(data.path);

        newImages.push(publicUrl);
      }

      setFormData({ ...formData, images: newImages });
      // NOTA: No guardamos en DB aquí, solo en el estado. Se guarda al final con handleSave.
    } catch (error: any) {
      alert('Error al subir imágenes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave: any = {
        client_name: formData.client_name,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        estimated_end_date: formData.estimated_end_date,
        assigned_to: formData.assigned_to || null,
        observations: formData.observations,
        budget_id: formData.budget_id,
        images: formData.images || []
      };

      if (editingOrder) {
        // LÓGICA DE DESCUENTO DE STOCK
        if (formData.status === 'FINALIZADO' && !editingOrder.stock_discounted && formData.budget_id) {
          if (window.confirm('La orden se marcará como FINALIZADA. ¿Desea descontar automáticamente los materiales del presupuesto del stock actual?')) {
            const { data: budgetData } = await supabase
              .from('presupuestos')
              .select('materials')
              .eq('id', formData.budget_id)
              .single();

            if (budgetData?.materials) {
              for (const item of budgetData.materials) {
                const { data: matData } = await supabase.from('materiales').select('quantity').eq('id', item.id).single();
                if (matData) {
                  const newQty = Math.max(0, Number(matData.quantity) - Number(item.quantity));
                  await supabase.from('materiales').update({ quantity: newQty }).eq('id', item.id);
                }
              }
              dataToSave.stock_discounted = true;
            }
          }
        }

        const { error } = await supabase.from('ordenes_trabajo').update(dataToSave).eq('id', editingOrder.id);
        if (error) throw error;
        
        const changes: string[] = [];
        const fieldLabels: Record<string, string> = {
          status: 'Estado', priority: 'Prioridad', assigned_to: 'Asignación',
          client_name: 'Cliente', description: 'Descripción',
          estimated_end_date: 'Fecha Entrega', observations: 'Observaciones',
          images: 'Fotos'
        };

        (Object.keys(dataToSave) as string[]).forEach(key => {
          const oldVal = editingOrder[key as keyof WorkOrder];
          const newVal = dataToSave[key];
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            const label = fieldLabels[key] || key;
            if (key === 'assigned_to') {
              const oldUser = users.find(u => u.id === (oldVal as string))?.name || 'Sin asignar';
              const newUser = users.find(u => u.id === (newVal as string))?.name || 'Sin asignar';
              changes.push(`${String(label)}: [${oldUser}] ➔ [${newUser}]`);
            } else if (key === 'images') {
              changes.push(`Fotos: Se actualizaron las imágenes del trabajo`);
            } else {
              changes.push(`${String(label)}: [${String(oldVal || 'Vacío')}] ➔ [${String(newVal || 'Vacío')}]`);
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
      navigate('/work-orders');
    } catch (error: any) {
      console.error('Error al guardar orden:', error);
      alert('Error: ' + (error.message || 'No se pudo guardar la orden'));
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (wo: WorkOrder) => {
    navigate(`/work-orders/edit/${wo.id}`);
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
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>{routeId ? 'Detalle de Orden' : 'Órdenes de Trabajo'}</h3>
      </header>

      {!routeId ? (
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

            {budgetInfo && (
              <div className="form-group status-group-highlight" style={{ backgroundColor: 'rgba(52, 152, 219, 0.03)', borderStyle: 'solid' }}>
                <label style={{ color: 'var(--primary-color)', fontSize: '0.75rem' }}>🛠️ Planificado en Presupuesto</label>
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', opacity: 0.8 }}>MATERIALES:</p>
                  <div className="selected-items-list">
                    {budgetInfo.materials?.map((m, idx) => (
                      <span key={idx} className="item-chip view-mode">{m.description} <span className="chip-qty-view">x{m.quantity}</span></span>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem', opacity: 0.8 }}>HERRAMIENTAS:</p>
                  <div className="selected-items-list">
                    {budgetInfo.tools?.map((toolId, idx) => {
                      const toolName = allTools.find(t => t.id === toolId)?.description || 'Herramienta desconocida';
                      return <span key={idx} className="tool-chip">{toolName}</span>;
                    })}
                  </div>
                </div>
              </div>
            )}

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

            <div className="form-group status-group-highlight">
              <label>📸 Fotos del Trabajo</label>
              <div className="budget-images-gallery" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginTop: '1rem' }}>
                {formData.images?.map((url, idx) => (
                  <div key={idx} className="material-img" style={{ width: '100%', height: '100px', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')}><img src={url} alt={`Trabajo ${idx}`} /></div>
                ))}
                <label className="menu-item" style={{ padding: '1rem', border: '2px dashed var(--border-color)', cursor: 'pointer', height: '100px', justifyContent: 'center', marginBottom: 0 }}>
                  <span className="icon" style={{ fontSize: '1.25rem' }}>🖼️</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Galería</span>
                  <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
                <label className="menu-item" style={{ padding: '1rem', border: '2px dashed var(--primary-color)', cursor: 'pointer', height: '100px', justifyContent: 'center', marginBottom: 0, backgroundColor: 'rgba(52, 152, 219, 0.05)' }}>
                  <span className="icon" style={{ fontSize: '1.25rem' }}>📷</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Cámara</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
            
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={onBack}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>Guardar Cambios</button>
            </div>
          </form>

          <div className="history-section">
            <h4>📜 Historial de Cambios</h4>
            <div className="history-timeline">
              {history.map(log => (
                <div key={log.id} className="history-item">
                  <div className="history-dot"></div>
                  <div className="history-content">
                    <div className="history-header"><strong>{log.user_name}</strong><span className="history-time">{new Date(log.created_at).toLocaleString()}</span></div>
                    <div className="history-action-badge">{log.action}</div>
                    <p className="history-details">{log.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrdersView;
