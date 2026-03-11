import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Tool, ToolStatus, User } from './types';
import { supabase } from './lib/supabase';
import { TOOL_STATUS_LABELS } from './types';
import './Inventory.css';

const ToolInventory: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = window.location.pathname.endsWith('/new');

  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'PROCESSING' | 'UPLOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');

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
      if (data) { setEditingTool(data); setFormData(data); }
    } else if (isNew) {
      setEditingTool(null);
      const draft = localStorage.getItem('draft_tool');
      if (draft) setFormData(JSON.parse(draft));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isNew || routeId) {
      localStorage.setItem('draft_tool', JSON.stringify(formData));
    }
  }, [formData, isNew, routeId]);

  const fetchTools = async () => {
    const { data, error } = await supabase.from('herramientas').select('*').order('description', { ascending: true });
    if (!error) setTools(data || []);
  };

  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Error en canvas'));
            }, 'image/jpeg', 0.7);
          }
        };
        img.onerror = () => reject(new Error('Error cargando imagen'));
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus('PROCESSING');
      setErrorMessage('');
      
      let dataToUpload: Blob | File = file;
      let extension = file.name.split('.').pop() || 'jpg';

      try {
        const resized = await resizeImage(file);
        dataToUpload = resized;
        extension = 'jpg';
      } catch (e) {
        console.warn('Subiendo original:', e);
        dataToUpload = file;
      }

      setUploadStatus('UPLOADING');
      const fileName = `t-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('herramientas')
        .upload(fileName, dataToUpload, { 
          contentType: extension === 'jpg' ? 'image/jpeg' : file.type,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('herramientas').getPublicUrl(fileName);
      
      const newUrl = data.publicUrl;
      setFormData(prev => {
        const newState = { ...prev, image_url: newUrl };
        localStorage.setItem('draft_tool', JSON.stringify(newState));
        return newState;
      });
      
      setUploadStatus('SUCCESS');
      setTimeout(() => setUploadStatus('IDLE'), 3000);

    } catch (error: any) {
      console.error('Error:', error);
      setUploadStatus('ERROR');
      setErrorMessage(error.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingTool) { await supabase.from('herramientas').update(formData).eq('id', editingTool.id); }
      else { await supabase.from('herramientas').insert([formData]); }
      localStorage.removeItem('draft_tool');
      navigate('/tools');
    } catch (error: any) { alert('Error: ' + error.message); }
    finally { setLoading(false); }
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
            <input type="text" placeholder="Buscar herramienta o marca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input" />
          </div>
          <div className="material-list">
            {filteredTools.map(tool => (
              <div key={tool.id} className="material-card">
                <div className="material-img">{tool.image_url ? <img src={tool.image_url} alt={tool.description} /> : <div className="img-placeholder">🔧</div>}</div>
                <div className="material-info">
                  <div className="tool-header"><h4>{tool.description}</h4><span className="tool-brand">{tool.brand}</span></div>
                  <div className="tool-status-container"><span className="status-label">{TOOL_STATUS_LABELS[tool.status]}</span></div>
                </div>
                <div className="material-actions">{canEditRole && (<><button className="btn-action" onClick={() => navigate(`/tools/edit/${tool.id}`)}>✎</button></>)}</div>
              </div>
            ))}
          </div>
          {canEditRole && <button className="btn-fab" onClick={() => navigate('/tools/new')}>+</button>}
        </>
      ) : (
        <div className="material-form-container">
          <h4>{editingTool ? 'Editar Herramienta' : 'Nueva Herramienta'}</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group image-upload-section">
              <label>Imagen de la Herramienta</label>
              <div className="preview-container">
                {formData.image_url ? (
                  <img src={formData.image_url} alt="Vista previa" className="form-image-preview" />
                ) : (
                  <div className="no-image">
                    {uploadStatus === 'PROCESSING' ? '📸 Procesando...' : 
                     uploadStatus === 'UPLOADING' ? '☁️ Subiendo...' : 
                     '🔧 Sin imagen'}
                  </div>
                )}
              </div>
              
              <div className="upload-controls">
                <input 
                  type="file" accept="image/*" capture="environment" 
                  onChange={handleFileUpload} 
                  disabled={uploadStatus === 'PROCESSING' || uploadStatus === 'UPLOADING'} 
                  id="tool-camera-input" style={{ display: 'none' }}
                />
                <label htmlFor="tool-camera-input" className="btn-primary" style={{ backgroundColor: 'var(--secondary-color)', marginBottom: '1rem' }}>
                  {uploadStatus === 'PROCESSING' || uploadStatus === 'UPLOADING' ? 'Cargando...' : '📷 Tomar Foto / Galería'}
                </label>
              </div>

              {uploadStatus === 'SUCCESS' && <p style={{ color: '#10b981', fontSize: '0.8rem', textAlign: 'center' }}>✅ Imagen cargada</p>}
              {uploadStatus === 'ERROR' && <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>❌ Error: {errorMessage}</p>}
            </div>

            <div className="form-group"><label>Descripción / Nombre</label><input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ej: Taladro de banco" required className="form-input" /></div>
            <div className="form-group"><label>Marca / Modelo</label><input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="Ej: DeWalt" required className="form-input" /></div>
            <div className="form-group"><label>Estado</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as ToolStatus})} className="form-input">{Object.entries(TOOL_STATUS_LABELS).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}</select></div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/tools')}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading || uploadStatus === 'UPLOADING'}>Guardar Cambios</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ToolInventory;
