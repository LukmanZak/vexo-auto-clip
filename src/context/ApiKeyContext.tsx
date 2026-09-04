import React, { createContext, useContext, useState, useEffect } from 'react';

interface ApiKeyContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  saveApiKey: (key: string) => void;
  effectiveApiKey: string;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('GEMINI_API_KEY_UI') || '';
  });

  const [envApiKey] = useState(process.env.GEMINI_API_KEY || '');

  const saveApiKey = (key: string) => {
    localStorage.setItem('GEMINI_API_KEY_UI', key);
    setApiKey(key);
  };

  const effectiveApiKey = apiKey || envApiKey;

  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey, saveApiKey, effectiveApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};
