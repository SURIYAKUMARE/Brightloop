import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiRequest, setAuthToken, clearAuthToken, getAuthToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchRoleDemo: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      const savedUser = localStorage.getItem('brightloop_user');
      const token = getAuthToken();

      if (savedUser && token) {
        try {
          setUser(JSON.parse(savedUser));
          if (navigator.onLine) {
            // Revalidate token if online
            const freshUser = await apiRequest<User>('/auth/me');
            setUser(freshUser);
            localStorage.setItem('brightloop_user', JSON.stringify(freshUser));
          }
        } catch (e) {
          console.warn('Session revalidation failed, using cached session if offline:', e);
          if (navigator.onLine) {
            clearAuthToken();
            setUser(null);
          }
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setAuthToken(res.access_token);
    setUser(res.user);
    localStorage.setItem('brightloop_user', JSON.stringify(res.user));
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  // 1-Click Role Switcher for instant review of all 3 mandatory roles
  const switchRoleDemo = async (targetRole: UserRole) => {
    let email = 'admin@brightloop.com';
    let pass = 'Admin@12345!';

    if (targetRole === 'staff') {
      email = 'staff@brightloop.com';
      pass = 'Staff@12345!';
    } else if (targetRole === 'customer') {
      email = 'customer@brightloop.com';
      pass = 'Customer@12345!';
    }

    await login(email, pass);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'admin',
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchRoleDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
