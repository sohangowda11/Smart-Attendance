import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse } from '../services/types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isFaculty: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('synapse_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('synapse_token');
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('synapse_token');
      if (storedToken) {
        try {
          const userData = await authApi.me();
          setUser(userData);
          localStorage.setItem('synapse_user', JSON.stringify(userData));
        } catch (err) {
          console.error("Auth session expired", err);
          logout();
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const data: AuthResponse = await authApi.login(email, password);
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('synapse_token', data.access_token);
    localStorage.setItem('synapse_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    setToken(null);
    setUser(null);
    localStorage.removeItem('synapse_token');
    localStorage.removeItem('synapse_user');
  };

  const isAdmin = user?.role === 'ADMIN';
  const isFaculty = user?.role === 'FACULTY';
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isFaculty,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

