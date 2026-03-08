import React, { useState, useEffect } from 'react';
import type { Budget, Client, Material, Tool, User } from './types';
import { supabase } from './lib/supabase';
import './Budgets.css';

interface BudgetViewProps {
  onBack: () => void;
  currentUser: User | null;
}

const BudgetView: React.FC<BudgetViewProps> = ({ onBack, currentUser }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR';

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
  const [newClient, setNewClient] = useState({ name: '', phone: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [bRes, cRes, mRes, tRes] = await Promise.all([
      supabase.from('presupuestos').select('*, clientes(name)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('name'),
      supabase.from('materiales').select('*').order('description'),
      supabase.from('herramientas').select('*').order('description')
    ]);

    if (!bRes.error) setBudgets(bRes.data.map(b => ({ ...b, client_name: b.clientes?.name })) || []);
    if (!cRes.error) setClients(cRes.data || []);
    if (!mRes.error) setMaterials(mRes.data || []);
    if (!tRes.error) setTools(tRes.data || []);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setLoading(true);
    
    try {
      if (editingBudget) {
        const { error } = await supabase
          .from('presupuestos')
          .update(formData)
          .eq('id', editingBudget.id);
        if (error) throw error;
        alert('Presupuesto actualizado');
      } else {
        const { error } = await supabase
          .from('presupuestos')
          .insert([formData]);
        if (error) throw error;
        alert('Presupuesto creado');
      }
      closeForm();
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!canEdit) return;
    if (!window.confirm('¿Eliminar este presupuesto permanentemente?')) return;
    
    setLoading(true);
    const { error } = await supabase.from('presupuestos').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    else fetchData();
    setLoading(false);
  };

  const openEdit = (b: Budget) => {
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
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBudget(null);
    setFormData(initialFormData);
  };

  const toggleTool = (id: string) => {
    const newTools = formData.tools.includes(id) 
      ? formData.tools.filter(t => t !== id) 
      : [...formData.tools, id];
    setFormData({ ...formData, tools: newTools });
  };

  const formatOrder = (num: number) => num?.toString().padStart(6, '0') || '000000';

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Presupuestos</h3>
      </header>

      {!showForm ? (
        <>
          <div className="budget-list">
            {budgets.length === 0 && !loading && <p className="empty-msg">No hay presupuestos registrados.</p>}
            {budgets.map(b => (
              <div key={b.id} className="material-card budget-card clickable" onClick={() => openEdit(b)}>
                <div className="budget-info-main">
                  <span className="budget-number">#{formatOrder(b.order_number)}</span>
                  <h4>{b.short_description}</h4>
                  <p className="client-tag">👤 {b.client_name}</p>
                </div>
                <div className="budget-status-val">
                  <span className={`role-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                  <span className="price-tag">${Number(b.estimated_value).toLocaleString()}</span>
                  {canEdit && (
                    <button className="btn-delete-small" onClick={(e) => handleDelete(e, b.id)}>🗑</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {canEdit && <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>}
        </>
      ) : (
        <div className="material-form-container">
          <h4>{editingBudget ? `Editando Presupuesto #${formatOrder(editingBudget.order_number)}` : 'Nuevo Presupuesto'}</h4>
          <form className="material-form" onSubmit={handleSave}>
            
            <div className="form-group">
              <label>Estado del Presupuesto</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value as Budget['status']})}
                className="form-input"
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="ENVIADO">ENVIADO</option>
                <option value="APROBADO">APROBADO</option>
                <option value="RECHAZADO">RECHAZADO</option>
              </select>
            </div>

            <div className="form-group">
              <label>Cliente</label>
              <div className="input-with-action">
                <select 
                  value={formData.client_id} 
                  onChange={e => setFormData({...formData, client_id: e.target.value})}
                  required className="form-input"
                >
                  <option value="">Seleccione cliente...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Descripción Corta (Título)</label>
              <input type="text" value={formData.short_description} onChange={e => setFormData({...formData, short_description: e.target.value})} placeholder="Ej: Reja ventana frente" required className="form-input" />
            </div>

            <div className="form-group">
              <label>Descripción Larga (Detalle Técnico)</label>
              <textarea value={formData.long_description} onChange={e => setFormData({...formData, long_description: e.target.value})} className="form-input" rows={4} placeholder="Detalle técnico, medidas, color..."></textarea>
            </div>

            <div className="form-group">
              <label>Materiales (Stock)</label>
              <select onChange={e => {
                const mat = materials.find(m => m.id === e.target.value);
                if (mat && !formData.materials.find(x => x.id === mat.id)) {
                  setFormData({...formData, materials: [...formData.materials, { id: mat.id, description: mat.description, quantity: 1 }]});
                }
              }} className="form-input">
                <option value="">Añadir material del inventario...</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.description}</option>)}
              </select>
              <div className="selected-items-list">
                {formData.materials.map(m => (
                  <div key={m.id} className="item-chip">
                    <span>{m.description}</span>
                    <input type="number" value={m.quantity} onChange={e => {
                      const updated = formData.materials.map(x => x.id === m.id ? {...x, quantity: parseFloat(e.target.value)} : x);
                      setFormData({...formData, materials: updated});
                    }} className="chip-qty" />
                    <button type="button" onClick={() => setFormData({...formData, materials: formData.materials.filter(x => x.id !== m.id)})} className="btn-remove">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Herramientas Sugeridas</label>
              <div className="tools-selection-grid">
                {tools.map(t => (
                  <div 
                    key={t.id} 
                    className={`tool-select-card ${formData.tools.includes(t.id) ? 'selected' : ''}`}
                    onClick={() => toggleTool(t.id)}
                  >
                    {t.description}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Valor Estimado ($)</label>
                <input type="number" value={formData.estimated_value} onChange={e => setFormData({...formData, estimated_value: parseFloat(e.target.value)})} className="form-input" placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Días de Validez</label>
                <input type="number" value={formData.validity_days} onChange={e => setFormData({...formData, validity_days: parseInt(e.target.value)})} className="form-input" />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {editingBudget ? 'Guardar Cambios' : 'Crear Presupuesto'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BudgetView;
