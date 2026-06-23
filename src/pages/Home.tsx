import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Clock,
  CalendarCheck,
  TrendingUp,
  ArrowUpRight,
  UserPlus,
  SlidersHorizontal,
  Check,
  Inbox,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useCurrency } from '../context/CurrencyContext';
import PollWidget from '../components/PollWidget';
import CelebrationsWidget from '../components/CelebrationsWidget';
import { useDashboardData, useDashboardPrefs, DASHBOARD_WIDGETS } from '../lib/dashboard';

function formatJoinDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EmptyPanel = ({ message }: { message: string }) => (
  <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-muted-foreground">
    <Inbox size={28} className="mb-2 opacity-50" />
    <p className="text-sm">{message}</p>
  </div>
);

export default function Home() {
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const { stats, growth, payrollTrend, onboarding, loading } = useDashboardData();
  const { hidden, toggle } = useDashboardPrefs();
  const [customizing, setCustomizing] = useState(false);

  const show = (id: string) => !hidden.has(id);
  const anyStatCard = ['stat-employees', 'stat-leave', 'stat-attendance', 'stat-payroll'].some(show);
  const hasGrowth = growth.some(g => g.employees > 0);
  const hasPayroll = payrollTrend.some(p => p.payroll > 0);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">HRMS Dashboard</h1>
            <p className="text-muted-foreground">Live overview of your organisation — figures update from your records.</p>
          </div>
          <div className="flex gap-3 relative">
            <button
              onClick={() => setCustomizing(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                customizing ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-accent'
              }`}
            >
              <SlidersHorizontal size={18} />
              <span>Customize</span>
            </button>
            <button
              onClick={() => navigate('/employees/new')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md"
            >
              <UserPlus size={18} />
              <span>Add Employee</span>
            </button>

            <AnimatePresence>
              {customizing && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute right-0 top-12 z-30 w-72 bg-card border border-border rounded-xl shadow-2xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-sm">Customize Dashboard</p>
                    <button onClick={() => setCustomizing(false)} className="text-xs text-primary font-medium">Done</button>
                  </div>
                  {(['Stat cards', 'Panels'] as const).map(group => (
                    <div key={group} className="mb-3 last:mb-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold mb-1.5">{group}</p>
                      <div className="space-y-1">
                        {DASHBOARD_WIDGETS.filter(w => w.group === group).map(w => (
                          <button
                            key={w.id}
                            onClick={() => toggle(w.id)}
                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors text-left"
                          >
                            <span className={`w-4 h-4 rounded flex items-center justify-center border ${
                              show(w.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                            }`}>
                              {show(w.id) && <Check size={11} />}
                            </span>
                            <span className="text-sm">{w.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border">Your layout is saved to your account.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {anyStatCard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {show('stat-employees') && (
              <StatCard
                title="Total Employees"
                value={stats.totalEmployees}
                change={`${stats.activeEmployees} active`}
                icon={Users}
                trend="neutral"
              />
            )}
            {show('stat-leave') && (
              <StatCard
                title="On Leave Today"
                value={stats.onLeaveToday}
                change={`${stats.pendingLeaveApprovals} pending approval`}
                icon={CalendarCheck}
                trend="neutral"
              />
            )}
            {show('stat-attendance') && (
              <StatCard
                title="Avg. Attendance"
                value={stats.avgAttendance === null ? '—' : `${stats.avgAttendance}%`}
                change={stats.attendanceRecords > 0 ? `${stats.attendanceRecords} records this month` : 'No data this month'}
                icon={Clock}
                trend="neutral"
              />
            )}
            {show('stat-payroll') && (
              <StatCard
                title="Payroll Budget"
                value={formatAmount(stats.payrollBudgetMonthly)}
                change={stats.payrollAssignedCount > 0 ? `${stats.payrollAssignedCount} salary structures · monthly` : 'No salary structures'}
                icon={TrendingUp}
                trend="neutral"
              />
            )}
          </div>
        )}

        {(show('payroll-trends') || show('poll')) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {show('payroll-trends') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card p-6 rounded-xl border border-border shadow-sm lg:col-span-2"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold">Payroll Trends</h2>
                  <button onClick={() => navigate('/payroll')} className="text-primary text-sm font-medium flex items-center gap-1">
                    View Details <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="h-[300px] w-full">
                  {hasPayroll ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={payrollTrend}>
                        <defs>
                          <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v: number) => formatAmount(v)}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        />
                        <Area type="monotone" dataKey="payroll" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPayroll)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyPanel message={loading ? 'Loading…' : 'No payroll has been processed yet.'} />
                  )}
                </div>
              </motion.div>
            )}

            {show('poll') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <PollWidget compact={false} />
              </motion.div>
            )}
          </div>
        )}

        {show('celebrations') && (
          <div className="mb-8">
            <CelebrationsWidget />
          </div>
        )}

        {(show('employee-growth') || show('recent-onboarding')) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {show('employee-growth') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-card p-6 rounded-xl border border-border shadow-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold">Employee Growth</h2>
                  <button onClick={() => navigate('/employees/directory')} className="text-primary text-sm font-medium flex items-center gap-1">
                    View Directory <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="h-[260px] w-full">
                  {hasGrowth ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={growth}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        />
                        <Bar dataKey="employees" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyPanel message={loading ? 'Loading…' : 'No employees yet — add one to see headcount growth.'} />
                  )}
                </div>
              </motion.div>
            )}

            {show('recent-onboarding') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-border flex justify-between items-center">
                  <h2 className="text-lg font-bold">Recent Onboarding</h2>
                  <button onClick={() => navigate('/employees/directory')} className="text-sm text-muted-foreground hover:text-primary transition-colors">View All</button>
                </div>
                {onboarding.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Employee</th>
                          <th className="px-6 py-4 font-semibold">Department</th>
                          <th className="px-6 py-4 font-semibold">Status</th>
                          <th className="px-6 py-4 font-semibold">Join Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {onboarding.map(emp => (
                          <tr key={emp.id} className="hover:bg-accent/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                  {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-medium">{emp.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">{emp.department}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                emp.status === 'Active' ? 'bg-green-100 text-green-700'
                                  : emp.status === 'On Leave' ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {emp.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">{formatJoinDate(emp.doj)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6"><EmptyPanel message={loading ? 'Loading…' : 'No employees onboarded yet.'} /></div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
