import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SectionId, getInitialSection } from './navigation';

export type UserRole = 'admin' | 'dispatcher' | 'driver';

interface DispatchContextType {
  currentSection: SectionId;
  navigateTo: (sectionId: SectionId) => void;
  tenant: string;
  setTenant: (t: string) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  role: UserRole;
  setRole: (r: UserRole) => void;
  refreshAll: () => void;
  refreshKey: number;
}

const DispatchContext = createContext<DispatchContextType | null>(null);

export function DispatchProvider({ children }: { children: React.ReactNode }) {
  const [currentSection, setCurrentSection] = useState<SectionId>(getInitialSection);
  const [tenant, setTenant] = useState('Mandant A');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [role, setRole] = useState<UserRole>('dispatcher');
  const [refreshKey, setRefreshKey] = useState(0);

  const navigateTo = useCallback((sectionId: SectionId) => {
    setCurrentSection(sectionId);
    history.replaceState(null, '', `#${sectionId}`);
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '') as SectionId;
      if (hash && hash !== currentSection) {
        setCurrentSection(hash);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [currentSection]);

  // refresh on context change
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, selectedDate]);

  return (
    <DispatchContext.Provider value={{
      currentSection, navigateTo,
      tenant, setTenant,
      selectedDate, setSelectedDate,
      role, setRole,
      refreshAll, refreshKey,
    }}>
      {children}
    </DispatchContext.Provider>
  );
}

export function useDispatch() {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error('useDispatch must be used within DispatchProvider');
  return ctx;
}
