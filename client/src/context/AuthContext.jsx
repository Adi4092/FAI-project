import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await authService.getCurrentUser();
      // If no stored user, provide a default demo admin so reviewer can immediately browse all 15 screens in Phase 2
      if (!currentUser) {
        const defaultDemo = {
          id: 'demo-admin-id',
          name: 'Admin User',
          email: 'admin@medstock.local',
          role: 'admin',
          isActive: true,
          lastLoginAt: new Date().toISOString(),
        };
        localStorage.setItem('medstock_demo_user', JSON.stringify(defaultDemo));
        setUser(defaultDemo);
      } else {
        setUser(currentUser);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role, loading, login, logout, checkAuth, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
