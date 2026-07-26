import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsState {
  businessName: string;
}

interface SettingsContextValue extends SettingsState {
  updateBusinessName: (name: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [businessName, setBusinessName] = useState(() => {
    return localStorage.getItem('coreboard:business-name') || 'LastCoRE';
  });

  const updateBusinessName = (name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      setBusinessName(trimmed);
      localStorage.setItem('coreboard:business-name', trimmed);
    }
  };

  return (
    <SettingsContext.Provider value={{ businessName, updateBusinessName }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
