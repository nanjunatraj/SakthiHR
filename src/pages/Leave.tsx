import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Plus, Search, Filter, CheckCircle2, XCircle,
  Clock, AlertCircle, ChevronDown, X, FileText, User,
  Calendar, ArrowRight, BarChart2, TrendingUp, Inbox,
  Send, RefreshCw, Download, Eye, Pencil
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;
const initialsOf = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
type LeaveType = 'Casual Leave' | 'Sick Leave' | 'Earned Leave' | 'Maternity Leave' | 'Paternity Leave' | 'Unpaid Leave';

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  avatar: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  approvedBy?: string;
  remarks?: string;
  isHalfDay: boolean;
  managerStatus: string;
}

interface LeaveBalance {
  type: LeaveType;
  total: number;
  used: number;
  pending: number;
  available: number;
  color: string;
}

const LEAVE_TYPES: LeaveType[] = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave'];

const TYPE_COLORS: Record<LeaveType, { bg: string; text: string; border: string; dot: string }> = {
  'Casual Leave': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Sick Leave': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  'Earned Leave': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'Maternity Leave': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500' },
  'Paternity Leave': { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  'Unpaid Leave': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
};
const DEFAULT_TYPE_COLOR = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', dot: 'bg-gray-400' };
/** Style for a leave type, falling back gracefully for types not in the fixed palette. */
const typeColorOf = (t: LeaveType) => TYPE_COLORS[t] ?? DEFAULT_TYPE_COLOR;

const STATUS_STYLES: Record<LeaveStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  Approved: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle2 },
  Rejected: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
  Cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: X },
};

// Leave requests + balances are loaded live from the DB.
function rowToRequest(r: Record<string, any>): LeaveRequest {
  const emp = r.employee;
  const name = emp ? [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ') : '—';
  return {
    id: r.id,
    employeeId: r.employee_id ?? '',
    employeeName: name,
    department: emp?.department?.name ?? '—',
    avatar: initialsOf(name),
    leaveType: (r.leave_type?.name as LeaveType) ?? 'Casual Leave',
    fromDate: r.from_date ?? '',
    toDate: r.to_date ?? '',
    days: Number(r.days ?? 0),
    reason: r.reason ?? '',
    status: (r.status as LeaveStatus) ?? 'Pending',
    appliedOn: r.applied_on ?? r.created_at ?? '',
    remarks: r.remarks ?? undefined,
    isHalfDay: Boolean(r.is_half_day),
    managerStatus: (r.manager_status as string) ?? 'Pending',
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function calcDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const d1 = new Date(from + 'T00:00:00');
  const d2 = new Date(to + 'T00:00:00');
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";

interface FieldProps { label: string; required?: boolean; children: React.ReactNode; hint?: string; }
const Field = ({ label, required, children, hint }: FieldProps) => (
  <div>
    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

type ActiveView = 'my-leaves' | 'apply' | 'approvals';

export default function Leave() {
  const [activeView, setActiveView] = useState<ActiveView>('my-leaves');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<LeaveType | 'All'>('All');

  const [applyForm, setApplyForm] = useState({
    leaveType: 'Casual Leave' as LeaveType,
    fromDate: '',
    toDate: '',
    isHalfDay: false,
    reason: '',
    contactDuringLeave: '',
    handoverTo: '',
  });

  const [approvalModal, setApprovalModal] = useState<LeaveRequest | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [detailModal, setDetailModal] = useState<LeaveRequest | null>(null);

  const reload = async () => {
    const [reqRes, balRes] = await Promise.all([
      db.from('leave_requests').select('id, employee_id, from_date, to_date, days, is_half_day, reason, status, manager_status, applied_on, remarks, created_at, employee:employees(first_name, middle_name, last_name, department:departments(name)), leave_type:leave_types(name)').order('created_at', { ascending: false }),
      db.from('leave_balances').select('used, pending, opening_balance, accrued, closing_balance, leave_type:leave_types(name, color)'),
    ]);
    setRequests((reqRes.data ?? []).map(rowToRequest));
    setBalances(((balRes.data ?? []) as Record<string, any>[]).map(b => ({
      type: (b.leave_type?.name as LeaveType) ?? 'Casual Leave',
      total: Number(b.opening_balance ?? 0) + Number(b.accrued ?? 0),
      used: Number(b.used ?? 0),
      pending: Number(b.pending ?? 0),
      available: Number(b.closing_balance ?? 0),
      color: b.leave_type?.color ?? 'blue',
    })));
  };
  useEffect(() => { void reload(); }, []);

  const myRequests = useMemo(() =>
    requests.filter(r => r.employeeId === 'EMP001')
      .filter(r => statusFilter === 'All' || r.status === statusFilter)
      .filter(r => typeFilter === 'All' || r.leaveType === typeFilter),
    [requests, statusFilter, typeFilter]
  );

  const pendingApprovals = useMemo(() =>
    requests.filter(r => r.status === 'Pending' && r.employeeId !== 'EMP001')
      .filter(r => r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
        r.department.toLowerCase().includes(search.toLowerCase())),
    [requests, search]
  );

  const allRequests = useMemo(() =>
    requests
      .filter(r => r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
        r.department.toLowerCase().includes(search.toLowerCase()))
      .filter(r => statusFilter === 'All' || r.status === statusFilter)
      .filter(r => typeFilter === 'All' || r.leaveType === typeFilter),
    [requests, search, statusFilter, typeFilter]
  );

  const applyDays = applyForm.isHalfDay ? 0.5 : calcDays(applyForm.fromDate, applyForm.toDate);

  const handleApply = () => {
    if (!applyForm.fromDate || !applyForm.toDate) { toast.error('Please select leave dates.'); return; }
    if (!applyForm.reason.trim()) { toast.error('Please provide a reason for leave.'); return; }
    if (new Date(applyForm.fromDate) > new Date(applyForm.toDate)) { toast.error('From date must be before To date.'); return; }

    const newReq: LeaveRequest = {
      id: `LR${String(requests.length + 1).padStart(3, '0')}`,
      employeeId: 'EMP001',
      employeeName: 'Sarah Jenkins',
      department: 'Engineering',
      avatar: 'SJ',
      leaveType: applyForm.leaveType,
      fromDate: applyForm.fromDate,
      toDate: applyForm.toDate,
      days: applyDays,
      reason: applyForm.reason,
      status: 'Pending',
      appliedOn: new Date().toISOString().split('T')[0],
      isHalfDay: applyForm.isHalfDay,
      managerStatus: 'Pending',
    };
    setRequests(prev => [newReq, ...prev]);
    setApplyForm({ leaveType: 'Casual Leave', fromDate: '', toDate: '', isHalfDay: false, reason: '', contactDuringLeave: '', handoverTo: '' });
    toast.success('Leave request submitted successfully!');
    setActiveView('my-leaves');
  };

  const handleApprove = async (req: LeaveRequest) => {
    const { error } = await db.from('leave_requests').update({ status: 'Approved', remarks: approvalRemarks || null, approved_on: new Date().toISOString() }).eq('id', req.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Leave approved for ${req.employeeName}.`);
    setApprovalModal(null);
    setApprovalRemarks('');
    void reload();
  };

  const handleReject = async (req: LeaveRequest) => {
    if (!approvalRemarks.trim()) { toast.error('Please provide rejection remarks.'); return; }
    const { error } = await db.from('leave_requests').update({ status: 'Rejected', remarks: approvalRemarks }).eq('id', req.id);
    if (error) { toast.error(error.message); return; }
    toast.info(`Leave rejected for ${req.employeeName}.`);
    setApprovalModal(null);
    setApprovalRemarks('');
    void reload();
  };

  const handleCancel = async (id: string) => {
    const { error } = await db.from('leave_requests').update({ status: 'Cancelled' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.info('Leave request cancelled.');
    void reload();
  };

  const pendingCount = requests.filter(r => r.status === 'Pending' && r.employeeId !== 'EMP001').length;

  const navItems: { key: ActiveView; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'my-leaves', label: 'My Leaves', icon: CalendarDays },
    { key: 'apply', label: 'Apply Leave', icon: Plus },
    { key: 'approvals', label: 'Approvals', icon: Inbox, badge: pendingCount },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><CalendarDays size={22} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Leave Management</h1>
                <p className="text-xs text-muted-foreground">Apply, track, and approve employee leave requests.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeView === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveView(item.key)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                  >
                    <Icon size={16} />
                    {item.label}
                    {item.badge ? (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Requests', value: requests.filter(r => r.employeeId === 'EMP001').length, sub: 'This year', color: 'bg-blue-100', iconColor: 'text-blue-600', icon: CalendarDays },
              { label: 'Pending', value: requests.filter(r => r.employeeId === 'EMP001' && r.status === 'Pending').length, sub: 'Awaiting approval', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: Clock },
              { label: 'Approved', value: requests.filter(r => r.employeeId === 'EMP001' && r.status === 'Approved').length, sub: 'This year', color: 'bg-green-100', iconColor: 'text-green-600', icon: CheckCircle2 },
              { label: 'Available Balance', value: balances.reduce((s, b) => s + b.available, 0) + 'd', sub: 'Across all types', color: 'bg-violet-100', iconColor: 'text-violet-600', icon: BarChart2 },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={20} className={card.iconColor} /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="font-bold text-lg mt-0.5">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── My Leaves View ── */}
            {activeView === 'my-leaves' && (
              <motion.div key="my-leaves" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                {/* Leave Balances */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                  <h2 className="font-bold text-base mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-primary" /> Leave Balance</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {balances.map(bal => {
                      const style = typeColorOf(bal.type);
                      const pct = bal.total > 0 ? ((bal.used / bal.total) * 100) : 0;
                      return (
                        <div key={bal.type} className={`p-4 rounded-xl border-2 ${style.bg} ${style.border}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold ${style.text}`}>{bal.type}</span>
                            <span className={`text-lg font-bold ${style.text}`}>{bal.available}d</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/60 rounded-full mb-2">
                            <div className={`h-full ${style.dot} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Used: {bal.used}d</span>
                            <span>Total: {bal.total}d</span>
                          </div>
                          {bal.pending > 0 && (
                            <p className="text-[10px] text-amber-600 font-medium mt-1">{bal.pending}d pending approval</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                  <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                    <option value="All">All Status</option>
                    {(['Pending', 'Approved', 'Rejected', 'Cancelled'] as LeaveStatus[]).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
                    <option value="All">All Types</option>
                    {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <div className="ml-auto">
                    <button onClick={() => setActiveView('apply')} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium shadow-sm">
                      <Plus size={15} /> Apply Leave
                    </button>
                  </div>
                </div>

                {/* My Requests */}
                {myRequests.length > 0 ? (
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Leave Type</th>
                            <th className="px-4 py-3 font-semibold">From</th>
                            <th className="px-4 py-3 font-semibold">To</th>
                            <th className="px-4 py-3 font-semibold">Days</th>
                            <th className="px-4 py-3 font-semibold">Reason</th>
                            <th className="px-4 py-3 font-semibold">Applied On</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {myRequests.map((req, i) => {
                            const typeStyle = typeColorOf(req.leaveType);
                            const statusStyle = STATUS_STYLES[req.status];
                            const StatusIcon = statusStyle.icon;
                            return (
                              <motion.tr key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-accent/30 transition-colors group">
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />
                                    {req.leaveType}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm font-medium">{formatDate(req.fromDate)}</p>
                                  {req.isHalfDay && <span className="text-[10px] text-amber-600 font-medium">Half Day</span>}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm font-medium">{formatDate(req.toDate)}</p>
                                </td>
                                <td className="px-4 py-3 font-bold text-sm">{req.days}d</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{req.reason}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(req.appliedOn)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                    <StatusIcon size={11} />
                                    {req.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => setDetailModal(req)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Eye size={13} /></button>
                                    {req.status === 'Pending' && (
                                      <button onClick={() => handleCancel(req.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X size={13} /></button>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                    <CalendarDays size={32} className="text-muted-foreground mx-auto mb-3" />
                    <p className="font-semibold text-muted-foreground">No leave requests found</p>
                    <button onClick={() => setActiveView('apply')} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto">
                      <Plus size={15} /> Apply Leave
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Apply Leave View ── */}
            {activeView === 'apply' && (
              <motion.div key="apply" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="max-w-2xl mx-auto">
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg"><Send size={18} className="text-primary" /></div>
                      <div>
                        <h2 className="font-bold">Apply for Leave</h2>
                        <p className="text-xs text-muted-foreground">Fill in the details to submit your leave request</p>
                      </div>
                    </div>
                    <div className="p-6 space-y-5">
                      <Field label="Leave Type" required>
                        <select className={selectCls} value={applyForm.leaveType} onChange={e => setApplyForm(f => ({ ...f, leaveType: e.target.value as LeaveType }))}>
                          {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </Field>

                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => setApplyForm(f => ({ ...f, isHalfDay: !f.isHalfDay }))}
                          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${applyForm.isHalfDay ? 'bg-primary' : 'bg-border'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${applyForm.isHalfDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm font-medium">Half Day Leave</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Field label="From Date" required>
                          <div className="relative">
                            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input type="date" className={`${inputCls} pl-9`} value={applyForm.fromDate} onChange={e => setApplyForm(f => ({ ...f, fromDate: e.target.value, toDate: applyForm.isHalfDay ? e.target.value : f.toDate }))} />
                          </div>
                        </Field>
                        <Field label="To Date" required>
                          <div className="relative">
                            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input type="date" className={`${inputCls} pl-9`} value={applyForm.toDate} disabled={applyForm.isHalfDay} onChange={e => setApplyForm(f => ({ ...f, toDate: e.target.value }))} />
                          </div>
                        </Field>
                      </div>

                      {applyForm.fromDate && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                          <CalendarDays size={13} />
                          <span>
                            Duration: <strong>{applyDays} day{applyDays !== 1 ? 's' : ''}</strong>
                            {applyForm.fromDate && applyForm.toDate && (
                              <span className="ml-2 text-blue-600">({formatDate(applyForm.fromDate)} → {formatDate(applyForm.toDate)})</span>
                            )}
                          </span>
                        </div>
                      )}

                      <Field label="Reason for Leave" required>
                        <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Briefly describe the reason for your leave..." value={applyForm.reason} onChange={e => setApplyForm(f => ({ ...f, reason: e.target.value }))} />
                      </Field>

                      <Field label="Contact During Leave" hint="Phone number or email where you can be reached">
                        <input type="text" className={inputCls} placeholder="+91 98765 43210" value={applyForm.contactDuringLeave} onChange={e => setApplyForm(f => ({ ...f, contactDuringLeave: e.target.value }))} />
                      </Field>

                      <Field label="Handover To" hint="Employee handling your responsibilities during leave">
                        <input type="text" className={inputCls} placeholder="Employee name" value={applyForm.handoverTo} onChange={e => setApplyForm(f => ({ ...f, handoverTo: e.target.value }))} />
                      </Field>
                    </div>
                    <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                      <button onClick={() => setActiveView('my-leaves')} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                      <button onClick={handleApply} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                        <Send size={15} /> Submit Request
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Approvals View ── */}
            {activeView === 'approvals' && (
              <motion.div key="approvals" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
                <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input type="text" placeholder="Search by employee or department..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                    <option value="All">All Status</option>
                    {(['Pending', 'Approved', 'Rejected', 'Cancelled'] as LeaveStatus[]).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {pendingApprovals.length > 0 && (
                  <div>
                    <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                      <Clock size={15} className="text-amber-500" />
                      Pending Approvals ({pendingApprovals.length})
                    </h3>
                    <div className="space-y-3">
                      {pendingApprovals.map((req, i) => {
                        const typeStyle = typeColorOf(req.leaveType);
                        return (
                          <motion.div key={req.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="bg-card rounded-xl border border-border shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-all">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">{req.avatar}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-sm">{req.employeeName}</p>
                                <span className="text-xs text-muted-foreground">{req.department}</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                                  {req.leaveType}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${req.managerStatus === 'Approved' ? 'bg-green-100 text-green-700 border-green-200' : req.managerStatus === 'Rejected' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`} title="Reporting manager's first-level recommendation">
                                  Mgr: {req.managerStatus}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDate(req.fromDate)} {req.fromDate !== req.toDate ? `→ ${formatDate(req.toDate)}` : ''} · {req.days}d · Applied {formatDate(req.appliedOn)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{req.reason}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => { setApprovalModal(req); setApprovalRemarks(''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
                                <Eye size={12} /> Review
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All Requests Table */}
                <div>
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><FileText size={15} className="text-primary" /> All Leave Requests</h3>
                  <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Employee</th>
                            <th className="px-4 py-3 font-semibold">Leave Type</th>
                            <th className="px-4 py-3 font-semibold">From</th>
                            <th className="px-4 py-3 font-semibold">To</th>
                            <th className="px-4 py-3 font-semibold">Days</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {allRequests.map((req, i) => {
                            const typeStyle = typeColorOf(req.leaveType);
                            const statusStyle = STATUS_STYLES[req.status];
                            const StatusIcon = statusStyle.icon;
                            return (
                              <tr key={req.id} className="hover:bg-accent/30 transition-colors group">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">{req.avatar}</div>
                                    <div>
                                      <p className="text-sm font-medium">{req.employeeName}</p>
                                      <p className="text-[10px] text-muted-foreground">{req.department}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                                    {req.leaveType}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(req.fromDate)}</td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(req.toDate)}</td>
                                <td className="px-4 py-3 font-bold text-sm">{req.days}d</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                    <StatusIcon size={10} />{req.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setDetailModal(req)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Eye size={13} /></button>
                                    {req.status === 'Pending' && (
                                      <button onClick={() => { setApprovalModal(req); setApprovalRemarks(''); }} className="p-1.5 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors"><CheckCircle2 size={13} /></button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Approval Modal */}
      <AnimatePresence>
        {approvalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">Review Leave Request</h2>
                <button onClick={() => setApprovalModal(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-accent/30 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">{approvalModal.avatar}</div>
                  <div>
                    <p className="font-bold">{approvalModal.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{approvalModal.department} · {approvalModal.employeeId}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-accent/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Leave Type</p><p className="font-semibold">{approvalModal.leaveType}</p></div>
                  <div className="p-3 bg-accent/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Duration</p><p className="font-semibold">{approvalModal.days} day{approvalModal.days !== 1 ? 's' : ''}</p></div>
                  <div className="p-3 bg-accent/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">From</p><p className="font-semibold">{formatDate(approvalModal.fromDate)}</p></div>
                  <div className="p-3 bg-accent/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">To</p><p className="font-semibold">{formatDate(approvalModal.toDate)}</p></div>
                  <div className="p-3 bg-accent/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Applied On</p><p className="font-semibold">{formatDate(approvalModal.appliedOn)}</p></div>
                </div>
                <div className="p-3 bg-accent/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Reason</p><p className="text-sm">{approvalModal.reason}</p></div>
                <Field label="Remarks">
                  <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Add remarks (required for rejection)..." value={approvalRemarks} onChange={e => setApprovalRemarks(e.target.value)} />
                </Field>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => handleReject(approvalModal)} className="flex items-center gap-2 px-5 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium hover:bg-destructive/20 transition-colors">
                  <XCircle size={15} /> Reject
                </button>
                <button onClick={() => handleApprove(approvalModal)} className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                  <CheckCircle2 size={15} /> Approve
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">Leave Details — {detailModal.id}</h2>
                <button onClick={() => setDetailModal(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-3">
                {[
                  { label: 'Employee', value: `${detailModal.employeeName} (${detailModal.employeeId})` },
                  { label: 'Department', value: detailModal.department },
                  { label: 'Leave Type', value: detailModal.leaveType },
                  { label: 'From', value: formatDate(detailModal.fromDate) },
                  { label: 'To', value: formatDate(detailModal.toDate) },
                  { label: 'Days', value: `${detailModal.days} day${detailModal.days !== 1 ? 's' : ''}${detailModal.isHalfDay ? ' (Half Day)' : ''}` },
                  { label: 'Applied On', value: formatDate(detailModal.appliedOn) },
                  { label: 'Status', value: detailModal.status },
                  ...(detailModal.approvedBy ? [{ label: 'Approved By', value: detailModal.approvedBy }] : []),
                  ...(detailModal.remarks ? [{ label: 'Remarks', value: detailModal.remarks }] : []),
                ].map(row => (
                  <div key={row.label} className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide w-28 shrink-0">{row.label}</span>
                    <span className="text-sm font-medium text-right">{row.value}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Reason</p>
                  <p className="text-sm">{detailModal.reason}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}