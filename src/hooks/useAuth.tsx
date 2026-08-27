import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { signInWithDriverPin, type PinLoginResult } from '@/lib/driver-pin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  loading: boolean;
  /** true sobald get_my_role() beantwortet ist — auch bei Fehler oder Timeout. */
  roleResolved: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithPin: (firstName: string, lastName: string, code: string) => Promise<PinLoginResult>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Ohne Obergrenze würde ein hängender RPC rollenabhängige Routen dauerhaft blockieren. */
const ROLE_FETCH_TIMEOUT_MS = 5000;

type RoleFetch = { ok: true; role: string | null } | { ok: false };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    const timeout = new Promise<RoleFetch>((resolve) => {
      setTimeout(() => resolve({ ok: false }), ROLE_FETCH_TIMEOUT_MS);
    });

    try {
      const result = await Promise.race<RoleFetch>([
        supabase
          .rpc('get_my_role')
          .then(({ data, error }) => (error ? { ok: false } : { ok: true, role: data ?? null })),
        timeout,
      ]);
      // Ein fehlender user_roles-Eintrag ist eine gültige Antwort (frischer
      // Account) und fällt wie bisher auf 'dispatcher'. Ein gescheiterter Abruf
      // bleibt dagegen bewusst unbekannt, damit rollenabhängige Weiterleitungen
      // nicht auf einer geratenen Rolle basieren.
      setRole(result.ok ? (result.role ?? 'dispatcher') : null);
    } catch {
      setRole(null);
    } finally {
      setRoleResolved(true);
    }
  }, []);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setRoleResolved(false);
        // Defer role fetch to avoid Supabase deadlock
        setTimeout(() => fetchRole(), 0);
      } else {
        setRole(null);
        setRoleResolved(true);
      }
      setLoading(false);
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setRoleResolved(false);
        fetchRole();
      } else {
        setRole(null);
        setRoleResolved(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithPin = async (firstName: string, lastName: string, code: string) => {
    return signInWithDriverPin(firstName, lastName, code);
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setRoleResolved(true);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, roleResolved, signIn, signInWithPin, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
