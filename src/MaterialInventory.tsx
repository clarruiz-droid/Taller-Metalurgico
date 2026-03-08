import React, { useState, useEffect } from 'react';
import type { Material } from './types';
import { supabase } from './lib/supabase';
import './Inventory.css';

const MaterialInventory: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [uploading, setUploading] = useState(false);

  // Estado del formulario
  const [formData, setFormData] = useState({
    description: '',
    unit: 'unidades',
    quantity: 0,
    min_stock: 0,
    image_url: ''
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('materiales')
      .select('*')
      .order('description', { ascending: true });

    if (!error) setMaterials(data || []);
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
          }, 'image/webp', 0.8); // Formato WebP optimizado al 80%
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
      
      // REDIMENSIONAR IMAGEN
      const resizedBlob = await resizeImage(file);
      const fileName = `${Math.random()}.webp`;
      const filePath = `${fileName}`;

      // Subir a Supabase Storage (Bucket: materiales)
      const { error: uploadError } = await supabase.storage
        .from('materiales')
        .upload(filePath, resizedBlob, { contentType: 'image/webp' });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data } = supabase.storage
        .from('materiales')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: data.publicUrl });
      alert('Imagen optimizada y subida');
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
      if (editingMaterial) {
        await supabase.from('materiales').update(formData).eq('id', editingMaterial.id);
      } else {
        await supabase.from('materiales').insert([formData]);
      }
      closeForm();
      await fetchMaterials();
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este material?')) return;
    await supabase.from('materiales').delete().eq('id', id);
    await fetchMaterials();
  };

  const openEdit = (m: Material) => {
    setEditingMaterial(m);
    setFormData({
      description: m.description,
      unit: m.unit,
      quantity: m.quantity,
      min_stock: m.min_stock,
      image_url: m.image_url || ''
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingMaterial(null);
    setFormData({ description: '', unit: 'unidades', quantity: 0, min_stock: 0, image_url: '' });
  };

  const filteredMaterials = materials.filter(m => 
    m.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Inventario de Materiales</h3>
      </header>

      {!showForm ? (
        <>
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Buscar material..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="material-list">
            {filteredMaterials.map(material => (
              <div key={material.id} className="material-card">
                <div className="material-img">
                  {material.image_url ? (
                    <img src={material.image_url} alt={material.description} />
                  ) : (
                    <div className="img-placeholder">📦</div>
                  )}
                </div>
                <div className="material-info">
                  <h4>{material.description}</h4>
                  <div className="material-stats">
                    <span className={`stock-badge ${Number(material.quantity) <= Number(material.min_stock) ? 'low-stock' : 'ok-stock'}`}>
                      {material.quantity} {material.unit}
                    </span>
                  </div>
                </div>
                <div className="material-actions">
                  <button className="btn-action" onClick={() => openEdit(material)}>✎</button>
                  <button className="btn-action btn-delete" onClick={() => handleDelete(material.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>
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
                  <div className="no-image">Sin imagen seleccionada</div>
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
              <label>Descripción</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Ej: Perfil C 100x50" required className="form-input" 
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Unidad</label>
                <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="form-input">
                  <option value="unidades">Unidades</option>
                  <option value="kg">kg</option>
                  <option value="metros">Metros</option>
                  <option value="planchas">Planchas</option>
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
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading || uploading}>
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
