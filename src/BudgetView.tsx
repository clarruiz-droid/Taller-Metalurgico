import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Budget, Client, Material, Tool, User } from './types';
import { supabase } from './lib/supabase';
import './Budgets.css';

interface BudgetViewProps {
  onBack: () => void;
  currentUser: User | null;
}

const BudgetView: React.FC<BudgetViewProps> = ({ onBack, currentUser }) => {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Estados de búsqueda y filtro
  const [materialSearch, setMaterialSearch] = useState('');
  const [toolSearch, setToolSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Budget['status']>('ALL');

  const canEditRole = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR';

  const initialFormData = {
    client_id: '',
    validity_days: 15,
    short_description: '',
    long_description: '',
    estimated_value: 0,
    status: 'PENDIENTE' as Budget['status'],
    images: [] as string[],
    materials: [] as { id: string; description: string; quantity: number }[],
    tools: [] as string[]
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes, mRes, tRes] = await Promise.all([
        supabase.from('presupuestos').select('*, clientes(name), profiles:created_by(full_name)').order('created_at', { ascending: false }),
        supabase.from('clientes').select('*').order('name'),
        supabase.from('materiales').select('*').order('description'),
        supabase.from('herramientas').select('*').order('description')
      ]);

      if (bRes.error) {
        console.error('Error cargando presupuestos:', bRes.error);
        // Si el join con profiles falla, intentamos cargar solo los presupuestos sin el join de perfil
        const simpleBRes = await supabase.from('presupuestos').select('*, clientes(name)').order('created_at', { ascending: false });
        if (!simpleBRes.error) {
          setBudgets(simpleBRes.data.map((b: any) => ({ 
            ...b, 
            client_name: b.clientes?.name,
            creator_name: 'Desconocido'
          })) || []);
        } else {
          throw simpleBRes.error;
        }
      } else {
        setBudgets(bRes.data.map((b: any) => ({ 
          ...b, 
          client_name: b.clientes?.name,
          creator_name: b.profiles?.full_name || 'Desconocido'
        })) || []);
      }

      if (!cRes.error) setClients(cRes.data || []);
      if (!mRes.error) setMaterials(mRes.data || []);
      if (!tRes.error) setTools(tRes.data || []);
      
    } catch (err: any) {
      console.error('Error completo en fetchData:', err);
      alert('Error al cargar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditRole) {
      alert('No tienes permisos para realizar esta acción');
      return;
    }
    
    setLoading(true);
    try {
      // Limpiar los datos para asegurar que no enviamos campos extraños
      const dataToSave = {
        client_id: formData.client_id,
        validity_days: formData.validity_days,
        short_description: formData.short_description,
        long_description: formData.long_description,
        estimated_value: formData.estimated_value,
        status: formData.status,
        images: formData.images,
        materials: formData.materials,
        tools: formData.tools,
        created_by: currentUser?.id // Asegurar que usamos el ID del usuario actual
      };

      if (editingBudget) {
        const { error } = await supabase
          .from('presupuestos')
          .update(dataToSave)
          .eq('id', editingBudget.id);
        
        if (error) throw error;
        alert('Presupuesto actualizado con éxito');
      } else {
        const { error, data } = await supabase
          .from('presupuestos')
          .insert([dataToSave])
          .select();
        
        if (error) {
          console.error('Error de Supabase:', error);
          throw new Error(error.message || 'Error desconocido al insertar');
        }
        console.log('Presupuesto creado:', data);
        alert('Presupuesto creado con éxito');
      }
      closeForm();
      await fetchData();
    } catch (error: any) {
      console.error('Error completo:', error);
      alert('Error al guardar: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkOrder = async (budget: Budget) => {
    if (!window.confirm('¿Generar Orden de Trabajo para este presupuesto?')) return;
    
    setLoading(true);
    try {
      // Limpiamos los datos para evitar errores de tipo UUID en Postgres
      const orderToCreate = {
        budget_id: parseInt(String(budget.id), 10), // Forzamos entero
        client_name: budget.client_name || 'Sin Cliente',
        description: budget.short_description,
        status: 'PENDIENTE',
        priority: 'MEDIA',
        assigned_to: null, // Null explícito, nunca cadena vacía
        estimated_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      const { error } = await supabase.from('ordenes_trabajo').insert([orderToCreate]);

      if (error) {
        console.error('Error detallado de Supabase:', error);
        throw error;
      }
      alert('Orden de Trabajo generada con éxito');
      navigate('/work-orders');
    } catch (error: any) {
      alert('Error al generar orden: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!canEditRole) return;
    if (!window.confirm('¿Eliminar este presupuesto permanentemente?')) return;
    
    setLoading(true);
    const { error } = await supabase.from('presupuestos').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    else fetchData();
    setLoading(false);
  };

  const openView = (b: Budget) => {
    setEditingBudget(b);
    setFormData({
      client_id: b.client_id,
      validity_days: b.validity_days,
      short_description: b.short_description,
      long_description: b.long_description || '',
      estimated_value: b.estimated_value,
      status: b.status,
      images: b.images || [],
      materials: b.materials || [],
      tools: b.tools || []
    });
    setIsEditing(false);
    setShowForm(true);
  };

  const closeForm = () => {
    if (showForm && !editingBudget) {
      setShowForm(false);
    } else if (showForm && editingBudget) {
      setShowForm(false);
      setEditingBudget(null);
    } else {
      onBack();
    }
    setIsEditing(false);
    setFormData(initialFormData);
    setMaterialSearch('');
    setToolSearch('');
  };

  const formatOrder = (num: number) => num?.toString().padStart(6, '0') || '000000';

  const filteredMaterials = materials.filter(m => 
    m.description.toLowerCase().includes(materialSearch.toLowerCase())
  );

  const filteredTools = tools.filter(t => 
    t.description.toLowerCase().includes(toolSearch.toLowerCase()) ||
    t.brand.toLowerCase().includes(toolSearch.toLowerCase())
  );

  const currentClient = clients.find(c => c.id === formData.client_id);

  const filteredBudgets = statusFilter === 'ALL' 
    ? budgets 
    : budgets.filter(b => b.status === statusFilter);

  return (
    <div className="inventory-view budget-view-main">
      <header className="view-header">
        <button className="btn-back" onClick={showForm ? closeForm : onBack}>← Volver</button>
        <h3>{showForm ? (editingBudget ? `Presupuesto #${formatOrder(editingBudget.order_number)}` : 'Nuevo Presupuesto') : 'Gestión de Presupuestos'}</h3>
      </header>

      {!showForm ? (
        <>
          {/* Filtros de Estado */}
          <div className="filter-tabs budget-filters">
            <button className={statusFilter === 'ALL' ? 'active' : ''} onClick={() => setStatusFilter('ALL')}>Todos</button>
            <button className={statusFilter === 'PENDIENTE' ? 'active' : ''} onClick={() => setStatusFilter('PENDIENTE')}>Pendiente</button>
            <button className={statusFilter === 'EN_PREPARACION' ? 'active' : ''} onClick={() => setStatusFilter('EN_PREPARACION')}>En Preparación</button>
            <button className={statusFilter === 'ENVIADO' ? 'active' : ''} onClick={() => setStatusFilter('ENVIADO')}>Enviado</button>
            <button className={statusFilter === 'APROBADO' ? 'active' : ''} onClick={() => setStatusFilter('APROBADO')}>Aprobado</button>
            <button className={statusFilter === 'RECHAZADO' ? 'active' : ''} onClick={() => setStatusFilter('RECHAZADO')}>Rechazado</button>
            <button className={statusFilter === 'FINALIZADO' ? 'active' : ''} onClick={() => setStatusFilter('FINALIZADO')}>Finalizado</button>
          </div>

          <div className="budget-list">
            {filteredBudgets.length === 0 && !loading && <p className="empty-msg">No hay presupuestos que coincidan con el filtro.</p>}
            {filteredBudgets.map(b => (
              <div key={b.id} className="material-card budget-card clickable" onClick={() => openView(b)}>
                <div className="budget-info-main">
                  <div className="budget-card-header">
                    <span className="budget-number">#{formatOrder(b.order_number)}</span>
                    <span className={`status-badge status-${b.status.toLowerCase().replace('_', '-')}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h4>{b.short_description}</h4>
                  <div className="budget-meta-list">
                    <p className="client-tag">👤 {b.client_name}</p>
                    {b.created_at && <p className="meta-tag">📅 {new Date(b.created_at).toLocaleDateString()}</p>}
                    <p className="meta-tag">✍️ {b.creator_name}</p>
                  </div>
                </div>
                <div className="budget-status-val">
                  <span className="price-tag">${Number(b.estimated_value).toLocaleString()}</span>
                  {canEditRole && (
                    <button className="btn-delete-small" onClick={(e) => handleDelete(e, b.id)}>🗑</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {canEditRole && <button className="btn-fab" onClick={() => { 
            setEditingBudget(null);
            setFormData(initialFormData);
            setIsEditing(true); 
            setShowForm(true); 
          }}>+</button>}
        </>
      ) : (
        <div className="material-form-container budget-detail-view">
          <div className="form-header-title">
            <h4>{editingBudget ? `Presupuesto #${formatOrder(editingBudget.order_number)}` : 'Nuevo Presupuesto'}</h4>
          </div>
          
          <form className="material-form" onSubmit={handleSave}>
            
            {/* INFO REGISTRO (Siempre visible) */}
            <div className="form-group registration-info-box">
              <div className="meta-info-grid">
                <span>📅 Fecha: {editingBudget?.created_at ? new Date(editingBudget.created_at).toLocaleDateString() : new Date().toLocaleDateString() + ' (Hoy)'}</span>
                <span>✍️ Creador: {editingBudget?.creator_name || currentUser?.name || 'Usuario Actual'}</span>
              </div>
            </div>

            {/* CLIENTE */}
            <div className="form-group">
              <label>Cliente</label>
              {isEditing ? (
                <select 
                  value={formData.client_id} 
                  onChange={e => setFormData({...formData, client_id: e.target.value})}
                  required className="form-input"
                >
                  <option value="">Seleccione cliente...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <div className="read-only-value">👤 {currentClient?.name || 'No seleccionado'}</div>
              )}
            </div>

            {/* DESCRIPCIÓN CORTA */}
            <div className="form-group">
              <label>Descripción Corta</label>
              {isEditing ? (
                <input type="text" value={formData.short_description} onChange={e => setFormData({...formData, short_description: e.target.value})} placeholder="Ej: Reja ventana frente" required className="form-input" />
              ) : (
                <div className="read-only-value highlight">{formData.short_description}</div>
              )}
            </div>

            {/* ESTADO */}
            <div className="form-group status-group-highlight">
              <label>Estado Actual</label>
              {isEditing ? (
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value as Budget['status']})}
                  className="form-input status-select-primary"
                >
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="EN_PREPARACION">EN PREPARACIÓN</option>
                  <option value="ENVIADO">ENVIADO</option>
                  <option value="APROBADO">APROBADO</option>
                  <option value="RECHAZADO">RECHAZADO</option>
                  <option value="FINALIZADO">FINALIZADO</option>
                </select>
              ) : (
                <div className={`read-only-badge status-${formData.status.toLowerCase().replace('_', '-')}`}>
                  {formData.status.replace('_', ' ')}
                </div>
              )}
            </div>

            {/* DESCRIPCIÓN LARGA */}
            <div className="form-group">
              <label>Detalle Técnico</label>
              {isEditing ? (
                <textarea value={formData.long_description} onChange={e => setFormData({...formData, long_description: e.target.value})} className="form-input" rows={4} placeholder="Detalle técnico, medidas, color..."></textarea>
              ) : (
                <div className="read-only-value long-text">{formData.long_description || 'Sin detalle técnico.'}</div>
              )}
            </div>

            {/* MATERIALES */}
            <div className="form-group">
              <label>Materiales</label>
              {isEditing && (
                <>
                  <input type="text" placeholder="🔍 Buscar material..." value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} className="form-input search-input-inline" />
                  <select onChange={e => {
                    const mat = materials.find(m => m.id === e.target.value);
                    if (mat && !formData.materials.find(x => x.id === mat.id)) {
                      setFormData({...formData, materials: [...formData.materials, { id: mat.id, description: mat.description, quantity: 1 }]});
                      setMaterialSearch('');
                    }
                  }} className="form-input" value="">
                    <option value="">Seleccionar material...</option>
                    {filteredMaterials.map(m => <option key={m.id} value={m.id}>{m.description}</option>)}
                  </select>
                </>
              )}
              <div className="selected-items-list">
                {formData.materials.length === 0 && !isEditing && <p className="read-only-placeholder">No se asignaron materiales.</p>}
                {formData.materials.map(m => (
                  <div key={m.id} className={`item-chip ${!isEditing ? 'view-mode' : ''}`}>
                    <span>{m.description}</span>
                    {isEditing ? (
                      <input type="number" step="0.01" value={m.quantity} onChange={e => {
                        const updated = formData.materials.map(x => x.id === m.id ? {...x, quantity: parseFloat(e.target.value)} : x);
                        setFormData({...formData, materials: updated});
                      }} className="chip-qty" />
                    ) : (
                      <span className="chip-qty-view">x {m.quantity}</span>
                    )}
                    {isEditing && <button type="button" onClick={() => setFormData({...formData, materials: formData.materials.filter(x => x.id !== m.id)})} className="btn-remove">✕</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* HERRAMIENTAS */}
            <div className="form-group">
              <label>Herramientas</label>
              {isEditing && (
                <>
                  <input type="text" placeholder="🔍 Buscar herramienta..." value={toolSearch} onChange={e => setToolSearch(e.target.value)} className="form-input search-input-inline" />
                  <select onChange={e => {
                    const tool = tools.find(t => t.id === e.target.value);
                    if (tool && !formData.tools.includes(tool.id)) {
                      setFormData({...formData, tools: [...formData.tools, tool.id]});
                      setToolSearch('');
                    }
                  }} className="form-input" value="">
                    <option value="">Seleccionar herramienta...</option>
                    {filteredTools.map(t => <option key={t.id} value={t.id}>{t.description}</option>)}
                  </select>
                </>
              )}
              <div className="selected-items-list">
                {formData.tools.length === 0 && !isEditing && <p className="read-only-placeholder">No se asignaron herramientas.</p>}
                {formData.tools.map(toolId => {
                  const tool = tools.find(t => t.id === toolId);
                  return (
                    <div key={toolId} className={`item-chip tool-chip ${!isEditing ? 'view-mode' : ''}`}>
                      <span>{tool?.description || 'Herramienta'}</span>
                      {isEditing && <button type="button" onClick={() => setFormData({...formData, tools: formData.tools.filter(id => id !== toolId)})} className="btn-remove">✕</button>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* VALOR Y VALIDEZ */}
            <div className="form-row">
              <div className="form-group">
                <label>Valor Estimado</label>
                {isEditing ? (
                  <input type="number" value={formData.estimated_value} onChange={e => setFormData({...formData, estimated_value: parseFloat(e.target.value)})} className="form-input" />
                ) : (
                  <div className="read-only-value price-highlight">${Number(formData.estimated_value).toLocaleString()}</div>
                )}
              </div>
              <div className="form-group">
                <label>Validez (Días)</label>
                {isEditing ? (
                  <input type="number" value={formData.validity_days} onChange={e => setFormData({...formData, validity_days: parseInt(e.target.value)})} className="form-input" />
                ) : (
                  <div className="read-only-value">{formData.validity_days} días</div>
                )}
              </div>
            </div>

            {/* INFO REGISTRO (Solo lectura) */}
            {!isEditing && editingBudget && (
              <div className="form-group registration-info">
                <label>Información del Registro</label>
                <div className="read-only-value meta-info-grid">
                  <span>📅 Creado: {editingBudget.created_at ? new Date(editingBudget.created_at).toLocaleDateString() : 'N/A'}</span>
                  <span>✍️ Por: {editingBudget.creator_name}</span>
                </div>
              </div>
            )}

            {/* ACCIONES */}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>
                {isEditing && editingBudget ? 'Cancelar Edición' : 'Volver'}
              </button>
              
              {!isEditing && canEditRole && (
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={(e) => { 
                    e.preventDefault(); 
                    setIsEditing(true); 
                  }}
                >
                  ✎ Editar Presupuesto
                </button>
              )}

              {isEditing && canEditRole && (
                <button type="submit" className="btn-primary" disabled={loading}>
                  {editingBudget ? 'Guardar Cambios' : 'Crear Presupuesto'}
                </button>
              )}

              {!isEditing && editingBudget?.status === 'APROBADO' && canEditRole && (
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ backgroundColor: 'var(--secondary-color)', boxShadow: '0 4px 12px rgba(230, 126, 34, 0.3)' }}
                  onClick={() => handleCreateWorkOrder(editingBudget)}
                >
                  ⚙️ Generar Orden de Trabajo
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BudgetView;
