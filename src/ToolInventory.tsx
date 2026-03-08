import React, { useState, useEffect } from 'react';
import type { Tool, ToolStatus } from './types';
import { TOOL_STATUS_LABELS } from './types';
import { supabase } from './lib/supabase';
import './Inventory.css';

const ToolInventory: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);

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

    if (error) {
      console.error('Error cargando herramientas:', error);
    } else {
      setTools(data || []);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingTool) {
        // ACTUALIZAR
        const { error } = await supabase
          .from('herramientas')
          .update(formData)
          .eq('id', editingTool.id);
        if (error) throw error;
      } else {
        // CREAR NUEVO
        const { error } = await supabase
          .from('herramientas')
          .insert([formData]);
        if (error) throw error;
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
    if (!window.confirm('¿Eliminar esta herramienta del sistema?')) return;
    setLoading(true);
    const { error } = await supabase.from('herramientas').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    await fetchTools();
    setLoading(false);
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

          {loading ? (
            <div className="loading-state">Cargando herramientas...</div>
          ) : (
            <div className="material-list">
              {filteredTools.length === 0 ? (
                <p className="empty-msg">No hay herramientas registradas.</p>
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
                      <button className="btn-action" onClick={() => openEdit(tool)}>✎</button>
                      <button className="btn-action btn-delete" onClick={() => handleDelete(tool.id)}>🗑</button>
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
          <h4>{editingTool ? 'Editar Herramienta' : 'Nueva Herramienta'}</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group">
              <label>Descripción / Nombre</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Ej: Amoladora de mano" required className="form-input" 
              />
            </div>

            <div className="form-group">
              <label>Marca / Modelo</label>
              <input 
                type="text" 
                value={formData.brand}
                onChange={e => setFormData({...formData, brand: e.target.value})}
                placeholder="Ej: Makita" required className="form-input" 
              />
            </div>
            
            <div className="form-group">
              <label>Estado de la Herramienta</label>
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
              <button type="submit" className="btn-primary" disabled={loading}>
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
