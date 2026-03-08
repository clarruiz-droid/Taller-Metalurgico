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

    if (error) {
      console.error('Error cargando materiales:', error);
    } else {
      setMaterials(data || []);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingMaterial) {
        // ACTUALIZAR
        const { error } = await supabase
          .from('materiales')
          .update(formData)
          .eq('id', editingMaterial.id);
        if (error) throw error;
      } else {
        // CREAR NUEVO
        const { error } = await supabase
          .from('materiales')
          .insert([formData]);
        if (error) throw error;
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
    if (!window.confirm('¿Eliminar este material del inventario?')) return;
    setLoading(true);
    const { error } = await supabase.from('materiales').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    await fetchMaterials();
    setLoading(false);
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

          {loading ? (
            <div className="loading-state">Cargando inventario...</div>
          ) : (
            <div className="material-list">
              {filteredMaterials.length === 0 ? (
                <p className="empty-msg">No hay materiales que coincidan con la búsqueda.</p>
              ) : (
                filteredMaterials.map(material => (
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
                        <span className="min-stock-text">Mín: {material.min_stock}</span>
                      </div>
                    </div>
                    <div className="material-actions">
                      <button className="btn-action" onClick={() => openEdit(material)}>✎</button>
                      <button className="btn-action btn-delete" onClick={() => handleDelete(material.id)}>🗑</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>
        </>
      ) : (
        <div className="material-form-container">
          <h4>{editingMaterial ? 'Editar Material' : 'Nuevo Material'}</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group">
              <label>Descripción del Material</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Ej: Chapa 18 lisa" required className="form-input" 
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Unidad</label>
                <select 
                  value={formData.unit}
                  onChange={e => setFormData({...formData, unit: e.target.value})}
                  className="form-input"
                >
                  <option value="unidades">Unidades</option>
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="metros">Metros (m)</option>
                  <option value="planchas">Planchas</option>
                  <option value="litros">Litros</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cantidad Actual</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})}
                  required className="form-input" 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Stock Mínimo (Alerta)</label>
              <input 
                type="number" 
                step="0.01"
                value={formData.min_stock}
                onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value)})}
                required className="form-input" 
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Material'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MaterialInventory;
