'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''; // '' = same origin

type User = { id: string; username: string } | null;

interface AuthContextType {
  user: User;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => Promise<void>;
  initialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: async () => {},
  initialized: false,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data?.authenticated) setUser(data.user);
        }
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;

    const me = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
    if (me.ok) {
      const data = await me.json();
      setUser(data.user ?? null);
    }
    return true;
  };

  const logout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}
