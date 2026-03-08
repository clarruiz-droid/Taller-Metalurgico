import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { User, UserRole } from './types';
import { ROLE_LABELS } from './types';
import { supabase } from './lib/supabase';
import './UserManagement.css';

// Obtenemos las credenciales para el cliente temporal
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const UserManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Estado para nuevo usuario
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    name: '', 
    role: 'OPERARIO' as UserRole 
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error cargando usuarios:', error);
    } else {
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
      // 1. Crear un cliente temporal que NO guarde sesión (para no desloguear al admin)
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false }
      });

      const virtualEmail = `${newUser.username.trim().toLowerCase()}@taller.com`;

      // 2. Registrar el usuario en la Autenticación
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: virtualEmail,
        password: newUser.password,
        options: {
          data: { full_name: newUser.name }
        }
      });

      if (authError) throw authError;

      // 3. El trigger de la DB ya creó el perfil, ahora le asignamos el rol elegido
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: newUser.role })
          .eq('id', authData.user.id);
        
        if (profileError) throw profileError;
      }

      alert('Usuario creado con éxito');
      setShowForm(false);
      setNewUser({ username: '', password: '', name: '', role: 'OPERARIO' });
      await fetchUsers();
    } catch (error: any) {
      alert('Error: ' + (error.message || 'No se pudo crear el usuario'));
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
      .update({ full_name: newUser.name, role: newUser.role })
      .eq('id', editingUser.id);

    if (error) {
      alert('Error al actualizar');
    } else {
      setEditingUser(null);
      setShowForm(false);
      await fetchUsers();
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Eliminar acceso de este usuario?')) return;
    await supabase.from('profiles').delete().eq('id', userId);
    await fetchUsers();
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
                  <button className="btn-action" onClick={() => {
                    setEditingUser(user);
                    setNewUser({ ...newUser, name: user.name, role: user.role });
                    setShowForm(true);
                  }}>✎</button>
                  <button className="btn-action btn-delete" onClick={() => handleDeleteUser(user.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-fab" onClick={() => {
            setEditingUser(null);
            setNewUser({ username: '', password: '', name: '', role: 'OPERARIO' });
            setShowForm(true);
          }}>+</button>
        </>
      ) : (
        <div className="user-form-container">
          <h4>{editingUser ? 'Editar Empleado' : 'Nuevo Empleado'}</h4>
          <form className="user-form" onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
            <div className="form-group">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                value={newUser.name}
                onChange={e => setNewUser({...newUser, name: e.target.value})}
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
