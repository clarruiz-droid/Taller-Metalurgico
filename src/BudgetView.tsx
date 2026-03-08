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

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR';

  const [formData, setFormData] = useState({
    client_id: '',
    validity_days: 15,
    short_description: '',
    long_description: '',
    estimated_value: 0,
    status: 'PENDIENTE' as Budget['status'],
    images: [] as string[],
    materials: [] as { id: string; description: string; quantity: number }[],
    tools: [] as string[]
  });

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

  const handleQuickClient = async () => {
    if (!newClient.name) return;
    const { data, error } = await supabase.from('clientes').insert([newClient]).select();
    if (!error && data) {
      setClients([...clients, data[0]]);
      setFormData({ ...formData, client_id: data[0].id });
      setShowClientForm(false);
      setNewClient({ name: '', phone: '' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setLoading(true);
    const { error } = await supabase.from('presupuestos').insert([formData]);
    if (error) alert('Error: ' + error.message);
    else { setShowForm(false); fetchData(); }
    setLoading(false);
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
            {budgets.map(b => (
              <div key={b.id} className="material-card budget-card">
                <div className="budget-info-main">
                  <span className="budget-number">#{formatOrder(b.order_number)}</span>
                  <h4>{b.short_description}</h4>
                  <p className="client-tag">👤 {b.client_name}</p>
                </div>
                <div className="budget-status-val">
                  <span className={`role-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                  <span className="price-tag">${Number(b.estimated_value).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          {canEdit && <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>}
        </>
      ) : (
        <div className="material-form-container">
          <h4>Nuevo Presupuesto</h4>
          <form className="material-form" onSubmit={handleSave}>
            
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
                <button type="button" className="btn-small" onClick={() => setShowClientForm(!showClientForm)}>
                  {showClientForm ? '✕' : '+'}
                </button>
              </div>
              
              {showClientForm && (
                <div className="quick-form">
                  <input type="text" placeholder="Nombre" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="form-input" />
                  <input type="text" placeholder="Teléfono" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="form-input" />
                  <button type="button" onClick={handleQuickClient} className="btn-primary-small">Crear Cliente</button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Descripción Corta (Título)</label>
              <input type="text" value={formData.short_description} onChange={e => setFormData({...formData, short_description: e.target.value})} placeholder="Ej: Reja ventana frente" required className="form-input" />
            </div>

            <div className="form-group">
              <label>Descripción Larga (Detalle)</label>
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
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>Guardar Presupuesto</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BudgetView;
