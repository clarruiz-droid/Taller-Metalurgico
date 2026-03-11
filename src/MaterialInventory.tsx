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
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'PROCESSING' | 'UPLOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');

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
      if (data) { setEditingMaterial(data); setFormData(data); }
    } else if (isNew) {
      setEditingMaterial(null);
      const draft = localStorage.getItem('draft_material');
      if (draft) setFormData(JSON.parse(draft));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isNew || routeId) {
      localStorage.setItem('draft_material', JSON.stringify(formData));
    }
  }, [formData, isNew, routeId]);

  const fetchMaterials = async () => {
    const { data, error } = await supabase.from('materiales').select('*').order('description', { ascending: true });
    if (!error) setMaterials(data || []);
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

      // Intentar redimensionar para ahorrar datos y evitar fallos de memoria
      try {
        const resized = await resizeImage(file);
        dataToUpload = resized;
        extension = 'jpg';
      } catch (e) {
        console.warn('Redimensionamiento fallido, subiendo original:', e);
        dataToUpload = file;
      }

      setUploadStatus('UPLOADING');
      const fileName = `m-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('materiales')
        .upload(fileName, dataToUpload, { 
          contentType: extension === 'jpg' ? 'image/jpeg' : file.type,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('materiales').getPublicUrl(fileName);
      
      const newUrl = data.publicUrl;
      setFormData(prev => {
        const newState = { ...prev, image_url: newUrl };
        localStorage.setItem('draft_material', JSON.stringify(newState));
        return newState;
      });
      
      setUploadStatus('SUCCESS');
      setTimeout(() => setUploadStatus('IDLE'), 3000);

    } catch (error: any) {
      console.error('Error subiendo:', error);
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
      if (editingMaterial) {
        await supabase.from('materiales').update(formData).eq('id', editingMaterial.id);
      } else {
        await supabase.from('materiales').insert([formData]);
      }
      localStorage.removeItem('draft_material');
      navigate('/material-inventory');
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = materials.filter(m => m.description.toLowerCase().includes(searchTerm.toLowerCase()));

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
            {filteredMaterials.map(material => (
              <div key={material.id} className="material-card">
                <div className="material-img">{material.image_url ? <img src={material.image_url} alt={material.description} /> : <div className="img-placeholder">📦</div>}</div>
                <div className="material-info">
                  <h4>{material.description}</h4>
                  <div className="material-stats">
                    <span className={`stock-badge ${Number(material.quantity) <= Number(material.min_stock) ? 'low-stock' : 'ok-stock'}`}>{material.quantity} {material.unit}</span>
                  </div>
                </div>
                <div className="material-actions">{canEditRole && (<><button className="btn-action" onClick={() => navigate(`/material-inventory/edit/${material.id}`)}>✎</button></>)}</div>
              </div>
            ))}
          </div>
          {canEditRole && <button className="btn-fab" onClick={() => navigate('/material-inventory/new')}>+</button>}
        </>
      ) : (
        <div className="material-form-container">
          <h4>{editingMaterial ? 'Editar Material' : 'Nuevo Material'}</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group image-upload-section">
              <label>Imagen del Material</label>
              <div className="preview-container">
                {formData.image_url ? (
                  <img src={formData.image_url} alt="Vista previa" className="form-image-preview" />
                ) : (
                  <div className="no-image">
                    {uploadStatus === 'PROCESSING' ? '📸 Procesando...' : 
                     uploadStatus === 'UPLOADING' ? '☁️ Subiendo...' : 
                     'Sin imagen seleccionada'}
                  </div>
                )}
              </div>
              
              <div className="upload-controls">
                <input 
                  type="file" accept="image/*" capture="environment" 
                  onChange={handleFileUpload} 
                  disabled={uploadStatus === 'PROCESSING' || uploadStatus === 'UPLOADING'} 
                  id="camera-input" style={{ display: 'none' }}
                />
                <label htmlFor="camera-input" className="btn-primary" style={{ backgroundColor: 'var(--secondary-color)', marginBottom: '1rem' }}>
                  {uploadStatus === 'PROCESSING' || uploadStatus === 'UPLOADING' ? 'Cargando...' : '📷 Tomar Foto / Galería'}
                </label>
              </div>

              {uploadStatus === 'SUCCESS' && <p style={{ color: '#10b981', fontSize: '0.8rem', textAlign: 'center' }}>✅ Imagen cargada correctamente</p>}
              {uploadStatus === 'ERROR' && <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>❌ Error: {errorMessage}</p>}
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ej: Perfil C 100x50" required className="form-input" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Unidad</label>
                <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="form-input">
                  <option value="unidades">Unidades</option><option value="kg">kg</option><option value="metros">Metros</option><option value="planchas">Planchas</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cantidad</label>
                <input type="number" step="0.01" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})} required className="form-input" />
              </div>
            </div>
            <div className="form-group">
              <label>Stock Mínimo</label>
              <input type="number" step="0.01" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value)})} required className="form-input" />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/material-inventory')}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading || uploadStatus === 'UPLOADING'}>
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MaterialInventory;
