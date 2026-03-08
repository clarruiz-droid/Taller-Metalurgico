import React, { useState, useEffect } from 'react';
import type { Client } from './types';
import { supabase } from './lib/supabase';
import './Inventory.css';

const ClientManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Estado del formulario
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    cuit_dni: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error cargando clientes:', error);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clientes')
          .update(formData)
          .eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([formData]);
        if (error) throw error;
      }

      closeForm();
      await fetchClients();
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este cliente del sistema?')) return;
    setLoading(true);
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) alert('Error al eliminar');
    await fetchClients();
    setLoading(false);
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setFormData({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      cuit_dni: c.cuit_dni || ''
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingClient(null);
    setFormData({ name: '', phone: '', email: '', address: '', cuit_dni: '' });
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cuit_dni && c.cuit_dni.includes(searchTerm))
  );

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Gestión de Clientes</h3>
      </header>

      {!showForm ? (
        <>
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Buscar por nombre o CUIT/DNI..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          {loading ? (
            <div className="loading-state">Cargando clientes...</div>
          ) : (
            <div className="material-list">
              {filteredClients.length === 0 ? (
                <p className="empty-msg">No hay clientes registrados.</p>
              ) : (
                filteredClients.map(client => (
                  <div key={client.id} className="material-card">
                    <div className="user-avatar">{client.name.charAt(0).toUpperCase()}</div>
                    <div className="material-info">
                      <h4>{client.name}</h4>
                      <p className="user-id">{client.phone || 'Sin teléfono'}</p>
                      {client.cuit_dni && <span className="role-badge role-operario">ID: {client.cuit_dni}</span>}
                    </div>
                    <div className="material-actions">
                      <button className="btn-action" onClick={() => openEdit(client)}>✎</button>
                      <button className="btn-action btn-delete" onClick={() => handleDelete(client.id)}>🗑</button>
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
          <h4>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h4>
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group">
              <label>Nombre Completo / Empresa</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Ej: Juan Pérez" required className="form-input" 
              />
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
                <label>CUIT / DNI</label>
                <input 
                  type="text" 
                  value={formData.cuit_dni}
                  onChange={e => setFormData({...formData, cuit_dni: e.target.value})}
                  placeholder="20-12345678-9" className="form-input" 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Dirección</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                placeholder="Ej: Av. Colón 1234" className="form-input" 
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="cliente@ejemplo.com" className="form-input" 
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ClientManagement;
