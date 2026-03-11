import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Tool, ToolStatus, User } from './types';
import { supabase } from './lib/supabase';
import { TOOL_STATUS_LABELS } from './types';
import { saveLocalImage, getLocalImage, deleteLocalImage } from './lib/localDb';
import './Inventory.css';

const ToolInventory: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = window.location.pathname.endsWith('/new');

  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [localPreview, setLocalPreview] = useState<string>('');

  const canEditRole = currentUser?.role === 'ADMIN' || currentUser?.role === 'GERENTE' || currentUser?.role === 'SUPERVISOR';

  const [formData, setFormData] = useState({
    description: '',
    brand: '',
    status: 'OPERATIVA' as ToolStatus,
    image_url: ''
  });

  useEffect(() => {
    init();
  }, [routeId, isNew]);

  const init = async () => {
    setLoading(true);
    await fetchTools();
    if (routeId) {
      const { data } = await supabase.from('herramientas').select('*').eq('id', routeId).single();
      if (data) {
        setEditingTool(data);
        const draft = localStorage.getItem(`draft_tool_${routeId}`);
        if (draft) setFormData(JSON.parse(draft));
        else setFormData(data);
      }
    } else if (isNew) {
      setEditingTool(null);
      const draft = localStorage.getItem('draft_tool_new');
      if (draft) setFormData(JSON.parse(draft));
    }

    const key = routeId ? `tool_${routeId}` : 'tool_new';
    const blob = await getLocalImage(key);
    if (blob) setLocalPreview(URL.createObjectURL(blob));

    setLoading(false);
  };

  useEffect(() => {
    const key = routeId ? `draft_tool_${routeId}` : 'draft_tool_new';
    if (isNew || routeId) {
      localStorage.setItem(key, JSON.stringify(formData));
    }
  }, [formData, isNew, routeId]);

  const fetchTools = async () => {
    const { data, error } = await supabase.from('herramientas').select('*').order('description', { ascending: true });
    if (!error) setTools(data || []);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const key = routeId ? `tool_${routeId}` : 'tool_new';
      await saveLocalImage(key, file);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(URL.createObjectURL(file));
    } catch (error: any) {
      alert('Error local: ' + error.message);
    }
  };

  const uploadToSupabase = async (file: Blob, id: string): Promise<string> => {
    const fileName = `tool-${id}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('presupuestos').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('presupuestos').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const key = routeId ? `tool_${routeId}` : 'tool_new';
      const localBlob = await getLocalImage(key);
      let finalImageUrl = formData.image_url;

      if (localBlob) {
        finalImageUrl = await uploadToSupabase(localBlob, routeId || 'new');
      }

      const dataToSave = { ...formData, image_url: finalImageUrl };

      if (editingTool) {
        await supabase.from('herramientas').update(dataToSave).eq('id', editingTool.id);
      } else {
        await supabase.from('herramientas').insert([dataToSave]);
      }

      await deleteLocalImage(key);
      localStorage.removeItem(isNew ? 'draft_tool_new' : `draft_tool_${routeId}`);
      navigate('/tools');
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTools = tools.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.brand.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>← Volver</button>
        <h3>Inventario de Herramientas</h3>
      </header>

      {!routeId && !isNew ? (
        <>
          <div className="search-bar">
            <input type="text" placeholder="Buscar herramienta..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input" />
          </div>
          <div className="material-list">
            {filteredTools.map(tool => (
              <div key={tool.id} className="material-card">
                <div className="material-img">{tool.image_url ? <img src={tool.image_url} alt="" /> : <div className="img-placeholder">🔧</div>}</div>
                <div className="material-info"><h4>{tool.description}</h4><span className="tool-brand">{tool.brand}</span></div>
                <div className="material-actions">{canEditRole && <button className="btn-action" onClick={() => navigate(`/tools/edit/${tool.id}`)}>✎</button>}</div>
              </div>
            ))}
          </div>
          {canEditRole && <button className="btn-fab" onClick={() => navigate('/tools/new')}>+</button>}
        </>
      ) : (
        <div className="material-form-container">
          <h4>{editingTool ? 'Editar' : 'Nueva'} Herramienta</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group status-group-highlight" style={{ textAlign: 'center' }}>
              <div className="preview-container" style={{ margin: '0 auto 1rem' }}>
                {(localPreview || formData.image_url) ? <img src={localPreview || formData.image_url} alt="" className="form-image-preview" /> : <div className="no-image">Cámara Lista</div>}
              </div>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} id="cam-tool" style={{ display: 'none' }} />
              <label htmlFor="cam-tool" className="btn-primary" style={{ backgroundColor: 'var(--secondary-color)', display: 'inline-flex', width: 'auto', padding: '15px 30px' }}>📸 CAPTURAR FOTO</label>
              <p style={{ marginTop: '10px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{localPreview ? '✅ Imagen guardada localmente' : 'La foto se subirá al guardar'}</p>
            </div>
            <div className="form-group"><label>Descripción</label><input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required className="form-input" /></div>
            <div className="form-group"><label>Marca</label><input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} required className="form-input" /></div>
            <div className="form-group"><label>Estado</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as ToolStatus})} className="form-input">{Object.entries(TOOL_STATUS_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}</select></div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/tools')}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ToolInventory;
