import React, { useState, useEffect } from 'react';
import type { Budget, Client, Material, Tool } from './types';
import { supabase } from './lib/supabase';
import './Budgets.css';

const BudgetView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Estado del formulario
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

  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 600; // Un poco más de calidad para presupuestos
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(b => b ? resolve(b) : reject(), 'image/webp', 0.8);
        }
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const blob = await resizeImage(file);
      const path = `${Math.random()}.webp`;
      const { error } = await supabase.storage.from('presupuestos').upload(path, blob);
      if (error) throw error;
      const { data } = supabase.storage.from('presupuestos').getPublicUrl(path);
      setFormData({ ...formData, images: [...formData.images, data.publicUrl] });
    } catch (err) { alert('Error al subir imagen'); }
    finally { setUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('presupuestos').insert([formData]);
    if (error) alert('Error: ' + error.message);
    else { setShowForm(false); fetchData(); }
    setLoading(false);
  };

  const addMaterial = (mId: string) => {
    const mat = materials.find(m => m.id === mId);
    if (mat && !formData.materials.find(x => x.id === mId)) {
      setFormData({ ...formData, materials: [...formData.materials, { id: mId, description: mat.description, quantity: 1 }] });
    }
  };

  const formatOrder = (num: number) => num.toString().padStart(6, '0');

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
                <div className="budget-number">#{formatOrder(b.order_number)}</div>
                <div className="material-info">
                  <h4>{b.short_description}</h4>
                  <p className="user-id">Cliente: {b.client_name}</p>
                  <span className={`role-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                </div>
                <div className="budget-price">${Number(b.estimated_value).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>
        </>
      ) : (
        <div className="material-form-container">
          <h4>Nuevo Presupuesto</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group">
              <label>Cliente</label>
              <select 
                value={formData.client_id} 
                onChange={e => setFormData({...formData, client_id: e.target.value})}
                required className="form-input"
              >
                <option value="">Seleccione un cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Descripción Corta</label>
              <input type="text" value={formData.short_description} onChange={e => setFormData({...formData, short_description: e.target.value})} placeholder="Ej: Reja para ventana" required className="form-input" />
            </div>

            <div className="form-group">
              <label>Descripción Detallada</label>
              <textarea value={formData.long_description} onChange={e => setFormData({...formData, long_description: e.target.value})} className="form-input" rows={3}></textarea>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Validez (Días)</label>
                <input type="number" value={formData.validity_days} onChange={e => setFormData({...formData, validity_days: parseInt(e.target.value)})} className="form-input" />
              </div>
              <div className="form-group">
                <label>Valor Estimado ($)</label>
                <input type="number" value={formData.estimated_value} onChange={e => setFormData({...formData, estimated_value: parseFloat(e.target.value)})} className="form-input" />
              </div>
            </div>

            <div className="form-group">
              <label>Materiales Necesarios</label>
              <select onChange={e => addMaterial(e.target.value)} className="form-input">
                <option value="">Añadir material...</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.description}</option>)}
              </select>
              <div className="selected-items">
                {formData.materials.map(m => (
                  <div key={m.id} className="selected-item">
                    <span>{m.description}</span>
                    <input type="number" value={m.quantity} onChange={e => {
                      const newMats = formData.materials.map(x => x.id === m.id ? {...x, quantity: parseFloat(e.target.value)} : x);
                      setFormData({...formData, materials: newMats});
                    }} className="qty-input" />
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Imágenes de Referencia</label>
              <input type="file" capture="environment" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="file-input" />
              <div className="image-previews-grid">
                {formData.images.map((img, i) => <img key={i} src={img} className="mini-preview" />)}
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
