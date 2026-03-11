import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Material, User } from './types';
import { supabase } from './lib/supabase';
import './Inventory.css';

const MaterialInventory: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = window.location.pathname.endsWith('/new');

  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [uploading, setUploading] = useState(false);
  const [debugLog, setDebugLog] = useState('');

  const canEditRole = currentUser?.role === 'ADMIN' || currentUser?.role === 'GERENTE' || currentUser?.role === 'SUPERVISOR';

  const [formData, setFormData] = useState({
    description: '',
    unit: 'unidades',
    quantity: 0,
    min_stock: 0,
    image_url: ''
  });

  useEffect(() => {
    init();
  }, [routeId, isNew]);

  const init = async () => {
    setLoading(true);
    await fetchMaterials();
    if (routeId) {
      const { data } = await supabase.from('materiales').select('*').eq('id', routeId).single();
      if (data) {
        setEditingMaterial(data);
        // Priorizar el borrador local si existe (para recuperar fotos tras refresco)
        const draft = localStorage.getItem(`draft_mat_${routeId}`);
        if (draft) setFormData(JSON.parse(draft));
        else setFormData(data);
      }
    } else if (isNew) {
      setEditingMaterial(null);
      const draft = localStorage.getItem('draft_mat_new');
      if (draft) setFormData(JSON.parse(draft));
    }
    setLoading(false);
  };

  useEffect(() => {
    const key = routeId ? `draft_mat_${routeId}` : 'draft_mat_new';
    if (isNew || routeId) {
      localStorage.setItem(key, JSON.stringify(formData));
    }
  }, [formData, isNew, routeId]);

  const fetchMaterials = async () => {
    const { data, error } = await supabase.from('materiales').select('*').order('description', { ascending: true });
    if (!error) setMaterials(data || []);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setDebugLog('⏳ Procesando archivo...');
      
      const fileName = `mat-${Date.now()}-${Math.floor(Math.random()*1000)}.jpg`;

      setDebugLog('☁️ Subiendo a la nube...');
      const { error: uploadError } = await supabase.storage
        .from('presupuestos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('presupuestos').getPublicUrl(fileName);
      
      if (data?.publicUrl) {
        setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
        setDebugLog('✅ Imagen cargada correctamente');
      } else {
        throw new Error('No se generó la URL pública');
      }

    } catch (error: any) {
      console.error('Error:', error);
      setDebugLog('❌ Error: ' + (error.message || 'Fallo de conexión'));
      alert('Error al cargar: ' + error.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingMaterial) {
        await supabase.from('materiales').update(formData).eq('id', editingMaterial.id);
      } else {
        await supabase.from('materiales').insert([formData]);
      }
      localStorage.removeItem(routeId ? `draft_mat_${routeId}` : 'draft_mat_new');
      navigate('/material-inventory');
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar material?')) return;
    await supabase.from('materiales').delete().eq('id', id);
    fetchMaterials();
  };

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>← Volver</button>
        <h3>Inventario de Materiales</h3>
      </header>

      {!routeId && !isNew ? (
        <>
          <div className="search-bar">
            <input type="text" placeholder="Buscar material..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input" />
          </div>
          <div className="material-list">
            {materials.filter(m => m.description.toLowerCase().includes(searchTerm.toLowerCase())).map(m => (
              <div key={m.id} className="material-card">
                <div className="material-img">{m.image_url ? <img src={m.image_url} alt="" /> : <div className="img-placeholder">📦</div>}</div>
                <div className="material-info"><h4>{m.description}</h4><span className={`stock-badge ${Number(m.quantity) <= Number(m.min_stock) ? 'low-stock' : 'ok-stock'}`}>{m.quantity} {m.unit}</span></div>
                <div className="material-actions">{canEditRole && <button className="btn-action" onClick={() => navigate(`/material-inventory/edit/${m.id}`)}>✎</button>}</div>
              </div>
            ))}
          </div>
          {canEditRole && <button className="btn-fab" onClick={() => navigate('/material-inventory/new')}>+</button>}
        </>
      ) : (
        <div className="material-form-container">
          <h4>{editingMaterial ? 'Editar Material' : 'Nuevo Material'}</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group status-group-highlight" style={{ textAlign: 'center' }}>
              <div className="preview-container" style={{ margin: '0 auto 1rem' }}>
                {formData.image_url ? <img src={formData.image_url} alt="" className="form-image-preview" /> : <div className="no-image">Cámara Lista</div>}
              </div>
              
              <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} id="cam-mat" style={{ display: 'none' }} disabled={uploading} />
              <label htmlFor="cam-mat" className="btn-primary" style={{ backgroundColor: 'var(--secondary-color)', display: 'inline-flex', width: 'auto', padding: '15px 30px' }}>
                {uploading ? '⏳ SUBIENDO...' : '📸 USAR CÁMARA'}
              </label>
              
              {debugLog && <p style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: 'bold', color: debugLog.includes('❌') ? '#ef4444' : '#3498db' }}>{debugLog}</p>}
            </div>

            <div className="form-group"><label>Descripción</label><input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required className="form-input" /></div>
            <div className="form-row">
              <div className="form-group"><label>Unidad</label><select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="form-input"><option value="unidades">Unidades</option><option value="kg">kg</option><option value="metros">Metros</option><option value="planchas">Planchas</option></select></div>
              <div className="form-group"><label>Cantidad</label><input type="number" step="0.01" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})} required className="form-input" /></div>
            </div>
            <div className="form-group"><label>Stock Mínimo</label><input type="number" step="0.01" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value)})} required className="form-input" /></div>
            
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => { localStorage.removeItem(routeId ? `draft_mat_${routeId}` : 'draft_mat_new'); navigate('/material-inventory'); }}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading || uploading}>Guardar Cambios</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MaterialInventory;
