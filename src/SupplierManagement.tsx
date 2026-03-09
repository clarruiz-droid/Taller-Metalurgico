import React, { useState, useEffect } from 'react';
import type { Supplier } from './types';
import { supabase } from './lib/supabase';
import './Inventory.css';

const SupplierManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    cuit_dni: '',
    rubro: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      console.error('Error cargando proveedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('proveedores')
          .update(formData)
          .eq('id', editingSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('proveedores')
          .insert([formData]);
        if (error) throw error;
      }

      closeForm();
      await fetchSuppliers();
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este proveedor del sistema?')) return;
    setLoading(true);
    const { error } = await supabase.from('proveedores').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    await fetchSuppliers();
    setLoading(false);
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      cuit_dni: s.cuit_dni || '',
      rubro: s.rubro || ''
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSupplier(null);
    setFormData({ name: '', phone: '', email: '', address: '', cuit_dni: '', rubro: '' });
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.rubro && s.rubro.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Gestión de Proveedores</h3>
      </header>

      {!showForm ? (
        <>
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Buscar por nombre o rubro..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          {loading ? (
            <div className="loading-state">Cargando proveedores...</div>
          ) : (
            <div className="material-list">
              {filteredSuppliers.length === 0 ? (
                <p className="empty-msg">No hay proveedores registrados.</p>
              ) : (
                filteredSuppliers.map(supplier => (
                  <div key={supplier.id} className="material-card">
                    <div className="user-avatar" style={{ backgroundColor: 'var(--secondary-color)' }}>
                      {supplier.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="material-info">
                      <div className="tool-header">
                        <h4>{supplier.name}</h4>
                        {supplier.rubro && <span className="tool-brand">{supplier.rubro}</span>}
                      </div>
                      <p className="user-id">{supplier.phone || 'Sin teléfono'}</p>
                      {supplier.cuit_dni && <span className="role-badge role-operario">CUIT: {supplier.cuit_dni}</span>}
                    </div>
                    <div className="material-actions">
                      <button className="btn-action" onClick={() => openEdit(supplier)}>✎</button>
                      <button className="btn-action btn-delete" onClick={() => handleDelete(supplier.id)}>🗑</button>
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
          <h4>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group">
              <label>Nombre / Razón Social</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Ej: Metales Córdoba S.A." required className="form-input" 
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Rubro</label>
                <input 
                  type="text" 
                  value={formData.rubro}
                  onChange={e => setFormData({...formData, rubro: e.target.value})}
                  placeholder="Ej: Insumos de Soldadura" className="form-input" 
                />
              </div>
              <div className="form-group">
                <label>CUIT</label>
                <input 
                  type="text" 
                  value={formData.cuit_dni}
                  onChange={e => setFormData({...formData, cuit_dni: e.target.value})}
                  placeholder="30-12345678-9" className="form-input" 
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Teléfono</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="351 1234567" className="form-input" 
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="ventas@proveedor.com" className="form-input" 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Dirección</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                placeholder="Ej: Polígono Industrial Nave 4" className="form-input" 
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Proveedor'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SupplierManagement;
