import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { auth } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const checked = useRef(false);

  useEffect(() => {
    // StrictMode fires effects twice in dev — only run the auth check once
    if (checked.current) return;
    checked.current = true;

    auth.me()
      .then(r => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const r = await auth.login({ username, password });
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
