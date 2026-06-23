// Dashboard data + per-user customization, sourced entirely from Supabase.
// No mock/hardcoded figures — every number reflects real DB state.

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveToday: number;
  pendingLeaveApprovals: number;
  avgAttendance: number | null; // % for the current month; null when no records
  attendanceRecords: number;
  payrollBudgetMonthly: number;
  payrollAssignedCount: number;
}
export interface GrowthPoint { name: string; employees: number; }
export interface PayrollPoint { name: string; payroll: number; }
export interface OnboardingRow { id: string; name: string; department: string; status: string; doj: string; }

export interface DashboardData {
  loading: boolean;
  stats: DashboardStats;
  growth: GrowthPoint[];
  payrollTrend: PayrollPoint[];
  onboarding: OnboardingRow[];
}

const EMPTY_STATS: DashboardStats = {
  totalEmployees: 0, activeEmployees: 0, onLeaveToday: 0, pendingLeaveApprovals: 0,
  avgAttendance: null, attendanceRecords: 0, payrollBudgetMonthly: 0, payrollAssignedCount: 0,
};

/** Live dashboard figures computed from the database. */
export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    loading: true, stats: EMPTY_STATS, growth: [], payrollTrend: [], onboarding: [],
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const [empRes, leaveTodayRes, pendingRes, attRes, salaryRes, periodsRes] = await Promise.all([
        db.from('employees').select('id, first_name, middle_name, last_name, status, date_of_joining, department:departments(name)'),
        db.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'Approved').lte('from_date', today).gte('to_date', today),
        db.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
        db.from('attendance_records').select('status').gte('attendance_date', monthStartStr),
        db.from('employee_salary_assignments').select('ctc_monthly').eq('is_current', true),
        db.from('payroll_periods').select('id, name, from_date').order('from_date', { ascending: false }).limit(6),
      ]);

      const employees = (empRes.data ?? []) as Record<string, any>[];
      const totalEmployees = employees.length;
      const activeEmployees = employees.filter(e => e.status === 'Active').length;

      const att = (attRes.data ?? []) as Record<string, any>[];
      const present = att.filter(a => /present|wfh|work from home|half/i.test(a.status ?? '')).length;
      const avgAttendance = att.length ? Math.round((present / att.length) * 1000) / 10 : null;

      const salary = (salaryRes.data ?? []) as Record<string, any>[];
      const payrollBudgetMonthly = salary.reduce((s, r) => s + Number(r.ctc_monthly ?? 0), 0);

      // Cumulative headcount at the end of each of the last 6 months.
      const growth: GrowthPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const count = employees.filter(e => e.date_of_joining && new Date(e.date_of_joining) <= monthEnd).length;
        growth.push({ name: MONTHS[monthEnd.getMonth()], employees: count });
      }

      // Net payroll per period (last 6, chronological).
      const periods = ((periodsRes.data ?? []) as Record<string, any>[]).reverse();
      let payrollTrend: PayrollPoint[] = [];
      if (periods.length) {
        const ids = periods.map(p => p.id);
        const { data: entries } = await db.from('payroll_entries').select('payroll_period_id, net_salary').in('payroll_period_id', ids);
        const byPeriod = new Map<string, number>();
        ((entries ?? []) as Record<string, any>[]).forEach(e =>
          byPeriod.set(e.payroll_period_id, (byPeriod.get(e.payroll_period_id) ?? 0) + Number(e.net_salary ?? 0)));
        payrollTrend = periods.map(p => ({
          name: (p.name ?? '').split(' ')[0] || MONTHS[new Date(p.from_date).getMonth()],
          payroll: byPeriod.get(p.id) ?? 0,
        }));
      }

      const onboarding: OnboardingRow[] = employees
        .filter(e => e.date_of_joining)
        .sort((a, b) => (b.date_of_joining ?? '').localeCompare(a.date_of_joining ?? ''))
        .slice(0, 5)
        .map(e => ({
          id: e.id,
          name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
          department: e.department?.name ?? '—',
          status: e.status ?? 'Active',
          doj: e.date_of_joining,
        }));

      if (!active) return;
      setData({
        loading: false,
        stats: {
          totalEmployees, activeEmployees,
          onLeaveToday: leaveTodayRes.count ?? 0,
          pendingLeaveApprovals: pendingRes.count ?? 0,
          avgAttendance, attendanceRecords: att.length,
          payrollBudgetMonthly, payrollAssignedCount: salary.length,
        },
        growth, payrollTrend, onboarding,
      });
    })();
    return () => { active = false; };
  }, []);

  return data;
}

// ─── Per-user widget visibility ────────────────────────────────────────────────

export interface DashboardWidget { id: string; label: string; group: 'Stat cards' | 'Panels'; }

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'stat-employees', label: 'Total Employees', group: 'Stat cards' },
  { id: 'stat-leave', label: 'On Leave Today', group: 'Stat cards' },
  { id: 'stat-attendance', label: 'Avg. Attendance', group: 'Stat cards' },
  { id: 'stat-payroll', label: 'Payroll Budget', group: 'Stat cards' },
  { id: 'payroll-trends', label: 'Payroll Trends chart', group: 'Panels' },
  { id: 'poll', label: 'Active Poll', group: 'Panels' },
  { id: 'celebrations', label: 'Celebrations (Birthdays & Anniversaries)', group: 'Panels' },
  { id: 'employee-growth', label: 'Employee Growth chart', group: 'Panels' },
  { id: 'recent-onboarding', label: 'Recent Onboarding', group: 'Panels' },
];

export function useDashboardPrefs() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      const id = u.user?.id ?? null;
      const { data } = await db.from('user_dashboard_preferences').select('hidden_widgets').eq('user_id', id ?? '').maybeSingle();
      if (!active) return;
      setUid(id);
      setHidden(new Set((data?.hidden_widgets ?? []) as string[]));
    })();
    return () => { active = false; };
  }, []);

  const toggle = useCallback((id: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      void (async () => {
        let id2 = uid;
        if (!id2) {
          const { data: u } = await supabase.auth.getUser();
          id2 = u.user?.id ?? null;
          if (id2) setUid(id2);
        }
        if (!id2) return;
        const { error } = await db.from('user_dashboard_preferences').upsert(
          { user_id: id2, hidden_widgets: [...next], updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
        if (error) console.warn('[dashboard] prefs save failed:', error.message);
      })();
      return next;
    });
  }, [uid]);

  return { hidden, toggle };
}
