import React, { useState } from 'react';
import type { User, UserRole } from './types';
import { ROLE_LABELS } from './types';
import './UserManagement.css';

const MOCK_USERS: User[] = [
  { id: '1', username: 'admin', role: 'ADMIN', name: 'Administrador Principal' },
  { id: '2', username: 'claudio.ruiz', role: 'GERENTE', name: 'Claudio Ruiz' },
  { id: '3', username: 'luis.sanchez', role: 'SUPERVISOR', name: 'Luis Sánchez' },
  { id: '4', username: 'op.garcia', role: 'OPERARIO', name: 'Juan García' },
];

const UserManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', name: '', role: 'OPERARIO' as UserRole });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      ...newUser
    };
    setUsers([...users, user]);
    setShowForm(false);
    setNewUser({ username: '', name: '', role: 'OPERARIO' });
  };

  const getRoleColor = (role: UserRole) => {
    switch(role) {
      case 'ADMIN': return 'role-admin';
      case 'GERENTE': return 'role-gerente';
      case 'SUPERVISOR': return 'role-supervisor';
      case 'OPERARIO': return 'role-operario';
      default: return '';
    }
  };

  return (
    <div className="user-management-view">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Volver</button>
        <h3>Gestión de Personal</h3>
      </header>

      {!showForm ? (
        <>
          <div className="user-list">
            {users.map(user => (
              <div key={user.id} className="user-card">
                <div className="user-avatar">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <h4>{user.name}</h4>
                  <p className="user-id">Legajo: {user.username}</p>
                  <span className={`role-badge ${getRoleColor(user.role)}`}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
                <button className="btn-action">✎</button>
              </div>
            ))}
          </div>
          <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>
        </>
      ) : (
        <div className="user-form-container">
          <h4>Nuevo Usuario / Empleado</h4>
          <form className="user-form" onSubmit={handleAddUser}>
            <div className="form-group">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                value={newUser.name}
                onChange={e => setNewUser({...newUser, name: e.target.value})}
                placeholder="Ej: Pedro González" 
                required 
                className="form-input" 
              />
            </div>
            <div className="form-group">
              <label>Nombre de Usuario / Legajo</label>
              <input 
                type="text" 
                value={newUser.username}
                onChange={e => setNewUser({...newUser, username: e.target.value})}
                placeholder="p.gonzalez" 
                required 
                className="form-input" 
              />
            </div>
            <div className="form-group">
              <label>Rol en la Empresa</label>
              <select 
                value={newUser.role}
                onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                className="form-input"
              >
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
