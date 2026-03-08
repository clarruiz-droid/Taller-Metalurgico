import React, { useState, useEffect } from 'react';
import type { Material } from './types';
import { supabase } from './lib/supabase';
import './Inventory.css';

const MaterialInventory: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Cargar materiales desde Supabase
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
      alert('Error al conectar con la base de datos');
    } else {
      setMaterials(data || []);
    }
    setLoading(false);
  };

  const filteredMaterials = materials.filter(m => 
    m.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Stock de Materiales (Real)</h3>
      </header>

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
        <div className="loading-state">Conectando con Supabase...</div>
      ) : (
        <div className="material-list">
          {filteredMaterials.length === 0 ? (
            <p className="empty-msg">No hay materiales registrados.</p>
          ) : (
            filteredMaterials.map(material => (
              <div key={material.id} className="material-card">
                <div className="material-img">
                  {material.imageUrl ? (
                    <img src={material.imageUrl} alt={material.description} />
                  ) : (
                    <div className="img-placeholder">📦</div>
                  )}
                </div>
                <div className="material-info">
                  <h4>{material.description}</h4>
                  <div className="material-stats">
                    <span className={`stock-badge ${material.quantity <= material.minStock ? 'low-stock' : 'ok-stock'}`}>
                      {material.quantity} {material.unit}
                    </span>
                    <span className="min-stock-text">Mín: {material.minStock}</span>
                  </div>
                </div>
                <div className="material-actions">
                  <button className="btn-action">✎</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      <button className="btn-fab" onClick={() => alert('Función para añadir material próximamente')}>+</button>
    </div>
  );
};

export default MaterialInventory;
