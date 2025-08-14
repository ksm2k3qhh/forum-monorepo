import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (t && u) { setToken(t); try { setUser(JSON.parse(u)); } catch {} }
  }, []);

  const login = async (username, password) => {
    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      let msg = 'Login failed';
      try { const e = await res.json(); msg = e.error || msg; } catch { try { msg = await res.text(); } catch {} }
      throw new Error(msg);
    }
    const data = await res.json();
    setToken(data.token); setUser(data.user);
    localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  };

  const register = async (username, password) => {
    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000') + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      let msg = 'Register failed';
      try { const e = await res.json(); msg = e.error || msg; } catch { try { msg = await res.text(); } catch {} }
      throw new Error(msg);
    }
    return await login(username, password);
  };

  const logout = () => { setToken(null); setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); };

  return <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
