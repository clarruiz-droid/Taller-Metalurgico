import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import './App.css'
import Login from './Login'
import MaterialInventory from './MaterialInventory'
import ToolInventory from './ToolInventory'
import ClientManagement from './ClientManagement'
import SupplierManagement from './SupplierManagement'
import BudgetView from './BudgetView'
import WorkOrdersView from './WorkOrdersView'
import UserManagement from './UserManagement'
import { supabase } from './lib/supabase'
import type { User } from './types'
import { ROLE_LABELS } from './types'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setCurrentUser(null);
        navigate('/');
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
    navigate('/');
  }

  if (loading) return <div className="loading-screen">Iniciando sistema...</div>;

  const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
    if (!currentUser) return <Navigate to="/" replace />;
    if (allowedRoles && !allowedRoles.includes(currentUser.role)) return <Navigate to="/dashboard" replace />;
    return children;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🛠️ Taller Metalúrgico</h1>
      </header>
      
      <main className="app-main">
        <Routes>
          <Route path="/" element={!currentUser ? <Login onLoginSuccess={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" replace />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <div className="dashboard">
                <header className="dashboard-header">
                  <div className="user-welcome">
                    <h2>Panel de {currentUser ? ROLE_LABELS[currentUser.role] : ''}</h2>
                    <p>Bienvenido, <strong>{currentUser?.name}</strong></p>
                  </div>
                  <button className="logout-btn" onClick={handleLogout}>Salir</button>
                </header>

                <section className="dashboard-content">
                  <div className="role-indicator">
                    Sesión iniciada como: {currentUser ? ROLE_LABELS[currentUser.role] : ''}
                  </div>
                  
                  <div className="menu-grid">
                    <Link to="/material-inventory" className="menu-item">
                      <span className="icon">📦</span>
                      <span>Inventario Materiales</span>
                    </Link>
                    <Link to="/tools" className="menu-item">
                      <span className="icon">🔧</span>
                      <span>Herramientas</span>
                    </Link>
                    {currentUser && ['ADMIN', 'GERENTE', 'SUPERVISOR'].includes(currentUser.role) && (
                      <Link to="/clients" className="menu-item">
                        <span className="icon">🤝</span>
                        <span>Clientes</span>
                      </Link>
                    )}
                    {currentUser && ['ADMIN', 'GERENTE', 'SUPERVISOR'].includes(currentUser.role) && (
                      <Link to="/suppliers" className="menu-item">
                        <span className="icon">🚚</span>
                        <span>Proveedores</span>
                      </Link>
                    )}
                    {currentUser && ['ADMIN', 'GERENTE', 'SUPERVISOR'].includes(currentUser.role) && (
                      <Link to="/budgets" className="menu-item">
                        <span className="icon">📄</span>
                        <span>Presupuestos</span>
                      </Link>
                    )}
                    <Link to="/work-orders" className="menu-item">
                      <span className="icon">📋</span>
                      <span>Órdenes de Trabajo</span>
                    </Link>
                    {currentUser && ['ADMIN', 'GERENTE'].includes(currentUser.role) && (
                      <>
                        <Link to="/reports" className="menu-item">
                          <span className="icon">📊</span>
                          <span>Reportes Gerenciales</span>
                        </Link>
                        <Link to="/user-management" className="menu-item">
                          <span className="icon">👥</span>
                          <span>Gestión de Usuarios</span>
                        </Link>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </ProtectedRoute>
          } />

          <Route path="/material-inventory" element={
            <ProtectedRoute>
              <MaterialInventory onBack={() => navigate('/dashboard')} currentUser={currentUser} />
            </ProtectedRoute>
          } />
          
          <Route path="/tools" element={
            <ProtectedRoute>
              <ToolInventory onBack={() => navigate('/dashboard')} currentUser={currentUser} />
            </ProtectedRoute>
          } />

          <Route path="/clients" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'GERENTE', 'SUPERVISOR']}>
              <ClientManagement onBack={() => navigate('/dashboard')} />
            </ProtectedRoute>
          } />

          <Route path="/suppliers" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'GERENTE', 'SUPERVISOR']}>
              <SupplierManagement onBack={() => navigate('/dashboard')} />
            </ProtectedRoute>
          } />

          <Route path="/budgets" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'GERENTE', 'SUPERVISOR']}>
              <BudgetView onBack={() => navigate('/dashboard')} currentUser={currentUser} />
            </ProtectedRoute>
          } />

          <Route path="/work-orders" element={
            <ProtectedRoute>
              <WorkOrdersView onBack={() => navigate('/dashboard')} />
            </ProtectedRoute>
          } />

          <Route path="/user-management" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'GERENTE']}>
              <UserManagement onBack={() => navigate('/dashboard')} />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 Taller Metalúrgico - v1.5.4</p>
      </footer>
    </div>
  )
}

export default App
