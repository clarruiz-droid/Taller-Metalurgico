import React, { useState, useEffect } from 'react';
import type { Tool } from './types';
import { TOOL_STATUS_LABELS } from './types';
import { supabase } from './lib/supabase';
import './Inventory.css';

const ToolInventory: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('herramientas')
      .select('*')
      .order('description', { ascending: true });

    if (error) {
      console.error('Error cargando herramientas:', error);
    } else {
      setTools(data || []);
    }
    setLoading(false);
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
        <h3>Inventario de Herramientas (Supabase)</h3>
      </header>

      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Buscar por nombre o marca..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-input"
        />
      </div>

      {loading ? (
        <div className="loading-state">Conectando...</div>
      ) : (
        <div className="material-list">
          {filteredTools.length === 0 ? (
            <p className="empty-msg">No hay herramientas en la base de datos.</p>
          ) : (
            filteredTools.map(tool => (
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
                  <button className="btn-action">✎</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      <button className="btn-fab" onClick={() => alert('Función de agregar próximamente')}>+</button>
    </div>
  );
};

export default ToolInventory;
