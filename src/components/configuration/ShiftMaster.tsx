import React, { useState, useMemo } from 'react';
import { useTable } from '../../hooks/useTable';
import { motion, AnimatePresence } from 'framer-motion';
import BulkImport, { type CsvColumn } from './BulkImport';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  Save,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Timer,
  Coffee,
  TrendingUp,
  Moon,
  Sun,
  Sunset,
  Users,
  Copy,
  Info,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';

type ShiftCategory = 'General' | 'Morning' | 'Afternoon' | 'Night' | 'Rotational' | 'Flexible';
type OvertimePolicy = 'None' | 'After Shift Hours' | 'After Daily Limit' | 'After Weekly Limit';

interface OvertimeRule {
  policy: OvertimePolicy;
  dailyLimitHours: number;
  weeklyLimitHours: number;
  overtimeMultiplier: number;
  maxOvertimeHoursPerDay: number;
  requiresApproval: boolean;
}

// A single user-configurable break within a shift (Short Break, Lunch, Tea, …).
interface ShiftBreak {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  paid: boolean;
}

const totalBreakMinutes = (breaks: ShiftBreak[]) => breaks.reduce((s, b) => s + (Number(b.durationMinutes) || 0), 0);

let _brkSeq = 0;
const newBreak = (preset: Partial<ShiftBreak> = {}): ShiftBreak => ({
  id: `brk-${Date.now()}-${_brkSeq++}`, name: '', startTime: '', endTime: '', durationMinutes: 0, paid: false, ...preset,
});

// Quick-add presets shown in the break editor.
const BREAK_PRESETS: { label: string; preset: Partial<ShiftBreak> }[] = [
  { label: 'Short Break', preset: { name: 'Short Break', durationMinutes: 15, paid: true } },
  { label: 'Tea Break', preset: { name: 'Tea Break', durationMinutes: 10, paid: true } },
  { label: 'Lunch Break', preset: { name: 'Lunch Break', durationMinutes: 45, paid: false } },
  { label: 'Long Break', preset: { name: 'Long Break', durationMinutes: 60, paid: false } },
];

interface Shift {
  id: string;
  name: string;
  code: string;
  category: ShiftCategory;
  startTime: string;
  endTime: string;
  breaks: ShiftBreak[];
  // Aggregate (sum of break durations) + first-break times — kept for display/calc & legacy columns.
  breakDurationMinutes: number;
  breakStartTime: string;
  breakEndTime: string;
  applicableDays: number[];
  gracePeriodMinutes: number;
  halfDayHours: number;
  minimumHoursForFullDay: number;
  overtimeRule: OvertimeRule;
  description: string;
  status: 'Active' | 'Inactive';
  color: string;
  createdAt: string;
}

// ─── Supabase row mapping (shifts table) ────────────────────────────────────────
type DbShiftRow = Record<string, unknown> & { id: string };
const hhmm = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : '');

function rowToShift(r: DbShiftRow): Shift {
  const rawBreaks = Array.isArray(r.breaks) ? (r.breaks as Record<string, unknown>[]) : [];
  let breaks: ShiftBreak[] = rawBreaks.map((b, i) => ({
    id: (b.id as string) ?? `brk-${i}`,
    name: (b.name as string) ?? '',
    startTime: hhmm(b.startTime),
    endTime: hhmm(b.endTime),
    durationMinutes: Number(b.durationMinutes ?? 0),
    paid: Boolean(b.paid),
  }));
  // Fallback: synthesise one break from legacy break_* columns for older rows.
  if (breaks.length === 0 && Number(r.break_duration_minutes ?? 0) > 0) {
    breaks = [{ id: 'brk-legacy', name: 'Break', startTime: hhmm(r.break_start_time), endTime: hhmm(r.break_end_time), durationMinutes: Number(r.break_duration_minutes ?? 0), paid: false }];
  }
  return {
    id: r.id,
    name: (r.name as string) ?? '',
    code: (r.code as string) ?? '',
    category: (r.category as ShiftCategory) ?? 'General',
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    breaks,
    breakDurationMinutes: totalBreakMinutes(breaks),
    breakStartTime: breaks[0]?.startTime ?? '',
    breakEndTime: breaks[0]?.endTime ?? '',
    applicableDays: (r.applicable_days as number[]) ?? [],
    gracePeriodMinutes: Number(r.grace_period_minutes ?? 0),
    halfDayHours: Number(r.half_day_hours ?? 0),
    minimumHoursForFullDay: Number(r.minimum_hours_full_day ?? 0),
    overtimeRule: {
      policy: (r.overtime_policy as OvertimePolicy) ?? 'None',
      dailyLimitHours: Number(r.overtime_daily_limit_hours ?? 0),
      weeklyLimitHours: Number(r.overtime_weekly_limit_hours ?? 0),
      overtimeMultiplier: Number(r.overtime_multiplier ?? 0),
      maxOvertimeHoursPerDay: Number(r.overtime_max_hours_per_day ?? 0),
      requiresApproval: Boolean(r.overtime_requires_approval),
    },
    description: (r.description as string) ?? '',
    status: (r.status as 'Active' | 'Inactive') ?? 'Active',
    color: (r.color as string) ?? '',
    createdAt: r.created_at ? new Date(r.created_at as string).toLocaleDateString('en-IN') : '',
  };
}

function shiftFormToRow(f: ShiftFormData): Record<string, unknown> {
  return {
    name: f.name.trim(),
    code: f.code.trim(),
    category: f.category || null,
    start_time: f.startTime || null,
    end_time: f.endTime || null,
    breaks: f.breaks.map(b => ({
      id: b.id, name: b.name.trim() || 'Break', startTime: b.startTime || '', endTime: b.endTime || '',
      durationMinutes: Number(b.durationMinutes) || 0, paid: b.paid,
    })),
    break_duration_minutes: totalBreakMinutes(f.breaks),
    break_start_time: f.breaks[0]?.startTime || null,
    break_end_time: f.breaks[0]?.endTime || null,
    applicable_days: f.applicableDays,
    grace_period_minutes: f.gracePeriodMinutes || 0,
    half_day_hours: f.halfDayHours || 0,
    minimum_hours_full_day: f.minimumHoursForFullDay || 0,
    overtime_policy: f.overtimeRule.policy || null,
    overtime_daily_limit_hours: f.overtimeRule.dailyLimitHours || 0,
    overtime_weekly_limit_hours: f.overtimeRule.weeklyLimitHours || 0,
    overtime_multiplier: f.overtimeRule.overtimeMultiplier || 0,
    overtime_max_hours_per_day: f.overtimeRule.maxOvertimeHoursPerDay || 0,
    overtime_requires_approval: f.overtimeRule.requiresApproval,
    description: f.description?.trim() || null,
    status: f.status,
    color: f.color || null,
  };
}

const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

const SHIFT_CATEGORIES: ShiftCategory[] = ['General', 'Morning', 'Afternoon', 'Night', 'Rotational', 'Flexible'];

const OVERTIME_POLICIES: OvertimePolicy[] = [
  'None',
  'After Shift Hours',
  'After Daily Limit',
  'After Weekly Limit',
];

const SHIFT_COLORS = [
  { value: 'blue', label: 'Blue', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  { value: 'emerald', label: 'Green', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { value: 'violet', label: 'Purple', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { value: 'rose', label: 'Rose', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { value: 'cyan', label: 'Cyan', bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
];

const CATEGORY_ICONS: Record<ShiftCategory, React.ElementType> = {
  General: Clock,
  Morning: Sun,
  Afternoon: Sunset,
  Night: Moon,
  Rotational: Calendar,
  Flexible: Timer,
};

const CATEGORY_STYLES: Record<ShiftCategory, { bg: string; text: string; border: string }> = {
  General: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Morning: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  Afternoon: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  Night: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  Rotational: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  Flexible: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
};

function todayFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

function getColorStyle(colorValue: string) {
  return SHIFT_COLORS.find(c => c.value === colorValue) ?? SHIFT_COLORS[0];
}

function formatTime(time: string): string {
  if (!time) return '—';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function calculateShiftHours(startTime: string, endTime: string, breakMinutes: number): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;
  const totalMins = endMins - startMins - breakMinutes;
  return Math.max(0, totalMins / 60);
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

const Field = ({ label, required, children, hint }: FieldProps) => (
  <div>
    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accentColor?: string;
  accentBg?: string;
}

const SectionHeader = ({ icon: Icon, title, subtitle, accentColor = 'text-primary', accentBg = 'bg-primary/10' }: SectionHeaderProps) => (
  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border">
    <div className={`p-2 ${accentBg} rounded-lg shrink-0`}>
      <Icon size={16} className={accentColor} />
    </div>
    <div>
      <h3 className="font-bold text-sm">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

const Modal = ({ title, onClose, children, wide }: ModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 16 }}
      className={`bg-card w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} rounded-2xl shadow-2xl border border-border overflow-hidden`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <X size={20} />
        </button>
      </div>
      {children}
    </motion.div>
  </div>
);

interface ShiftCardProps {
  shift: Shift;
  onEdit: (s: Shift) => void;
  onDelete: (id: string) => void;
  onDuplicate: (s: Shift) => void;
  onToggleStatus: (id: string) => void;
}

const ShiftCard = ({ shift, onEdit, onDelete, onDuplicate, onToggleStatus }: ShiftCardProps) => {
  const colorStyle = getColorStyle(shift.color);
  const CategoryIcon = CATEGORY_ICONS[shift.category];
  const catStyle = CATEGORY_STYLES[shift.category];
  const shiftHours = calculateShiftHours(shift.startTime, shift.endTime, shift.breakDurationMinutes);
  const isOvernight = shift.endTime <= shift.startTime;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -3 }}
      className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all group overflow-hidden"
    >
      <div className={`h-1.5 w-full ${colorStyle.dot}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${colorStyle.bg} flex items-center justify-center`}>
              <CategoryIcon size={22} className={colorStyle.text} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">{shift.name}</h3>
                {isOvernight && (
                  <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                    Overnight
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{shift.code}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                  {shift.category}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onToggleStatus(shift.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              shift.status === 'Active'
                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${shift.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} />
            {shift.status}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-accent/40 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Start</p>
            <p className="text-sm font-bold">{formatTime(shift.startTime)}</p>
          </div>
          <div className="bg-accent/40 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">End</p>
            <p className="text-sm font-bold">{formatTime(shift.endTime)}</p>
          </div>
          <div className={`${colorStyle.bg} rounded-lg p-3 text-center`}>
            <p className={`text-[10px] font-medium uppercase tracking-wide mb-1 ${colorStyle.text}`}>Duration</p>
            <p className={`text-sm font-bold ${colorStyle.text}`}>{formatHours(shiftHours)}</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Coffee size={12} /> Break{shift.breaks.length !== 1 ? 's' : ''}
            </span>
            <span className="font-semibold">
              {shift.breaks.length === 0 ? '—' : `${shift.breaks.length} · ${shift.breakDurationMinutes}m total`}
            </span>
          </div>
          {shift.breaks.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              {shift.breaks.map(b => (
                <span key={b.id} className="text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  {b.name || 'Break'} {b.durationMinutes}m{b.paid ? ' · Paid' : ''}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Timer size={12} /> Grace Period
            </span>
            <span className="font-semibold">{shift.gracePeriodMinutes} min</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <TrendingUp size={12} /> Overtime
            </span>
            <span className="font-semibold">
              {shift.overtimeRule.policy === 'None' ? 'Not applicable' : `${shift.overtimeRule.overtimeMultiplier}× — ${shift.overtimeRule.policy}`}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Applicable Days</p>
          <div className="flex gap-1 flex-wrap">
            {WEEKDAYS.map(day => {
              const isApplicable = shift.applicableDays.includes(day.value);
              return (
                <span
                  key={day.value}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                    isApplicable
                      ? `${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`
                      : 'bg-accent/30 text-muted-foreground/40 border-border'
                  }`}
                >
                  {day.short}
                </span>
              );
            })}
          </div>
        </div>

        {shift.description && (
          <p className="text-[11px] text-muted-foreground italic mb-4 truncate">{shift.description}</p>
        )}

        <div className="flex items-center gap-1 pt-3 border-t border-border">
          <button
            onClick={() => onEdit(shift)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={() => onDuplicate(shift)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors"
          >
            <Copy size={12} /> Duplicate
          </button>
          <button
            onClick={() => onDelete(shift.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface ShiftFormData {
  name: string;
  code: string;
  category: ShiftCategory | '';
  startTime: string;
  endTime: string;
  breaks: ShiftBreak[];
  applicableDays: number[];
  gracePeriodMinutes: number;
  halfDayHours: number;
  minimumHoursForFullDay: number;
  overtimeRule: OvertimeRule;
  description: string;
  status: 'Active' | 'Inactive';
  color: string;
}

// No preset/default values — a new shift starts empty and is filled by the user.
const emptyShiftForm = (): ShiftFormData => ({
  name: '',
  code: '',
  category: '',
  startTime: '',
  endTime: '',
  breaks: [],
  applicableDays: [],
  gracePeriodMinutes: 0,
  halfDayHours: 0,
  minimumHoursForFullDay: 0,
  overtimeRule: {
    policy: 'None',
    dailyLimitHours: 0,
    weeklyLimitHours: 0,
    overtimeMultiplier: 0,
    maxOvertimeHoursPerDay: 0,
    requiresApproval: false,
  },
  description: '',
  status: 'Active',
  color: '',
});

const SHIFT_CSV_COLUMNS: CsvColumn[] = [
  { header: 'Name', required: true, example: 'General Shift' },
  { header: 'Code', required: true, example: 'GEN' },
  { header: 'Category', example: 'General', hint: SHIFT_CATEGORIES.join(' / ') },
  { header: 'Start Time', example: '09:00', hint: '24h HH:MM' },
  { header: 'End Time', example: '18:00', hint: '24h HH:MM' },
  { header: 'Break Duration Minutes', example: '60', hint: 'Number' },
  { header: 'Applicable Days', example: '1,2,3,4,5', hint: '0=Sun … 6=Sat, separated by spaces/semicolons (quote if using commas)' },
  { header: 'Grace Period Minutes', example: '15', hint: 'Number' },
  { header: 'Description', example: 'Standard day shift' },
  { header: 'Status', example: 'Active', hint: 'Active or Inactive' },
];

interface ShiftFormModalProps {
  title: string;
  form: ShiftFormData;
  onChange: (key: keyof ShiftFormData, value: any) => void;
  onOvertimeChange: (key: keyof OvertimeRule, value: any) => void;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
}

const ShiftFormModal = ({ title, form, onChange, onOvertimeChange, onSave, onClose, saveLabel }: ShiftFormModalProps) => {
  const totalBreak = totalBreakMinutes(form.breaks);
  const shiftHours = calculateShiftHours(form.startTime, form.endTime, totalBreak);
  const isOvernight = form.endTime && form.startTime && form.endTime <= form.startTime;

  // ── Multiple-break editor helpers ──
  const addBreak = (preset: Partial<ShiftBreak> = {}) => onChange('breaks', [...form.breaks, newBreak(preset)]);
  const updateBreak = (id: string, patch: Partial<ShiftBreak>) => onChange('breaks', form.breaks.map(b => {
    if (b.id !== id) return b;
    const next = { ...b, ...patch };
    // Auto-fill duration from start/end times when both are set.
    if (('startTime' in patch || 'endTime' in patch) && next.startTime && next.endTime) {
      const [sh, sm] = next.startTime.split(':').map(Number);
      const [eh, em] = next.endTime.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      next.durationMinutes = mins;
    }
    return next;
  }));
  const removeBreak = (id: string) => onChange('breaks', form.breaks.filter(b => b.id !== id));

  const toggleDay = (day: number) => {
    const days = form.applicableDays.includes(day)
      ? form.applicableDays.filter(d => d !== day)
      : [...form.applicableDays, day];
    onChange('applicableDays', days);
  };

  const selectAllWeekdays = () => onChange('applicableDays', [1, 2, 3, 4, 5]);
  const selectAllDays = () => onChange('applicableDays', [0, 1, 2, 3, 4, 5, 6]);
  const clearDays = () => onChange('applicableDays', []);

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
        <div>
          <SectionHeader icon={Clock} title="Shift Identity" subtitle="Name, code, category and color" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Shift Name" required>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. General Shift, Morning Shift"
                  value={form.name}
                  onChange={e => onChange('name', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Shift Code" required hint="Short unique identifier (e.g. GEN, MRN, NGT)">
              <input
                type="text"
                className={`${inputCls} font-mono uppercase`}
                placeholder="e.g. GEN"
                maxLength={6}
                value={form.code}
                onChange={e => onChange('code', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Category" required>
              <select
                className={selectCls}
                value={form.category}
                onChange={e => onChange('category', e.target.value as ShiftCategory)}
              >
                {SHIFT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={selectCls}
                value={form.status}
                onChange={e => onChange('status', e.target.value as 'Active' | 'Inactive')}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </Field>
            <Field label="Shift Color">
              <div className="flex gap-2 flex-wrap">
                {SHIFT_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => onChange('color', c.value)}
                    title={c.label}
                    className={`w-8 h-8 rounded-lg ${c.dot} border-2 transition-all ${
                      form.color === c.value ? 'border-foreground scale-110 shadow-md' : 'border-transparent hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Brief description of this shift"
                  value={form.description}
                  onChange={e => onChange('description', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        <div>
          <SectionHeader icon={Timer} title="Shift Timing" subtitle="Start time, end time and shift duration" accentColor="text-blue-600" accentBg="bg-blue-50" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Start Time" required>
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="time"
                  className={`${inputCls} pl-9`}
                  value={form.startTime}
                  onChange={e => onChange('startTime', e.target.value)}
                />
              </div>
            </Field>
            <Field label="End Time" required>
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="time"
                  className={`${inputCls} pl-9`}
                  value={form.endTime}
                  onChange={e => onChange('endTime', e.target.value)}
                />
              </div>
            </Field>

            {form.startTime && form.endTime && (
              <div className="md:col-span-2">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isOvernight ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'}`}>
                  {isOvernight ? <Moon size={15} className="text-indigo-600 shrink-0" /> : <Sun size={15} className="text-blue-600 shrink-0" />}
                  <div className="flex-1">
                    <p className={`text-xs font-semibold ${isOvernight ? 'text-indigo-700' : 'text-blue-700'}`}>
                      {isOvernight ? 'Overnight Shift' : 'Same-Day Shift'} — Net Working Hours: <strong>{formatHours(shiftHours)}</strong>
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isOvernight ? 'text-indigo-600' : 'text-blue-600'}`}>
                      {formatTime(form.startTime)} → {formatTime(form.endTime)} · {totalBreak}m break deducted
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Field label="Grace Period (minutes)" hint="Allowed late arrival without marking as late">
              <div className="relative">
                <Timer size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  className={`${inputCls} pl-9`}
                  min={0}
                  max={60}
                  value={form.gracePeriodMinutes}
                  onChange={e => onChange('gracePeriodMinutes', parseInt(e.target.value) || 0)}
                />
              </div>
            </Field>
            <Field label="Minimum Hours for Full Day" hint="Minimum hours to count as a full working day">
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  className={`${inputCls} pl-9`}
                  min={1}
                  max={24}
                  step={0.5}
                  value={form.minimumHoursForFullDay}
                  onChange={e => onChange('minimumHoursForFullDay', parseFloat(e.target.value) || 0)}
                />
              </div>
            </Field>
            <Field label="Half Day Hours" hint="Hours threshold to mark as half day">
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  className={`${inputCls} pl-9`}
                  min={1}
                  max={12}
                  step={0.5}
                  value={form.halfDayHours}
                  onChange={e => onChange('halfDayHours', parseFloat(e.target.value) || 0)}
                />
              </div>
            </Field>
          </div>
        </div>

        <div>
          <SectionHeader icon={Coffee} title="Breaks" subtitle="Add one or more breaks — short break, lunch, tea, etc. Each can be paid or unpaid." accentColor="text-amber-600" accentBg="bg-amber-50" />

          {/* Quick-add presets */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-xs font-semibold text-muted-foreground">Quick add:</span>
            {BREAK_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => addBreak(p.preset)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <Plus size={11} /> {p.label}
              </button>
            ))}
            <button
              onClick={() => addBreak()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-muted-foreground border border-border hover:bg-accent/70 transition-colors"
            >
              <Plus size={11} /> Custom Break
            </button>
          </div>

          {form.breaks.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 bg-accent/40 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
              <Coffee size={13} /> No breaks added. Use the buttons above to add breaks (or leave empty for no breaks).
            </div>
          ) : (
            <div className="space-y-3">
              {form.breaks.map((brk, i) => (
                <div key={brk.id} className="bg-accent/30 border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-[11px] font-bold shrink-0">{i + 1}</span>
                    <input
                      type="text"
                      className={`${inputCls} py-2 flex-1`}
                      placeholder="Break name (e.g. Short Break, Lunch)"
                      value={brk.name}
                      onChange={e => updateBreak(brk.id, { name: e.target.value })}
                    />
                    <button
                      onClick={() => removeBreak(brk.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      title="Remove break"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field label="Start Time">
                      <input type="time" className={`${inputCls} py-2`} value={brk.startTime} onChange={e => updateBreak(brk.id, { startTime: e.target.value })} />
                    </Field>
                    <Field label="End Time">
                      <input type="time" className={`${inputCls} py-2`} value={brk.endTime} onChange={e => updateBreak(brk.id, { endTime: e.target.value })} />
                    </Field>
                    <Field label="Duration (min)">
                      <input type="number" min={0} max={240} step={5} className={`${inputCls} py-2`} value={brk.durationMinutes} onChange={e => updateBreak(brk.id, { durationMinutes: parseInt(e.target.value) || 0 })} />
                    </Field>
                    <Field label="Paid?">
                      <button
                        onClick={() => updateBreak(brk.id, { paid: !brk.paid })}
                        className={`w-full py-2 rounded-lg text-xs font-semibold border transition-colors ${brk.paid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                      >
                        {brk.paid ? 'Paid' : 'Unpaid'}
                      </button>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalBreak > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
              <Info size={12} className="shrink-0" />
              <span><strong>{form.breaks.length} break{form.breaks.length !== 1 ? 's' : ''}</strong> · total <strong>{totalBreak} minutes</strong> deducted from working hours.</span>
            </div>
          )}
        </div>

        <div>
          <SectionHeader icon={Calendar} title="Applicable Days" subtitle="Select the working days for this shift" accentColor="text-violet-600" accentBg="bg-violet-50" />
          <div className="flex items-center gap-2 mb-3">
            <button onClick={selectAllWeekdays} className="text-xs font-medium text-primary hover:underline">Mon–Fri</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={selectAllDays} className="text-xs font-medium text-primary hover:underline">All Days</button>
            <span className="text-muted-foreground">·</span>
            <button onClick={clearDays} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Clear</button>
            <span className="ml-auto text-xs text-muted-foreground">{form.applicableDays.length} day{form.applicableDays.length !== 1 ? 's' : ''} selected</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map(day => {
              const isSelected = form.applicableDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-accent/30 text-muted-foreground border-border hover:border-primary/40 hover:bg-accent/60'
                  }`}
                >
                  <span>{day.short}</span>
                  {isSelected && <CheckCircle2 size={12} />}
                </button>
              );
            })}
          </div>
          {form.applicableDays.length === 0 && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
              <AlertCircle size={12} />
              At least one working day must be selected.
            </div>
          )}
        </div>

        <div>
          <SectionHeader icon={TrendingUp} title="Overtime Rules" subtitle="Define overtime policy and multipliers" accentColor="text-rose-600" accentBg="bg-rose-50" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Overtime Policy" required>
                <select
                  className={selectCls}
                  value={form.overtimeRule.policy}
                  onChange={e => onOvertimeChange('policy', e.target.value as OvertimePolicy)}
                >
                  {OVERTIME_POLICIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>

            {form.overtimeRule.policy !== 'None' && (
              <>
                <Field label="Overtime Multiplier" hint="e.g. 1.5 = 1.5× regular pay">
                  <div className="relative">
                    <TrendingUp size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      className={`${inputCls} pl-9`}
                      min={1}
                      max={5}
                      step={0.25}
                      value={form.overtimeRule.overtimeMultiplier}
                      onChange={e => onOvertimeChange('overtimeMultiplier', parseFloat(e.target.value) || 1)}
                    />
                  </div>
                </Field>
                <Field label="Max Overtime Hours / Day" hint="Maximum overtime allowed per day">
                  <div className="relative">
                    <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      className={`${inputCls} pl-9`}
                      min={0}
                      max={12}
                      step={0.5}
                      value={form.overtimeRule.maxOvertimeHoursPerDay}
                      onChange={e => onOvertimeChange('maxOvertimeHoursPerDay', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </Field>

                {(form.overtimeRule.policy === 'After Daily Limit' || form.overtimeRule.policy === 'After Shift Hours') && (
                  <Field label="Daily Hour Limit" hint="Hours after which overtime kicks in">
                    <div className="relative">
                      <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="number"
                        className={`${inputCls} pl-9`}
                        min={1}
                        max={24}
                        step={0.5}
                        value={form.overtimeRule.dailyLimitHours}
                        onChange={e => onOvertimeChange('dailyLimitHours', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </Field>
                )}

                {form.overtimeRule.policy === 'After Weekly Limit' && (
                  <Field label="Weekly Hour Limit" hint="Hours per week after which overtime kicks in">
                    <div className="relative">
                      <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="number"
                        className={`${inputCls} pl-9`}
                        min={1}
                        max={168}
                        step={0.5}
                        value={form.overtimeRule.weeklyLimitHours}
                        onChange={e => onOvertimeChange('weeklyLimitHours', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </Field>
                )}

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => onOvertimeChange('requiresApproval', !form.overtimeRule.requiresApproval)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${form.overtimeRule.requiresApproval ? 'bg-primary' : 'bg-border'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.overtimeRule.requiresApproval ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <div>
                      <span className="text-sm font-medium">Overtime Requires Approval</span>
                      <p className="text-[10px] text-muted-foreground">Manager must approve overtime before it is counted for payroll</p>
                    </div>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <TrendingUp size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-rose-700">
                      <p className="font-semibold mb-0.5">Overtime Summary</p>
                      <p>
                        Policy: <strong>{form.overtimeRule.policy}</strong> ·
                        Rate: <strong>{form.overtimeRule.overtimeMultiplier}×</strong> ·
                        Max/day: <strong>{form.overtimeRule.maxOvertimeHoursPerDay}h</strong>
                        {form.overtimeRule.requiresApproval && ' · Approval required'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {form.overtimeRule.policy === 'None' && (
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs text-muted-foreground">
                  <Info size={12} />
                  No overtime will be calculated for this shift.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
        <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button onClick={onSave} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
          {saveLabel}
        </button>
      </div>
    </Modal>
  );
};

interface ShiftMasterProps {
  onBack: () => void;
}

export default function ShiftMaster({ onBack }: ShiftMasterProps) {
  // Stored in and retrieved from the Supabase `shifts` table only.
  const shiftsTable = useTable<DbShiftRow>('shifts', { orderBy: { column: 'created_at', ascending: true } });
  const shifts = useMemo(() => shiftsTable.rows.map(rowToShift), [shiftsTable.rows]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ShiftCategory | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  const [shiftModal, setShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState<ShiftFormData>(emptyShiftForm());

  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'All' || s.category === categoryFilter;
      const matchStatus = statusFilter === 'All' || s.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [shifts, search, categoryFilter, statusFilter]);

  const openAddShift = () => {
    setEditingShift(null);
    setShiftForm(emptyShiftForm());
    setShiftModal(true);
  };

  const openEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftForm({
      name: shift.name,
      code: shift.code,
      category: shift.category,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breaks: shift.breaks.map(b => ({ ...b })),
      applicableDays: [...shift.applicableDays],
      gracePeriodMinutes: shift.gracePeriodMinutes,
      halfDayHours: shift.halfDayHours,
      minimumHoursForFullDay: shift.minimumHoursForFullDay,
      overtimeRule: { ...shift.overtimeRule },
      description: shift.description,
      status: shift.status,
      color: shift.color,
    });
    setShiftModal(true);
  };

  const handleDuplicate = (shift: Shift) => {
    setEditingShift(null);
    setShiftForm({
      name: `${shift.name} (Copy)`,
      code: `${shift.code}2`,
      category: shift.category,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breaks: shift.breaks.map(b => ({ ...b, id: `brk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
      applicableDays: [...shift.applicableDays],
      gracePeriodMinutes: shift.gracePeriodMinutes,
      halfDayHours: shift.halfDayHours,
      minimumHoursForFullDay: shift.minimumHoursForFullDay,
      overtimeRule: { ...shift.overtimeRule },
      description: shift.description,
      status: 'Inactive',
      color: shift.color,
    });
    setShiftModal(true);
    toast.info('Shift duplicated — review and save.');
  };

  const saveShift = async () => {
    if (!shiftForm.name) { toast.error('Shift name is required.'); return; }
    if (!shiftForm.code) { toast.error('Shift code is required.'); return; }
    if (!shiftForm.startTime || !shiftForm.endTime) { toast.error('Start and end times are required.'); return; }
    if (shiftForm.applicableDays.length === 0) { toast.error('At least one applicable day must be selected.'); return; }

    const codeExists = shifts.some(s =>
      s.code === shiftForm.code && (editingShift ? s.id !== editingShift.id : true)
    );
    if (codeExists) { toast.error('Shift code already exists. Please use a unique code.'); return; }

    const row = shiftFormToRow(shiftForm);
    const err = editingShift
      ? (await shiftsTable.update(editingShift.id, row)).error
      : (await shiftsTable.insert(row)).error;
    if (err) { toast.error(err); return; }
    toast.success(`Shift ${editingShift ? 'updated' : 'created'} successfully.`);
    setShiftModal(false);
  };

  // Map one CSV row → accepted shift fields (rest filled from defaults).
  const csvToShift = (cells: Record<string, string>): Record<string, unknown> | { error: string } => {
    const catRaw = (cells['Category'] || 'General').trim();
    const category = SHIFT_CATEGORIES.find(c => c.toLowerCase() === catRaw.toLowerCase());
    if (!category) return { error: `Invalid Category "${catRaw}"` };
    const timeRe = /^([01]?\d|2[0-3]):[0-5]\d$/;
    const start = (cells['Start Time'] || '09:00').trim();
    const end = (cells['End Time'] || '18:00').trim();
    if (!timeRe.test(start)) return { error: `Invalid Start Time "${start}" (use HH:MM)` };
    if (!timeRe.test(end)) return { error: `Invalid End Time "${end}" (use HH:MM)` };
    const statusRaw = (cells['Status'] || 'Active').trim();
    if (!/^(active|inactive)$/i.test(statusRaw)) return { error: `Invalid Status "${statusRaw}"` };
    const breakRaw = cells['Break Duration Minutes']?.trim();
    if (breakRaw && isNaN(Number(breakRaw))) return { error: `Break Duration Minutes "${breakRaw}" is not a number` };
    const graceRaw = cells['Grace Period Minutes']?.trim();
    if (graceRaw && isNaN(Number(graceRaw))) return { error: `Grace Period Minutes "${graceRaw}" is not a number` };

    let days = [1, 2, 3, 4, 5];
    const daysRaw = cells['Applicable Days']?.trim();
    if (daysRaw) {
      days = daysRaw.split(/[,;\s]+/).filter(Boolean).map(Number);
      if (days.some(d => isNaN(d) || d < 0 || d > 6)) return { error: `Applicable Days "${daysRaw}" must be numbers 0–6` };
    }
    if (shifts.some(s => s.code.toLowerCase() === cells['Code'].trim().toLowerCase())) {
      return { error: `Code "${cells['Code'].trim()}" already exists` };
    }
    const breakMins = breakRaw ? Number(breakRaw) : 0;
    return {
      name: cells['Name'].trim(),
      code: cells['Code'].trim(),
      category,
      startTime: start,
      endTime: end,
      breaks: breakMins > 0 ? [newBreak({ name: 'Break', durationMinutes: breakMins })] : [],
      applicableDays: days,
      gracePeriodMinutes: graceRaw ? Number(graceRaw) : 15,
      description: cells['Description']?.trim() || '',
      status: /^active$/i.test(statusRaw) ? 'Active' : 'Inactive',
    };
  };

  const importShift = async (rec: Record<string, unknown>): Promise<string | null> => {
    const form = { ...emptyShiftForm(), ...(rec as Partial<ShiftFormData>) };
    return (await shiftsTable.insert(shiftFormToRow(form))).error;
  };

  const deleteShift = async (id: string) => {
    const err = (await shiftsTable.remove(id)).error;
    if (err) { toast.error(err); return; }
    toast.info('Shift deleted.');
  };

  const toggleStatus = async (id: string) => {
    const s = shifts.find(x => x.id === id);
    if (!s) return;
    const err = (await shiftsTable.update(id, { status: s.status === 'Active' ? 'Inactive' : 'Active' })).error;
    if (err) toast.error(err);
  };

  const activeCount = shifts.filter(s => s.status === 'Active').length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock size={22} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-serif">Shift Master</h1>
                <p className="text-xs text-muted-foreground">Define work shifts with timing, breaks, and overtime rules.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BulkImport
                title="Shift"
                columns={SHIFT_CSV_COLUMNS}
                toRecord={csvToShift}
                insertRecord={importShift}
              />
              <button
                onClick={openAddShift}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"
              >
                <Plus size={16} /> Add Shift
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-blue-100 rounded-xl"><Clock size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Shifts</p>
                <p className="font-bold text-lg mt-0.5">{shifts.length}</p>
                <p className="text-[10px] text-muted-foreground">{activeCount} active</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-emerald-100 rounded-xl"><CheckCircle2 size={20} className="text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active Shifts</p>
                <p className="font-bold text-lg mt-0.5">{activeCount}</p>
                <p className="text-[10px] text-muted-foreground">{shifts.length - activeCount} inactive</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-violet-100 rounded-xl"><Calendar size={20} className="text-violet-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Shift Categories</p>
                <p className="font-bold text-lg mt-0.5">{new Set(shifts.map(s => s.category)).size}</p>
                <p className="text-[10px] text-muted-foreground">Unique types</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-rose-100 rounded-xl"><TrendingUp size={20} className="text-rose-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">With Overtime</p>
                <p className="font-bold text-lg mt-0.5">{shifts.filter(s => s.overtimeRule.policy !== 'None').length}</p>
                <p className="text-[10px] text-muted-foreground">Shifts configured</p>
              </div>
            </motion.div>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search shifts by name, code or description..."
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as ShiftCategory | 'All')}
            >
              <option value="All">All Categories</option>
              {SHIFT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
            >
              <option value="All">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 size={13} className="text-green-500" />
              <span>{filteredShifts.length} of {shifts.length} shifts</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter('All')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                categoryFilter === 'All'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-accent text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              All ({shifts.length})
            </button>
            {SHIFT_CATEGORIES.map(cat => {
              const count = shifts.filter(s => s.category === cat).length;
              if (count === 0) return null;
              const style = CATEGORY_STYLES[cat];
              const Icon = CATEGORY_ICONS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? 'All' : cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    categoryFilter === cat
                      ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-current`
                      : `${style.bg} ${style.text} ${style.border} hover:opacity-80`
                  }`}
                >
                  <Icon size={11} />
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {filteredShifts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredShifts.map(shift => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  onEdit={openEditShift}
                  onDelete={deleteShift}
                  onDuplicate={handleDuplicate}
                  onToggleStatus={toggleStatus}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Clock size={28} className="text-blue-600" />
              </div>
              <p className="font-semibold text-muted-foreground">
                {search || categoryFilter !== 'All' || statusFilter !== 'All'
                  ? 'No shifts match your filters'
                  : 'No shifts defined yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                {search || categoryFilter !== 'All' || statusFilter !== 'All'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create your first work shift to get started'}
              </p>
              {!search && categoryFilter === 'All' && statusFilter === 'All' && (
                <button
                  onClick={openAddShift}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto"
                >
                  <Plus size={15} /> Add Shift
                </button>
              )}
            </div>
          )}

          {shifts.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
                <Clock size={16} className="text-primary" />
                <h3 className="font-bold text-sm">Shift Overview Table</h3>
                <span className="ml-auto text-xs text-muted-foreground">{shifts.length} shifts defined</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Shift</th>
                      <th className="px-4 py-3 font-semibold">Timing</th>
                      <th className="px-4 py-3 font-semibold">Net Hours</th>
                      <th className="px-4 py-3 font-semibold">Break</th>
                      <th className="px-4 py-3 font-semibold">Days</th>
                      <th className="px-4 py-3 font-semibold">Overtime</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shifts.map((shift, i) => {
                      const colorStyle = getColorStyle(shift.color);
                      const catStyle = CATEGORY_STYLES[shift.category];
                      const shiftHours = calculateShiftHours(shift.startTime, shift.endTime, shift.breakDurationMinutes);
                      return (
                        <motion.tr
                          key={shift.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="hover:bg-accent/30 transition-colors group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-8 rounded-full ${colorStyle.dot}`} />
                              <div>
                                <p className="font-semibold text-sm">{shift.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{shift.code}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>{shift.category}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium">{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</p>
                            {shift.endTime <= shift.startTime && (
                              <span className="text-[10px] text-indigo-600 font-medium">Overnight</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${colorStyle.text}`}>{formatHours(shiftHours)}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{shift.breakDurationMinutes}m</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-0.5 flex-wrap max-w-[120px]">
                              {WEEKDAYS.map(day => (
                                <span
                                  key={day.value}
                                  className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                    shift.applicableDays.includes(day.value)
                                      ? `${colorStyle.bg} ${colorStyle.text}`
                                      : 'text-muted-foreground/30'
                                  }`}
                                >
                                  {day.short}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {shift.overtimeRule.policy === 'None' ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              <div>
                                <p className="text-xs font-medium">{shift.overtimeRule.overtimeMultiplier}× rate</p>
                                <p className="text-[10px] text-muted-foreground">{shift.overtimeRule.policy}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{shift.createdAt}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleStatus(shift.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                                shift.status === 'Active'
                                  ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${shift.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {shift.status}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditShift(shift)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDuplicate(shift)}
                                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                onClick={() => deleteShift(shift.id)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {shiftModal && (
          <ShiftFormModal
            title={editingShift ? `Edit Shift — ${editingShift.name}` : 'Create New Shift'}
            form={shiftForm}
            onChange={(key, val) => setShiftForm(f => ({ ...f, [key]: val }))}
            onOvertimeChange={(key, val) => setShiftForm(f => ({ ...f, overtimeRule: { ...f.overtimeRule, [key]: val } }))}
            onSave={saveShift}
            onClose={() => setShiftModal(false)}
            saveLabel={editingShift ? 'Save Changes' : 'Create Shift'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}