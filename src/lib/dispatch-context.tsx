import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SectionId, getInitialSection } from './navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  DepotOption,
  depotLabel,
  readStoredDepotId,
  writeStoredDepotId,
} from './depot';

export type UserRole = 'admin' | 'dispatcher' | 'driver';

interface DispatchContextType {
  currentSection: SectionId;
  navigateTo: (sectionId: SectionId) => void;
  /** @deprecated Alias für selectedDepotLabel — Fake-Mandanten entfernt */
  tenant: string;
  setTenant: (t: string) => void;
  companyId: string | null;
  depots: DepotOption[];
  depotsLoading: boolean;
  /** null = Alle Depots */
  selectedDepotId: string | null;
  setSelectedDepotId: (id: string | null) => void;
  selectedDepot: DepotOption | null;
  selectedDepotLabel: string;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  role: UserRole;
  refreshAll: () => void;
  refreshKey: number;
}

const DispatchContext = createContext<DispatchContextType | null>(null);

export function DispatchProvider({ children }: { children: React.ReactNode }) {
  const [currentSection, setCurrentSection] = useState<SectionId>(getInitialSection);
  const [selectedDepotId, setSelectedDepotIdState] = useState<string | null>(() => readStoredDepotId());
  const [depots, setDepots] = useState<DepotOption[]>([]);
  const [depotsLoading, setDepotsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const { user, role: authRole } = useAuth();

  const role = (authRole as UserRole) ?? 'dispatcher';

  const selectedDepot = depots.find((d) => d.id === selectedDepotId) ?? null;
  const selectedDepotLabel = depotLabel(selectedDepot);

  const setSelectedDepotId = useCallback((id: string | null) => {
    setSelectedDepotIdState(id);
    writeStoredDepotId(id);
  }, []);

  // Backward-compat: alter Mandant-Select schreibt nur noch Label (kein Filter)
  const setTenant = useCallback((t: string) => {
    if (t === 'Alle Depots') {
      setSelectedDepotId(null);
      return;
    }
    const match = depots.find((d) => d.name === t || depotLabel(d) === t);
    if (match) setSelectedDepotId(match.id);
  }, [depots, setSelectedDepotId]);

  const navigateTo = useCallback((sectionId: SectionId) => {
    setCurrentSection(sectionId);
    history.replaceState(null, '', `#${sectionId}`);
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshKey((k) => k + 1);
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

  useEffect(() => {
    let cancelled = false;

    async function loadDepots() {
      if (!user) {
        setCompanyId(null);
        setDepots([]);
        setDepotsLoading(false);
        return;
      }

      setDepotsLoading(true);
      const { data: cid, error: cidError } = await supabase.rpc('get_user_company_id');
      if (cancelled) return;

      if (cidError || !cid) {
        setCompanyId(null);
        setDepots([]);
        setDepotsLoading(false);
        return;
      }

      setCompanyId(cid as string);

      const { data, error } = await supabase
        .from('depot')
        .select('id, name, code, city, lat, lng, is_active')
        .eq('company_id', cid as string)
        .eq('is_active', true)
        .order('name');

      if (cancelled) return;

      if (error) {
        console.error('Depots laden fehlgeschlagen:', error);
        setDepots([]);
      } else {
        const list = (data as DepotOption[]) ?? [];
        setDepots(list);
        const stored = readStoredDepotId();
        if (stored && !list.some((d) => d.id === stored)) {
          setSelectedDepotId(null);
        }
      }
      setDepotsLoading(false);
    }

    loadDepots();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey, setSelectedDepotId]);

  return (
    <DispatchContext.Provider value={{
      currentSection,
      navigateTo,
      tenant: selectedDepotLabel,
      setTenant,
      companyId,
      depots,
      depotsLoading,
      selectedDepotId,
      setSelectedDepotId,
      selectedDepot,
      selectedDepotLabel,
      selectedDate,
      setSelectedDate,
      role,
      refreshAll,
      refreshKey,
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
