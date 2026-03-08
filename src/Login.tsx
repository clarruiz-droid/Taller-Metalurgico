import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import './Login.css';

import pkg from '../package.json';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Convertimos el nombre de usuario en un email virtual para Supabase
    const virtualEmail = `${username.trim().toLowerCase()}@taller.com`;

    const { error } = await supabase.auth.signInWithPassword({
      email: virtualEmail,
      password: password,
    });

    if (error) {
      setErrorMsg('Usuario o contraseña incorrectos');
      setLoading(false);
    } else {
      onLoginSuccess();
    }
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <div className="logo-icon">🛠️</div>
        <h2>Acceso al Taller</h2>
        <p>Ingrese sus credenciales para continuar</p>
      </div>
      
      <form onSubmit={handleLogin} className="login-form">
        {errorMsg && <div className="error-banner">{errorMsg}</div>}

        <div className="form-group">
          <label htmlFor="username">Nombre de Usuario</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ej: claudio.ruiz"
            required
            className="form-input"
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="form-input"
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Verificando...' : 'Entrar al Sistema'}
        </button>
      </form>
      
      <div className="login-footer">
        <p>Solo personal autorizado.</p>
        <span className="version-tag">Versión {pkg.version}</span>
      </div>
    </div>
  );
};

export default Login;
