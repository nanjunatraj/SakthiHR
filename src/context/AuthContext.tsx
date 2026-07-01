import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { clearWorkspace } from '../lib/workspace';
import { clearPortalToken } from '../lib/portalSession';

export type AppRole = 'super_admin' | 'org_admin' | 'user';

export interface Membership {
  id: string;
  org_id: string | null;
  role: AppRole;
  status: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Memberships of the signed-in user (their own rows, via RLS). */
  memberships: Membership[];
  /** Highest-privilege role held by the user. */
  role: AppRole | null;
  isSuperAdmin: boolean;
  /** The org the user operates in (null for a platform super_admin). */
  activeOrgId: string | null;
  /** The signed-in staff member's User Master role — drives menu/route access. */
  staffRole: string | null;
  /** The staff member's own employee code, if they are also on the payroll. */
  staffEmployeeCode: string | null;
  /** True when this staff account is also linked to an employee record. */
  isEmployeeLinked: boolean;
  /** True until the staff role has been resolved for the current session. */
  staffRoleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_RANK: Record<AppRole, number> = { user: 1, org_admin: 2, super_admin: 3 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [staffEmployeeCode, setStaffEmployeeCode] = useState<string | null>(null);
  const [staffRoleLoading, setStaffRoleLoading] = useState(true);

  const loadMemberships = useCallback(async (uid: string | undefined) => {
    if (!uid) { setMemberships([]); return; }
    const { data } = await supabase
      .from('memberships')
      .select('id, org_id, role, status')
      .eq('user_id', uid)
      .eq('status', 'Active');
    setMemberships((data as Membership[] | null) ?? []);
  }, []);

  // The signed-in staff member's User Master role + employee linkage, resolved
  // server-side from the Supabase Auth session — drives admin menu/route access
  // and the "also an employee" workspace choice.
  const loadStaffRole = useCallback(async (uid: string | undefined) => {
    if (!uid) { setStaffRole(null); setStaffEmployeeCode(null); setStaffRoleLoading(false); return; }
    setStaffRoleLoading(true);
    const { data } = await supabase.rpc('current_user_context');
    const ctx = (data ?? null) as { role?: string | null; employee_code?: string | null } | null;
    setStaffRole(ctx?.role ?? null);
    setStaffEmployeeCode(ctx?.employee_code ?? null);
    setStaffRoleLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await Promise.all([loadMemberships(data.session?.user?.id), loadStaffRole(data.session?.user?.id)]);
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      await Promise.all([loadMemberships(newSession?.user?.id), loadStaffRole(newSession?.user?.id)]);
      setLoading(false);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadMemberships, loadStaffRole]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error?.message ?? null };
  };

  const signOut = async (): Promise<void> => {
    clearWorkspace();
    clearPortalToken();
    await supabase.auth.signOut();
  };

  const role: AppRole | null = memberships.length
    ? memberships.map((m) => m.role).sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0]
    : null;
  const isSuperAdmin = memberships.some((m) => m.role === 'super_admin');
  const activeOrgId = memberships.find((m) => m.org_id)?.org_id ?? null;

  return (
    <AuthContext.Provider value={{
      user, session, loading, memberships, role, isSuperAdmin, activeOrgId,
      staffRole, staffEmployeeCode, isEmployeeLinked: !!staffEmployeeCode, staffRoleLoading,
      signIn, signOut, refreshMemberships: () => loadMemberships(user?.id),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
