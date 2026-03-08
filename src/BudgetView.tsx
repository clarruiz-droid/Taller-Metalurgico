import React, { useState, useEffect } from 'react';
import type { Budget, BudgetStatus } from './types';
import { supabase } from './lib/supabase';
import './Budgets.css';

const BudgetView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Estado para el formulario
  const [formData, setFormData] = useState({
    client_name: '',
    work_description: '',
    labor_cost: 0,
    material_cost: 0
  });

  useEffect(() => {
    fetchBudgets();
  }, []);

  const fetchBudgets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('presupuestos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando presupuestos:', error);
    } else {
      setBudgets(data || []);
    }
    setLoading(false);
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(formData.labor_cost) + Number(formData.material_cost);
    
    const { error } = await supabase
      .from('presupuestos')
      .insert([{
        client_name: formData.client_name,
        work_description: formData.work_description,
        labor_cost: formData.labor_cost,
        total_amount: total,
        status: 'PENDIENTE'
      }]);

    if (error) {
      alert('Error al guardar presupuesto');
    } else {
      setShowForm(false);
      fetchBudgets();
    }
  };

  const getStatusClass = (status: BudgetStatus) => {
    switch(status) {
      case 'APROBADO': return 'status-ok';
      case 'PENDIENTE': return 'status-warning';
      case 'RECHAZADO': return 'status-error';
      default: return '';
    }
  };

  return (
    <div className="budget-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Presupuestos (Reales)</h3>
      </header>

      {!showForm ? (
        <>
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Buscar por cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          {loading ? <div className="loading-state">Cargando...</div> : (
            <div className="budget-list">
              {budgets.filter(b => b.client_name.toLowerCase().includes(searchTerm.toLowerCase())).map(budget => (
                <div key={budget.id} className="budget-card">
                  <div className="budget-card-header">
                    <span className="budget-id"># {budget.id.slice(0, 8)}</span>
                    <span className={`budget-status-badge ${getStatusClass(budget.status)}`}>
                      {budget.status}
                    </span>
                  </div>
                  <h4>{budget.client_name}</h4>
                  <p className="work-desc">{budget.work_description}</p>
                  <div className="budget-footer">
                    <span className="budget-date">📅 {budget.date}</span>
                    <span className="budget-total">${budget.total_amount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>
        </>
      ) : (
        <div className="budget-form-container">
          <h4>Nuevo Presupuesto</h4>
          <form className="budget-form" onSubmit={handleCreateBudget}>
            <div className="form-group">
              <label>Cliente</label>
              <input 
                type="text" 
                placeholder="Nombre completo" 
                required 
                className="form-input" 
                value={formData.client_name}
                onChange={e => setFormData({...formData, client_name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Descripción del Trabajo</label>
              <textarea 
                placeholder="Detalle el trabajo" 
                required 
                className="form-input" 
                rows={3}
                value={formData.work_description}
                onChange={e => setFormData({...formData, work_description: e.target.value})}
              ></textarea>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Mano de Obra ($)</label>
                <input 
                  type="number" 
                  className="form-input"
                  value={formData.labor_cost}
                  onChange={e => setFormData({...formData, labor_cost: Number(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>Materiales ($)</label>
                <input 
                  type="number" 
                  className="form-input"
                  value={formData.material_cost}
                  onChange={e => setFormData({...formData, material_cost: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">Guardar en Nube</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BudgetView;
