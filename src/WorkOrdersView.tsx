import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { WorkOrder, User, WorkOrderHistory, Tool, WorkOrderStatus } from './types';
import { supabase } from './lib/supabase';
import { WORK_ORDER_STATUS_LABELS } from './types';
import { saveLocalImageArray, getLocalImageArray, deleteLocalImage } from './lib/localDb';
import './WorkOrders.css';

interface WorkOrdersViewProps {
  currentUser: User | null;
}

const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({ currentUser }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [budgetInfo, setBudgetInfo] = useState<{ materials: any[], tools: string[] } | null>(null);
  const [history, setHistory] = useState<WorkOrderHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WorkOrderStatus>('ALL');
  const [loading, setLoading] = useState(true);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  
  const [localImageBlobs, setLocalImageBlobs] = useState<Blob[]>([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);

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
      const { data } = await supabase.from('ordenes_trabajo').select('*').eq('id', routeId).single();
      if (data) {
        setEditingOrder(data);
        const draft = localStorage.getItem(`draft_wo_${routeId}`);
        if (draft) setFormData(JSON.parse(draft));
        else setFormData(data);
        
        fetchHistory(routeId);
        if (data.budget_id) fetchBudgetDetails(data.budget_id);

        // Cargar imágenes locales pendientes de subida
        const localBlobs = await getLocalImageArray(`wo_${routeId}`);
        if (localBlobs) {
          setLocalImageBlobs(localBlobs);
          setLocalPreviews(localBlobs.map(b => URL.createObjectURL(b)));
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (routeId) localStorage.setItem(`draft_wo_${routeId}`, JSON.stringify(formData));
  }, [formData, routeId]);

  const fetchData = async () => {
    try {
      const [woRes, uRes, tRes] = await Promise.all([
        supabase.from('ordenes_trabajo').select('*, profiles:assigned_to(full_name)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role').order('full_name'),
        supabase.from('herramientas').select('*')
      ]);
      if (!woRes.error) setWorkOrders(woRes.data.map((wo: any) => ({ ...wo, assigned_to_name: wo.profiles?.full_name || 'Sin asignar' })));
      if (!uRes.error) setUsers(uRes.data.filter((p: any) => p.role === 'OPERARIO' || p.role === 'SUPERVISOR').map((p: any) => ({ id: p.id, name: p.full_name, role: p.role, username: '' })));
      if (!tRes.error) setAllTools(tRes.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchBudgetDetails = async (budgetId: number) => {
    const { data } = await supabase.from('presupuestos').select('materials, tools').eq('id', budgetId).single();
    if (data) setBudgetInfo(data);
  };

  const fetchHistory = async (orderId: string) => {
    const { data } = await supabase.from('historial_ordenes').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
    if (data) setHistory(data);
  };

  const logChange = async (orderId: string, action: string, details: string) => {
    await supabase.from('historial_ordenes').insert([{ order_id: orderId, user_id: currentUser?.id, user_name: currentUser?.name || 'Sistema', action, details }]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !routeId) return;

    try {
      const newBlobs = [...localImageBlobs, file];
      setLocalImageBlobs(newBlobs);
      setLocalPreviews(prev => [...prev, URL.createObjectURL(file)]);
      
      // Guardar array de blobs en IndexedDB
      await saveLocalImageArray(`wo_${routeId}`, newBlobs);
    } catch (err: any) { alert('Error local: ' + err.message); }
    finally { e.target.value = ''; }
  };

  const handleDeleteLocalImage = async (index: number) => {
    const newBlobs = localImageBlobs.filter((_, i) => i !== index);
    const newPreviews = localPreviews.filter((_, i) => i !== index);
    setLocalImageBlobs(newBlobs);
    setLocalPreviews(newPreviews);
    if (routeId) await saveLocalImageArray(`wo_${routeId}`, newBlobs);
  };

  const uploadImagesToSupabase = async (blobs: Blob[], orderId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const blob of blobs) {
      const fileName = `wo-${orderId}-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from('presupuestos').upload(fileName, blob);
      if (error) throw error;
      const { data } = supabase.storage.from('presupuestos').getPublicUrl(fileName);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const orderId = routeId!;
      
      // 1. Subir imágenes locales si existen
      let newRemoteUrls: string[] = [];
      if (localImageBlobs.length > 0) {
        newRemoteUrls = await uploadImagesToSupabase(localImageBlobs, orderId);
      }

      // 2. Combinar con las imágenes que ya estaban en la orden
      const finalImages = [...(formData.images || []), ...newRemoteUrls];
      
      const dataToSave: any = { ...formData, images: finalImages };
      delete dataToSave.assigned_to_name;

      if (editingOrder) {
        // Lógica de descuento de stock
        if (formData.status === 'FINALIZADO' && !editingOrder.stock_discounted && formData.budget_id) {
          if (window.confirm('¿Descontar stock automáticamente?')) {
            const { data: budgetData } = await supabase.from('presupuestos').select('materials').eq('id', formData.budget_id).single();
            if (budgetData?.materials) {
              for (const item of budgetData.materials) {
                const { data: matData } = await supabase.from('materiales').select('quantity').eq('id', item.id).single();
                if (matData) await supabase.from('materiales').update({ quantity: Math.max(0, Number(matData.quantity) - Number(item.quantity)) }).eq('id', item.id);
              }
              dataToSave.stock_discounted = true;
            }
          }
        }
        await supabase.from('ordenes_trabajo').update(dataToSave).eq('id', editingOrder.id);
        
        if (newRemoteUrls.length > 0) {
          await logChange(orderId, 'MODIFICACION', `Se agregaron ${newRemoteUrls.length} fotos nuevas`);
        }
      }

      // 3. Limpiar todo
      await deleteLocalImage(`wo_${orderId}`);
      localStorage.removeItem(`draft_wo_${orderId}`);
      navigate('/work-orders');
    } catch (err: any) { alert(err.message); }
    finally { setLoading(false); }
  };

  const filteredOrders = workOrders.filter(wo => {
    const matchesSearch = (wo.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (wo.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="inventory-view">
      <header className="view-header"><button className="btn-back" onClick={() => navigate(routeId ? '/work-orders' : '/dashboard')}>← Volver</button><h3>{routeId ? 'Detalle de Orden' : 'Órdenes de Trabajo'}</h3></header>

      {!routeId ? (
        <>
          <div className="search-bar"><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input" /></div>
          <div className="filter-tabs budget-filters" style={{ marginBottom: '1.5rem' }}>
            {['ALL', 'PENDIENTE', 'PROCESO', 'FINALIZADO'].map(s => (
              <button key={s} className={`filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s as any)}>{s === 'ALL' ? 'Todas' : WORK_ORDER_STATUS_LABELS[s as WorkOrderStatus]}</button>
            ))}
          </div>
          <div className="material-list">
            {filteredOrders.map(wo => (
              <div key={wo.id} className="material-card wo-card clickable" onClick={() => navigate(`/work-orders/edit/${wo.id}`)}>
                <div className="wo-priority-indicator" style={{ backgroundColor: wo.priority === 'ALTA' ? '#ef4444' : wo.priority === 'MEDIA' ? '#f59e0b' : '#3498db' }}></div>
                <div className="material-info"><div className="tool-header"><h4>{wo.client_name}</h4><span className={`status-badge status-${wo.status.toLowerCase()}`}>{WORK_ORDER_STATUS_LABELS[wo.status]}</span></div><p className="wo-desc">{wo.description}</p></div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="material-form-container">
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group status-group-highlight" style={{ textAlign: 'center' }}>
              <div className="budget-images-gallery" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginBottom: '1rem' }}>
                {/* Fotos ya guardadas en la nube */}
                {formData.images?.map((url, idx) => (<div key={`remote-${idx}`} className="material-img" style={{ height: '80px' }}><img src={url} alt="" onClick={() => window.open(url, '_blank')} /></div>))}
                {/* Fotos locales pendientes de subir */}
                {localPreviews.map((url, idx) => (
                  <div key={`local-${idx}`} className="material-img" style={{ height: '80px', position: 'relative', border: '2px solid var(--primary-color)' }}>
                    <img src={url} alt="" />
                    <button type="button" onClick={() => handleDeleteLocalImage(idx)} style={{ position: 'absolute', top: 0, right: 0, background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px' }}>✕</button>
                  </div>
                ))}
              </div>
              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} id="wo-cam" style={{ display: 'none' }} />
              <label htmlFor="wo-cam" className="btn-primary" style={{ backgroundColor: 'var(--secondary-color)', display: 'inline-flex', width: 'auto', padding: '12px 24px' }}>📸 CAPTURAR FOTO</label>
              <p style={{ marginTop: '8px', fontSize: '0.7rem' }}>{localPreviews.length > 0 ? `✅ ${localPreviews.length} fotos nuevas capturadas. Se subirán al guardar.` : 'Las fotos se guardan en el dispositivo hasta que presiones Guardar.'}</p>
            </div>
            
            {/* Resto de campos del formulario */}
            <div className="form-group"><label>Cliente</label><input type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required className="form-input" /></div>
            <div className="form-group"><label>Descripción</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required className="form-input" rows={3} /></div>

            {budgetInfo && (
              <div className="form-group status-group-highlight" style={{ backgroundColor: 'rgba(52, 152, 219, 0.03)', borderStyle: 'solid' }}>
                <label style={{ color: 'var(--primary-color)', fontSize: '0.75rem' }}>🛠️ Planificado en Presupuesto</label>
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>MATERIALES:</p>
                  <div className="selected-items-list">
                    {budgetInfo.materials?.map((m, idx) => (<span key={idx} className="item-chip view-mode">{m.description} <span className="chip-qty-view">x{m.quantity}</span></span>))}
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>HERRAMIENTAS:</p>
                  <div className="selected-items-list">
                    {budgetInfo.tools?.map((toolId, idx) => {
                      const toolName = allTools.find(t => t.id === toolId)?.description || 'Desconocida';
                      return <span key={idx} className="tool-chip">{toolName}</span>;
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group"><label>Prioridad</label><select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})} className="form-input"><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option></select></div>
              <div className="form-group"><label>Estado</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="form-input"><option value="PENDIENTE">Pendiente</option><option value="PROCESO">En Proceso</option><option value="FINALIZADO">Finalizado</option></select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Asignar a</label><select value={formData.assigned_to} onChange={e => setFormData({...formData, assigned_to: e.target.value})} className="form-input"><option value="">Sin asignar</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div className="form-group"><label>Entrega Estimada</label><input type="date" value={formData.estimated_end_date} onChange={e => setFormData({...formData, estimated_end_date: e.target.value})} required className="form-input" /></div>
            </div>
            <div className="form-group"><label>Observaciones</label><textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="form-input" rows={2} /></div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/work-orders')}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
            </div>
          </form>

          {currentUser?.role !== 'OPERARIO' && (
            <div className="history-section">
              <header className="history-toggle-header" onClick={() => setShowHistory(!showHistory)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                <h4>📜 Historial de Cambios</h4>
                <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{showHistory ? '▲ Ocultar' : '▼ Ver'}</span>
              </header>
              {showHistory && (
                <div className="history-timeline" style={{ marginTop: '1rem' }}>
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
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkOrdersView;
