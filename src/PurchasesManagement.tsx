import React, { useState, useEffect } from 'react';
import type { Purchase, Supplier, Material, PurchaseItem, PurchaseStatus } from './types';
import { supabase } from './lib/supabase';
import { PURCHASE_STATUS_LABELS } from './types';
import './Inventory.css';

const PurchasesManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseStatus>('ALL');
  
  const [formData, setFormData] = useState({
    supplier_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    items: [] as PurchaseItem[],
    observations: '',
    status: 'PAGADA' as PurchaseStatus
  });

  const [itemSearch, setItemSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [pRes, sRes, mRes] = await Promise.all([
      supabase.from('compras').select('*, proveedores(name)').order('purchase_date', { ascending: false }),
      supabase.from('proveedores').select('*').order('name'),
      supabase.from('materiales').select('*').order('description')
    ]);

    if (!pRes.error) {
      setPurchases(pRes.data.map((p: any) => ({
        ...p,
        supplier_name: p.proveedores?.name || 'Desconocido'
      })));
    }
    if (!sRes.error) setSuppliers(sRes.data);
    if (!mRes.error) setMaterials(mRes.data);
    setLoading(false);
  };

  const handleAddItem = (mat: Material) => {
    if (formData.items.find(i => i.material_id === mat.id)) return;
    setFormData({
      ...formData,
      items: [...formData.items, { material_id: mat.id, description: mat.description, quantity: 1, unit_price: 0 }]
    });
    setItemSearch('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) return alert('Agregue al menos un material');
    
    setLoading(true);
    try {
      const total = formData.items.reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0);
      
      // 1. Registrar la compra
      const { error: pError } = await supabase.from('compras').insert([{
        ...formData,
        total_amount: total
      }]);
      if (pError) throw pError;

      // 2. Actualizar stocks (Incrementar)
      for (const item of formData.items) {
        const currentMat = materials.find(m => m.id === item.material_id);
        if (currentMat) {
          const newQty = Number(currentMat.quantity) + Number(item.quantity);
          await supabase.from('materiales').update({ quantity: newQty }).eq('id', item.material_id);
        }
      }

      alert('Compra registrada y stock actualizado');
      setShowForm(false);
      setFormData({ supplier_id: '', purchase_date: new Date().toISOString().split('T')[0], items: [], observations: '' });
      await fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.description.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const filteredPurchases = purchases.filter(p => {
    const matchesSupplier = (p.supplier_name || '').toLowerCase().includes(supplierSearch.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSupplier && matchesStatus;
  });

  const getStatusColor = (status: PurchaseStatus) => {
    switch (status) {
      case 'PAGADA': return '#10b981';
      case 'CTA_CTE': return '#f59e0b';
      case 'PARCIAL': return '#3b82f6';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="inventory-view">
      <header className="view-header">
        <button className="btn-back" onClick={showForm ? () => setShowForm(false) : onBack}>← Volver</button>
        <h3>{showForm ? 'Registrar Compra' : 'Historial de Compras'}</h3>
      </header>

      {!showForm ? (
        <>
          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="🔍 Buscar por proveedor..." 
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="filter-tabs budget-filters" style={{ marginBottom: '1.5rem' }}>
            <button className={`filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`} onClick={() => setStatusFilter('ALL')}>Todas</button>
            <button className={`filter-tab ${statusFilter === 'PAGADA' ? 'active' : ''}`} onClick={() => setStatusFilter('PAGADA')}>Pagadas</button>
            <button className={`filter-tab ${statusFilter === 'CTA_CTE' ? 'active' : ''}`} onClick={() => setStatusFilter('CTA_CTE')}>Cta Cte</button>
            <button className={`filter-tab ${statusFilter === 'PARCIAL' ? 'active' : ''}`} onClick={() => setStatusFilter('PARCIAL')}>Parcial</button>
          </div>

          <div className="material-list">
            {filteredPurchases.length === 0 && !loading && <p className="empty-msg">No hay compras que coincidan con los filtros.</p>}
            {filteredPurchases.map(p => (
              <div key={p.id} className="material-card">
              <div className="material-info">
                <div className="tool-header">
                  <h4>{p.supplier_name}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                    <span className="price-tag">${Number(p.total_amount).toLocaleString()}</span>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(p.status), color: 'white', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                      {PURCHASE_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                </div>
                <p className="user-id">📅 {new Date(p.purchase_date).toLocaleDateString()}</p>
                <div className="selected-items-list" style={{ marginTop: '0.5rem' }}>
                  {p.items.map((item, idx) => (
                    <span key={idx} className="item-chip view-mode">
                      {item.description} <span className="chip-qty-view">x{item.quantity}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>
        </div>
      ) : (
        <div className="material-form-container">
          <form className="material-form" onSubmit={handleSave}>
            <div className="form-group">
              <label>Proveedor</label>
              <select 
                value={formData.supplier_id} 
                onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                required className="form-input"
              >
                <option value="">Seleccione proveedor...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Fecha de Compra</label>
              <input type="date" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} required className="form-input" />
            </div>

            <div className="form-group">
              <label>Estado de Pago</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value as PurchaseStatus})}
                className="form-input"
              >
                <option value="PAGADA">Pagada</option>
                <option value="CTA_CTE">Cuenta Corriente (Pendiente)</option>
                <option value="PARCIAL">Pago Parcial</option>
              </select>
            </div>

            <div className="form-group status-group-highlight">
              <label>Agregar Materiales al Stock</label>
              <input type="text" placeholder="🔍 Buscar material..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="form-input" style={{ marginBottom: '0.5rem' }} />
              {itemSearch && (
                <div className="quick-form" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {filteredMaterials.map(m => (
                    <div key={m.id} className="tool-select-card" onClick={() => handleAddItem(m)}>
                      {m.description} (Stock: {m.quantity})
                    </div>
                  ))}
                </div>
              )}

              <div className="selected-items-list" style={{ marginTop: '1rem' }}>
                {formData.items.map((item, idx) => (
                  <div key={idx} className="material-card" style={{ width: '100%', padding: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <strong>{item.description}</strong>
                      <div className="form-row" style={{ marginTop: '0.5rem' }}>
                        <div className="form-group">
                          <label>Cant.</label>
                          <input type="number" step="0.01" value={item.quantity} onChange={e => {
                            const newItems = [...formData.items];
                            newItems[idx].quantity = Number(e.target.value);
                            setFormData({...formData, items: newItems});
                          }} className="form-input" />
                        </div>
                        <div className="form-group">
                          <label>Precio Unit.</label>
                          <input type="number" step="0.01" value={item.unit_price} onChange={e => {
                            const newItems = [...formData.items];
                            newItems[idx].unit_price = Number(e.target.value);
                            setFormData({...formData, items: newItems});
                          }} className="form-input" />
                        </div>
                      </div>
                    </div>
                    <button type="button" className="btn-action btn-delete" onClick={() => setFormData({...formData, items: formData.items.filter((_, i) => i !== idx)})}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Observaciones</label>
              <textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="form-input" rows={2} />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>Finalizar y Actualizar Stock</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PurchasesManagement;
