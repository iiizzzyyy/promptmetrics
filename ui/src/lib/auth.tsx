'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface AuthContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  apiKey: '',
  setApiKey: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState('');

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pm_api_key', key);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pm_api_key');
      if (saved) setApiKeyState(saved);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ apiKey, setApiKey }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
