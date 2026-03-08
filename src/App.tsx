import { useState, useEffect } from 'react'
import './App.css'
import Login from './Login'
import MaterialInventory from './MaterialInventory'
import ToolInventory from './ToolInventory'
import ClientManagement from './ClientManagement'
import BudgetView from './BudgetView'
import WorkOrdersView from './WorkOrdersView'
import UserManagement from './UserManagement'
import { supabase } from './lib/supabase'
import type { User } from './types'
import { ROLE_LABELS } from './types'

type AppView = 'DASHBOARD' | 'MATERIAL_INVENTORY' | 'TOOLS' | 'CLIENTS' | 'BUDGETS' | 'WORK_ORDERS' | 'REPORTS' | 'USER_MANAGEMENT';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeView, setActiveView] = useState<AppView>('DASHBOARD')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Verificar si hay sesión activa al cargar
    checkUser();

    // 2. Escuchar cambios en la autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetchProfile(session.user.id, session.user.email || '');
    }
    setLoading(false);
  };

  const fetchProfile = async (userId: string, email: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setCurrentUser({
        id: userId,
        username: email.split('@')[0],
        role: data.role,
        name: data.full_name || email.split('@')[0]
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveView('DASHBOARD');
  }

  if (loading) return <div className="loading-screen">Iniciando sistema...</div>;

  const renderView = () => {
    if (!currentUser) return <Login onLoginSuccess={() => setActiveView('DASHBOARD')} />;

    switch (activeView) {
      case 'MATERIAL_INVENTORY':
        return <MaterialInventory onBack={() => setActiveView('DASHBOARD')} currentUser={currentUser} />;
      case 'TOOLS':
        return <ToolInventory onBack={() => setActiveView('DASHBOARD')} currentUser={currentUser} />;
      case 'CLIENTS':
        return <ClientManagement onBack={() => setActiveView('DASHBOARD')} />;
      case 'BUDGETS':
        return <BudgetView onBack={() => setActiveView('DASHBOARD')} currentUser={currentUser} />;
      case 'WORK_ORDERS':
        return <WorkOrdersView onBack={() => setActiveView('DASHBOARD')} />;
      case 'USER_MANAGEMENT':
        return <UserManagement onBack={() => setActiveView('DASHBOARD')} />;
      case 'DASHBOARD':
      default:
        return (
          <div className="dashboard">
            <header className="dashboard-header">
              <div className="user-welcome">
                <h2>Panel de {ROLE_LABELS[currentUser.role]}</h2>
                <p>Bienvenido, <strong>{currentUser.name}</strong></p>
              </div>
              <button className="logout-btn" onClick={handleLogout}>Salir</button>
            </header>

            <section className="dashboard-content">
              <div className="role-indicator">
                Sesión iniciada como: {ROLE_LABELS[currentUser.role]}
              </div>
              
              <div className="menu-grid">
                <button className="menu-item" onClick={() => setActiveView('MATERIAL_INVENTORY')}>
                  <span className="icon">📦</span>
                  <span>Inventario Materiales</span>
                </button>
                <button className="menu-item" onClick={() => setActiveView('TOOLS')}>
                  <span className="icon">🔧</span>
                  <span>Herramientas</span>
                </button>
                {(currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE' || currentUser.role === 'SUPERVISOR') && (
                  <button className="menu-item" onClick={() => setActiveView('CLIENTS')}>
                    <span className="icon">🤝</span>
                    <span>Clientes</span>
                  </button>
                )}
                {(currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE' || currentUser.role === 'SUPERVISOR') && (
                  <button className="menu-item" onClick={() => setActiveView('BUDGETS')}>
                    <span className="icon">📄</span>
                    <span>Presupuestos</span>
                  </button>
                )}
                <button className="menu-item" onClick={() => setActiveView('WORK_ORDERS')}>
                  <span className="icon">📋</span>
                  <span>Órdenes de Trabajo</span>
                </button>
                {(currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE') && (
                  <>
                    <button className="menu-item" onClick={() => setActiveView('REPORTS')}>
                      <span className="icon">📊</span>
                      <span>Reportes Gerenciales</span>
                    </button>
                    <button className="menu-item" onClick={() => setActiveView('USER_MANAGEMENT')}>
                      <span className="icon">👥</span>
                      <span>Gestión de Usuarios</span>
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        );
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🛠️ Taller Metalúrgico</h1>
      </header>
      
      <main className="app-main">
        {renderView()}
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 Taller Metalúrgico - v1.2.5</p>
      </footer>
    </div>
  )
}

export default App
