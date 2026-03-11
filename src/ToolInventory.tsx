import React, { useState, useEffect } from 'react';
import type { Tool, ToolStatus, User } from './types';
import { supabase } from './lib/supabase';
import { TOOL_STATUS_LABELS } from './types';
import './Inventory.css';

const ToolInventory: React.FC<{ onBack: () => void; currentUser: User | null }> = ({ onBack, currentUser }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [uploading, setUploading] = useState(false);

  const canEditRole = currentUser?.role === 'ADMIN' || currentUser?.role === 'GERENTE' || currentUser?.role === 'SUPERVISOR';

  // Estado del formulario
  const [formData, setFormData] = useState({
    description: '',
    brand: '',
    status: 'OPERATIVA' as ToolStatus,
    image_url: ''
  });

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('herramientas')
      .select('*')
      .order('description', { ascending: true });

    if (!error) setTools(data || []);
    setLoading(false);
  };

  // Función para redimensionar la imagen antes de subirla
  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al procesar imagen'));
          }, 'image/webp', 0.8);
        }
      };
      img.onerror = reject;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const resizedBlob = await resizeImage(file);
      const fileName = `${Math.random()}.webp`;
      const filePath = `${fileName}`;

      // Subir a Supabase Storage (Bucket: herramientas)
      const { error: uploadError } = await supabase.storage
        .from('herramientas')
        .upload(filePath, resizedBlob, { contentType: 'image/webp' });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data } = supabase.storage
        .from('herramientas')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: data.publicUrl });
      // Eliminado alert bloqueante
    } catch (error: any) {
      alert('Error subiendo imagen: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingTool) {
        await supabase.from('herramientas').update(formData).eq('id', editingTool.id);
      } else {
        await supabase.from('herramientas').insert([formData]);
      }
      closeForm();
      await fetchTools();
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta herramienta?')) return;
    await supabase.from('herramientas').delete().eq('id', id);
    await fetchTools();
  };

  const openEdit = (t: Tool) => {
    setEditingTool(t);
    setFormData({
      description: t.description,
      brand: t.brand,
      status: t.status,
      image_url: t.image_url || ''
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTool(null);
    setFormData({ description: '', brand: '', status: 'OPERATIVA', image_url: '' });
  };

  const filteredTools = tools.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'OPERATIVA': return 'status-ok';
      case 'REPARACION': return 'status-warning';
      case 'EXTRAVIADA': return 'status-error';
      default: return '';
    }
  };

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Inventario de Herramientas</h3>
      </header>

      {!showForm ? (
        <>
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Buscar herramienta o marca..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="material-list">
            {filteredTools.map(tool => (
              <div key={tool.id} className="material-card tool-card">
                <div className="material-img">
                  {tool.image_url ? (
                    <img src={tool.image_url} alt={tool.description} />
                  ) : (
                    <div className="img-placeholder">🔧</div>
                  )}
                </div>
                <div className="material-info">
                  <div className="tool-header">
                    <h4>{tool.description}</h4>
                    <span className="tool-brand">{tool.brand}</span>
                  </div>
                  <div className="tool-status-container">
                    <span className={`status-dot ${getStatusColor(tool.status)}`}></span>
                    <span className="status-label">{TOOL_STATUS_LABELS[tool.status]}</span>
                  </div>
                </div>
                <div className="material-actions">
                  {canEditRole && (
                    <>
                      <button className="btn-action" onClick={() => openEdit(tool)}>✎</button>
                      <button className="btn-action btn-delete" onClick={() => handleDelete(tool.id)}>🗑</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {canEditRole && <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>}
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
                  <div className="no-image">🔧 Sin imagen</div>
                )}
              </div>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleFileUpload} 
                disabled={uploading}
                className="file-input"
              />
              {uploading && <p className="uploading-text">Optimizando y subiendo...</p>}
            </div>

            <div className="form-group">
              <label>Descripción / Nombre</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Ej: Taladro de banco" required className="form-input" 
              />
            </div>

            <div className="form-group">
              <label>Marca / Modelo</label>
              <input 
                type="text" 
                value={formData.brand}
                onChange={e => setFormData({...formData, brand: e.target.value})}
                placeholder="Ej: DeWalt" required className="form-input" 
              />
            </div>
            
            <div className="form-group">
              <label>Estado</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as ToolStatus})}
                className="form-input"
              >
                {Object.entries(TOOL_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading || uploading}>
                {loading ? 'Guardando...' : 'Guardar Herramienta'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ToolInventory;
