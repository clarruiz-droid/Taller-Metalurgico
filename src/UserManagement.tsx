import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { User, UserRole } from './types';
import { ROLE_LABELS } from './types';
import { supabase } from './lib/supabase';
import './UserManagement.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const UserManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Estado para NUEVO usuario
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'OPERARIO' as UserRole });
  
  // Estado para EDITAR usuario
  const [editData, setEditData] = useState({ name: '', role: 'OPERARIO' as UserRole });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (!error) {
      const mappedUsers: User[] = (data || []).map(profile => ({
        id: profile.id,
        username: profile.id.substring(0, 8),
        name: profile.full_name || 'Sin Nombre',
        role: profile.role as UserRole
      }));
      setUsers(mappedUsers);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const virtualEmail = `${newUser.username.trim().toLowerCase()}@taller.com`;

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: virtualEmail,
        password: newUser.password,
        options: { data: { full_name: newUser.name } }
      });

      if (authError) throw authError;

      if (authData.user) {
        await supabase.from('profiles').upsert({
          id: authData.user.id,
          full_name: newUser.name,
          role: newUser.role,
          updated_at: new Date().toISOString()
        });
      }

      alert('Usuario creado con éxito');
      closeForm();
      await fetchUsers();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editData.name, role: editData.role })
      .eq('id', editingUser.id);

    if (error) {
      alert('Error al actualizar');
    } else {
      closeForm();
      await fetchUsers();
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Eliminar acceso de este usuario?')) return;
    setLoading(true);
    await supabase.from('profiles').delete().eq('id', userId);
    await fetchUsers();
    setLoading(false);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditData({ name: user.name, role: user.role });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setNewUser({ username: '', password: '', name: '', role: 'OPERARIO' });
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
                <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                <div className="user-details">
                  <h4>{user.name}</h4>
                  <span className={`role-badge ${getRoleColor(user.role)}`}>{ROLE_LABELS[user.role]}</span>
                </div>
                <div className="user-card-actions">
                  <button className="btn-action" onClick={() => openEdit(user)}>✎</button>
                  <button className="btn-action btn-delete" onClick={() => handleDeleteUser(user.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-fab" onClick={() => setShowForm(true)}>+</button>
        </>
      ) : (
        <div className="user-form-container">
          <h4>{editingUser ? 'Editar Empleado' : 'Nuevo Empleado'}</h4>
          <form className="user-form" onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
            <div className="form-group">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                value={editingUser ? editData.name : newUser.name}
                onChange={e => editingUser 
                  ? setEditData({...editData, name: e.target.value}) 
                  : setNewUser({...newUser, name: e.target.value})}
                placeholder="Ej: Pedro González" required className="form-input" 
              />
            </div>
            
            {!editingUser && (
              <>
                <div className="form-group">
                  <label>Usuario (Legajo)</label>
                  <input 
                    type="text" 
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                    placeholder="p.gonzalez" required className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>Contraseña Inicial</label>
                  <input 
                    type="password" 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Min. 6 caracteres" required className="form-input" 
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label>Rol Asignado</label>
              <select 
                value={editingUser ? editData.role : newUser.role}
                onChange={e => editingUser
                  ? setEditData({...editData, role: e.target.value as UserRole})
                  : setNewUser({...newUser, role: e.target.value as UserRole})}
                className="form-input"
              >
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Procesando...' : (editingUser ? 'Guardar Cambios' : 'Crear Usuario')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
