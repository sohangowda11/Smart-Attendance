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
    try {
      const saved = localStorage.getItem('synapse_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('synapse_user');
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('synapse_token');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('synapse_token');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      let storedToken: string | null = null;
      try {
        storedToken = localStorage.getItem('synapse_token');
      } catch {
        storedToken = null;
      }

      if (storedToken) {
        try {
          const userData = await Promise.race([
            authApi.me(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Auth validation timeout')), 4000)
            )
          ]);
          if (mounted) {
            setUser(userData);
            try {
              localStorage.setItem('synapse_user', JSON.stringify(userData));
            } catch {}
          }
        } catch (err) {
          console.warn("Auth session validation notice:", err);
          if (mounted) {
            logout();
          }
        }
      }
      if (mounted) {
        setLoading(false);
      }
    };
    checkAuth();

    return () => {
      mounted = false;
    };
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
    try {
      authApi.logout().catch(() => {});
    } catch (e) {
      // Ignore
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('synapse_token');
    localStorage.removeItem('synapse_user');
    sessionStorage.clear();

    // Release any lingering media streams across the application
    try {
      if (typeof window !== 'undefined' && (window as any).__synapseActiveStreams) {
        (window as any).__synapseActiveStreams.forEach((s: MediaStream) => {
          s.getTracks().forEach((t) => t.stop());
        });
        (window as any).__synapseActiveStreams = [];
      }
    } catch (e) {
      // Ignore
    }
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

