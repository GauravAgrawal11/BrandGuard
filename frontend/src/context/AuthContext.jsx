import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('bg_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('bg_token') || null;
  });

  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Sync token & user to localStorage
  useEffect(() => {
    if (token && user) {
      localStorage.setItem('bg_token', token);
      localStorage.setItem('bg_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('bg_token');
      localStorage.removeItem('bg_user');
    }
  }, [token, user]);

  // Fetch current user details & notifications on mount if token exists
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/api/auth/me/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Token expired');
      })
      .then(data => {
        setUser(data.user);
        setUnreadNotifications(data.unread_notifications || 0);
      })
      .catch(() => {
        logout();
      });
    }
  }, [token]);

  const login = async (username, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch {
      // Ignored
    }
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isWriter = user?.role === 'CONTENT_WRITER';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin,
        isWriter,
        loading,
        authError,
        unreadNotifications,
        login,
        logout,
        setUser,
        setToken
      }}
    >
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
