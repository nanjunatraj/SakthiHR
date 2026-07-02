import DateInput from '../DateInput';
import { formatDate as fmtTs } from '../../utils/date';
import React, { useState, useMemo, useEffect } from 'react';
import { useMasterAccess, ViewOnlyBanner } from './MasterAccess';
import { useTable } from '../../hooks/useTable';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  Save,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Repeat,
  Flag,
  Star,
  Filter,
  Download,
  ChevronDown,
  Sparkles,
  Info,
  Sun,
  Sunset
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';

type HolidayType = 'National' | 'Festival' | 'Regional' | 'Optional' | 'Weekly Off' | 'Half-Day Weekly Off';
type WeekSelection = 'all' | 'odd' | 'even';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  description: string;
  isRecurring: boolean;
  location: string;
  isHalfDay: boolean;
  halfDaySession?: 'morning' | 'afternoon';
}

interface HolidayList {
  id: string;
  name: string;
  year: number;
  fromDate: string;
  toDate: string;
  description: string;
  status: 'Active' | 'Draft' | 'Archived';
  holidays: Holiday[];
  createdAt: string;
}

const HOLIDAY_TYPES: HolidayType[] = ['National', 'Festival', 'Regional', 'Optional', 'Weekly Off', 'Half-Day Weekly Off'];

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const WEEK_SELECTION_OPTIONS: { value: WeekSelection; label: string; description: string }[] = [
  { value: 'all', label: 'All Weeks', description: 'Every occurrence of the selected weekday(s)' },
  { value: 'odd', label: 'Odd Weeks (1st, 3rd, 5th)', description: '1st, 3rd, and 5th occurrence in each month' },
  { value: 'even', label: 'Even Weeks (2nd, 4th)', description: '2nd and 4th occurrence in each month' },
];

const TYPE_STYLES: Record<HolidayType, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  'National': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: Flag },
  'Festival': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Star },
  'Regional': { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', icon: Flag },
  'Optional': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', icon: Calendar },
  'Weekly Off': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: Repeat },
  'Half-Day Weekly Off': { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', icon: Sunset },
};

const CURRENT_YEAR = new Date().getFullYear();

// ─── Supabase row mapping (holiday_lists + holidays tables) ─────────────────────
type DbHolidayListRow = Record<string, unknown> & { id: string };
type DbHolidayRow = Record<string, unknown> & { id: string; holiday_list_id: string };

function rowToHoliday(r: DbHolidayRow): Holiday {
  return {
    id: r.id,
    name: (r.name as string) ?? '',
    date: (r.holiday_date as string) ?? '',
    type: (r.type as HolidayType) ?? 'National',
    description: (r.description as string) ?? '',
    isRecurring: Boolean(r.is_recurring),
    location: (r.location as string) ?? 'All',
    isHalfDay: Boolean(r.is_half_day),
    halfDaySession: (r.half_day_session as 'morning' | 'afternoon') ?? 'afternoon',
  };
}

function holidayFormToRow(f: Omit<Holiday, 'id'>, listId: string): Record<string, unknown> {
  return {
    holiday_list_id: listId,
    name: f.name.trim(),
    holiday_date: f.date,
    type: f.type,
    description: f.description?.trim() || null,
    is_recurring: f.isRecurring,
    location: f.location || 'All',
    is_half_day: f.isHalfDay,
    half_day_session: f.isHalfDay ? (f.halfDaySession ?? 'afternoon') : null,
  };
}

function rowToHolidayList(r: DbHolidayListRow, holidays: Holiday[]): HolidayList {
  return {
    id: r.id,
    name: (r.name as string) ?? '',
    year: Number(r.year ?? CURRENT_YEAR),
    fromDate: (r.from_date as string) ?? '',
    toDate: (r.to_date as string) ?? '',
    description: (r.description as string) ?? '',
    status: (r.status as HolidayList['status']) ?? 'Active',
    holidays,
    createdAt: r.created_at ? fmtTs(r.created_at as string) : '',
  };
}

function listFormToRow(f: ListFormData): Record<string, unknown> {
  return {
    name: f.name.trim(),
    year: f.year,
    from_date: f.fromDate,
    to_date: f.toDate,
    description: f.description?.trim() || null,
    status: f.status,
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

function getDayName(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}

// Get the occurrence number of a weekday within its month (1st, 2nd, 3rd, etc.)
function getWeekOccurrenceInMonth(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfMonth = d.getDate();
  return Math.ceil(dayOfMonth / 7);
}

function generateWeeklyHolidays(
  fromDate: string,
  toDate: string,
  weekday: number,
  holidayName: string,
  isHalfDay: boolean,
  halfDaySession: 'morning' | 'afternoon',
  weekSelection: WeekSelection
): Holiday[] {
  const holidays: Holiday[] = [];
  const start = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T00:00:00');

  const current = new Date(start);
  while (current.getDay() !== weekday) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const occurrence = getWeekOccurrenceInMonth(dateStr);

    let include = false;
    if (weekSelection === 'all') {
      include = true;
    } else if (weekSelection === 'odd') {
      include = occurrence === 1 || occurrence === 3 || occurrence === 5;
    } else if (weekSelection === 'even') {
      include = occurrence === 2 || occurrence === 4;
    }

    if (include) {
      const dayLabel = WEEKDAYS.find(w => w.value === weekday)?.label ?? '';
      const weekLabel = weekSelection === 'all' ? '' : weekSelection === 'odd' ? ` (${occurrence}${occurrence === 1 ? 'st' : occurrence === 2 ? 'nd' : occurrence === 3 ? 'rd' : 'th'} ${dayLabel})` : ` (${occurrence}${occurrence === 2 ? 'nd' : 'th'} ${dayLabel})`;
      holidays.push({
        id: `WH-${weekday}-${dateStr}-${Math.random().toString(36).slice(2, 6)}`,
        name: holidayName || `${dayLabel} Off`,
        date: dateStr,
        type: isHalfDay ? 'Half-Day Weekly Off' : 'Weekly Off',
        description: isHalfDay
          ? `Half-day weekly off — ${halfDaySession === 'morning' ? 'Morning' : 'Afternoon'} session — ${dayLabel}${weekLabel}`
          : `Weekly off — ${dayLabel}${weekLabel}`,
        isRecurring: true,
        location: 'All',
        isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : undefined,
      });
    }
    current.setDate(current.getDate() + 7);
  }
  return holidays;
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

const TypeBadge = ({ type, isHalfDay }: { type: HolidayType; isHalfDay?: boolean }) => {
  const style = TYPE_STYLES[type];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
      <Icon size={10} />
      {isHalfDay ? 'Half-Day' : type}
    </span>
  );
};

interface HolidayRowProps {
  holiday: Holiday;
  index: number;
  onEdit: (h: Holiday) => void;
  onDelete: (id: string) => void;
}

const HolidayRow = ({ holiday, index, onEdit, onDelete }: HolidayRowProps) => (
  <motion.tr
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.02 }}
    className="hover:bg-accent/30 transition-colors group"
  >
    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{index + 1}</td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">{holiday.name}</span>
        {holiday.isRecurring && (
          <span title="Recurring" className="text-primary">
            <Repeat size={12} />
          </span>
        )}
        {holiday.isHalfDay && (
          <span className="text-[9px] font-bold bg-teal-100 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Sunset size={9} />
            {holiday.halfDaySession === 'morning' ? 'AM' : 'PM'}
          </span>
        )}
      </div>
      {holiday.description && (
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[220px]">{holiday.description}</p>
      )}
    </td>
    <td className="px-4 py-3">
      <div>
        <p className="text-sm font-medium">{formatDate(holiday.date)}</p>
        <p className="text-[11px] text-muted-foreground">{getDayName(holiday.date)}</p>
      </div>
    </td>
    <td className="px-4 py-3">
      <TypeBadge type={holiday.type} isHalfDay={holiday.isHalfDay} />
    </td>
    <td className="px-4 py-3 text-xs text-muted-foreground">{holiday.location || 'All'}</td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(holiday)}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(holiday.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </td>
  </motion.tr>
);

interface HolidayListCardProps {
  list: HolidayList;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const HolidayListCard = ({ list, isSelected, onSelect, onEdit, onDelete }: HolidayListCardProps) => {
  const nationalCount = list.holidays.filter(h => h.type === 'National').length;
  const festivalCount = list.holidays.filter(h => h.type === 'Festival').length;
  const weeklyCount = list.holidays.filter(h => h.type === 'Weekly Off').length;
  const halfDayWeeklyCount = list.holidays.filter(h => h.type === 'Half-Day Weekly Off').length;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      onClick={onSelect}
      className={`bg-card rounded-xl border-2 shadow-sm cursor-pointer transition-all overflow-hidden ${
        isSelected ? 'border-primary shadow-md' : 'border-border hover:border-primary/40'
      }`}
    >
      <div className={`h-1.5 w-full ${isSelected ? 'bg-primary' : 'bg-border'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-primary/10' : 'bg-accent'}`}>
              <CalendarDays size={20} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">{list.name}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{list.year} · Created {list.createdAt}</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            list.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' :
            list.status === 'Draft' ? 'bg-amber-100 text-amber-700 border-amber-200' :
            'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            {list.status}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
          <Calendar size={11} />
          <span>{formatDate(list.fromDate)}</span>
          <span>→</span>
          <span>{formatDate(list.toDate)}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
            {nationalCount} National
          </span>
          <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
            {festivalCount} Festival
          </span>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
            {weeklyCount} Weekly
          </span>
          {halfDayWeeklyCount > 0 && (
            <span className="text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
              {halfDayWeeklyCount} Half-Day
            </span>
          )}
          <span className="text-[10px] font-bold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
            {list.holidays.length} Total
          </span>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
          <button
            onClick={onSelect}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'
            }`}
          >
            {isSelected ? <CheckCircle2 size={12} /> : <ChevronDown size={12} />}
            {isSelected ? 'Viewing' : 'View Holidays'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface WeeklyGeneratorProps {
  fromDate: string;
  toDate: string;
  onGenerate: (holidays: Holiday[]) => void;
}

const WeeklyGenerator = ({ fromDate, toDate, onGenerate }: WeeklyGeneratorProps) => {
  const [selectedDays, setSelectedDays] = useState<number[]>([0]);
  const [holidayName, setHolidayName] = useState('Weekly Off');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState<'morning' | 'afternoon'>('afternoon');
  const [weekSelection, setWeekSelection] = useState<WeekSelection>('all');
  const [preview, setPreview] = useState<Holiday[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
    setShowPreview(false);
  };

  const handlePreview = () => {
    if (!fromDate || !toDate) {
      toast.error('Please set the holiday list period (From Date and To Date) first.');
      return;
    }
    if (selectedDays.length === 0) {
      toast.error('Please select at least one weekday.');
      return;
    }
    const all: Holiday[] = [];
    selectedDays.forEach(day => {
      all.push(...generateWeeklyHolidays(fromDate, toDate, day, holidayName, isHalfDay, halfDaySession, weekSelection));
    });
    all.sort((a, b) => a.date.localeCompare(b.date));
    setPreview(all);
    setShowPreview(true);
  };

  const handleGenerate = () => {
    if (preview.length === 0) {
      toast.error('Please preview first.');
      return;
    }
    onGenerate(preview);
    setShowPreview(false);
    setPreview([]);
    toast.success(`${preview.length} weekly holidays generated and added to the list.`);
  };

  const previewByMonth = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    preview.forEach(h => {
      const month = new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      if (!map[month]) map[month] = [];
      map[month].push(h);
    });
    return map;
  }, [preview]);

  // Estimate count based on week selection
  const estimatedCount = useMemo(() => {
    if (!fromDate || !toDate || selectedDays.length === 0) return 0;
    let total = 0;
    selectedDays.forEach(day => {
      const all = generateWeeklyHolidays(fromDate, toDate, day, '', false, 'afternoon', weekSelection);
      total += all.length;
    });
    return total;
  }, [fromDate, toDate, selectedDays, weekSelection]);

  return (
    <div className={`border-2 rounded-xl p-5 ${isHalfDay ? 'bg-teal-50 border-teal-200' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Repeat size={18} className={isHalfDay ? 'text-teal-600' : 'text-emerald-600'} />
        </div>
        <div>
          <h3 className={`font-bold text-sm ${isHalfDay ? 'text-teal-800' : 'text-emerald-800'}`}>Weekly Holiday Generator</h3>
          <p className={`text-[11px] ${isHalfDay ? 'text-teal-700' : 'text-emerald-700'}`}>
            Auto-generate weekly holidays with flexible week selection and half-day support.
          </p>
        </div>
        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${isHalfDay ? 'bg-teal-100 text-teal-700 border-teal-300' : 'bg-emerald-100 text-emerald-700 border-emerald-300'}`}>
          <Sparkles size={10} /> Auto-Generate
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Weekday Selection */}
        <div>
          <label className={`block text-xs font-bold mb-2 uppercase tracking-wide ${isHalfDay ? 'text-teal-800' : 'text-emerald-800'}`}>Select Weekdays</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(day => (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  selectedDays.includes(day.value)
                    ? isHalfDay ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : isHalfDay ? 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                {day.label.slice(0, 3)}
              </button>
            ))}
          </div>
          {selectedDays.length > 0 && (
            <p className={`text-[11px] mt-1.5 ${isHalfDay ? 'text-teal-700' : 'text-emerald-700'}`}>
              Selected: {selectedDays.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')}
            </p>
          )}
        </div>

        {/* Holiday Name */}
        <div>
          <label className={`block text-xs font-bold mb-2 uppercase tracking-wide ${isHalfDay ? 'text-teal-800' : 'text-emerald-800'}`}>Holiday Name</label>
          <input
            type="text"
            className={`w-full p-3 bg-white border rounded-xl outline-none focus:ring-2 text-sm transition-all ${isHalfDay ? 'border-teal-300 focus:ring-teal-300' : 'border-emerald-300 focus:ring-emerald-300'}`}
            placeholder={isHalfDay ? 'e.g. Half-Day Saturday' : 'e.g. Weekly Off, Sunday Holiday'}
            value={holidayName}
            onChange={e => setHolidayName(e.target.value)}
          />
        </div>
      </div>

      {/* Half-Day Toggle */}
      <div className={`p-4 rounded-xl border mb-4 ${isHalfDay ? 'bg-teal-100 border-teal-300' : 'bg-white border-emerald-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isHalfDay ? 'bg-teal-200' : 'bg-emerald-100'}`}>
              <Sunset size={16} className={isHalfDay ? 'text-teal-700' : 'text-emerald-600'} />
            </div>
            <div>
              <p className={`font-bold text-sm ${isHalfDay ? 'text-teal-900' : 'text-emerald-800'}`}>Half-Day Weekly Holiday</p>
              <p className={`text-[10px] ${isHalfDay ? 'text-teal-700' : 'text-emerald-700'}`}>
                Generate half-day holidays instead of full-day weekly offs
              </p>
            </div>
          </div>
          <div
            onClick={() => {
              setIsHalfDay(v => !v);
              setHolidayName(!isHalfDay ? 'Half-Day Weekly Off' : 'Weekly Off');
            }}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${isHalfDay ? 'bg-teal-500' : 'bg-border'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isHalfDay ? 'translate-x-7' : 'translate-x-1'}`} />
          </div>
        </div>

        {isHalfDay && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div>
              <label className="block text-xs font-bold mb-2 text-teal-800 uppercase tracking-wide">Half-Day Session</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setHalfDaySession('morning')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all flex-1 justify-center ${
                    halfDaySession === 'morning'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  <Sun size={15} /> Morning (AM)
                </button>
                <button
                  onClick={() => setHalfDaySession('afternoon')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all flex-1 justify-center ${
                    halfDaySession === 'afternoon'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  <Sunset size={15} /> Afternoon (PM)
                </button>
              </div>
              <p className="text-[10px] text-teal-600 mt-1.5">
                {halfDaySession === 'morning'
                  ? 'Employees work in the afternoon session only'
                  : 'Employees work in the morning session only'}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Week Selection */}
      <div className="mb-4">
        <label className={`block text-xs font-bold mb-2 uppercase tracking-wide ${isHalfDay ? 'text-teal-800' : 'text-emerald-800'}`}>
          Week Selection in Month
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {WEEK_SELECTION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setWeekSelection(opt.value); setShowPreview(false); }}
              className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                weekSelection === opt.value
                  ? isHalfDay
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : isHalfDay
                    ? 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                    : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <span className="text-xs font-bold">{opt.label}</span>
              <span className={`text-[10px] ${weekSelection === opt.value ? 'opacity-80' : 'opacity-60'}`}>{opt.description}</span>
            </button>
          ))}
        </div>
        {weekSelection !== 'all' && (
          <div className={`mt-2 flex items-start gap-2 px-3 py-2 rounded-lg border text-[11px] ${isHalfDay ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>
              {weekSelection === 'odd'
                ? 'Only the 1st, 3rd, and 5th occurrence of the selected weekday(s) in each month will be marked as holiday.'
                : 'Only the 2nd and 4th occurrence of the selected weekday(s) in each month will be marked as holiday.'}
            </span>
          </div>
        )}
      </div>

      {/* Period Info */}
      {fromDate && toDate && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-[11px] border ${isHalfDay ? 'bg-white border-teal-200 text-teal-700' : 'bg-white border-emerald-200 text-emerald-700'}`}>
          <Info size={12} className="shrink-0" />
          <span>
            Period: <strong>{formatDate(fromDate)}</strong> → <strong>{formatDate(toDate)}</strong>
            {selectedDays.length > 0 && fromDate && toDate && (
              <span className="ml-1">
                · Estimated: ~<strong>{estimatedCount}</strong> holidays
                {weekSelection !== 'all' && ` (${weekSelection} weeks only)`}
                {isHalfDay && ` · Half-Day (${halfDaySession})`}
              </span>
            )}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handlePreview}
          className={`flex items-center gap-2 px-5 py-2 bg-white border rounded-lg hover:opacity-80 transition-colors text-sm font-medium shadow-sm ${isHalfDay ? 'border-teal-400 text-teal-700' : 'border-emerald-400 text-emerald-700'}`}
        >
          <Calendar size={15} /> Preview Holidays
        </button>
        {showPreview && preview.length > 0 && (
          <button
            onClick={handleGenerate}
            className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg hover:opacity-90 transition-colors text-sm font-medium shadow-sm ${isHalfDay ? 'bg-teal-600' : 'bg-emerald-600'}`}
          >
            <Plus size={15} /> Add {preview.length} Holidays to List
          </button>
        )}
      </div>

      <AnimatePresence>
        {showPreview && preview.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className={`bg-white rounded-xl border overflow-hidden ${isHalfDay ? 'border-teal-200' : 'border-emerald-200'}`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${isHalfDay ? 'bg-teal-50 border-teal-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <span className={`text-xs font-bold ${isHalfDay ? 'text-teal-800' : 'text-emerald-800'}`}>
                  Preview — {preview.length} holidays across {Object.keys(previewByMonth).length} months
                  {weekSelection !== 'all' && ` · ${weekSelection === 'odd' ? 'Odd' : 'Even'} weeks`}
                  {isHalfDay && ` · Half-Day (${halfDaySession})`}
                </span>
                <button onClick={() => setShowPreview(false)} className={`${isHalfDay ? 'text-teal-600 hover:text-teal-800' : 'text-emerald-600 hover:text-emerald-800'} transition-colors`}>
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto p-3 space-y-3">
                {Object.entries(previewByMonth).map(([month, holidays]) => (
                  <div key={month}>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">{month} ({holidays.length})</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                      {holidays.map(h => (
                        <div key={h.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${isHalfDay ? 'bg-teal-50 border-teal-100' : 'bg-emerald-50 border-emerald-100'}`}>
                          <span className={`text-[11px] font-mono ${isHalfDay ? 'text-teal-700' : 'text-emerald-700'}`}>{formatDate(h.date)}</span>
                          <span className="text-[10px] text-muted-foreground">{getDayName(h.date).slice(0, 3)}</span>
                          {h.isHalfDay && (
                            <span className="text-[9px] font-bold text-teal-600 bg-teal-100 border border-teal-200 px-1 py-0.5 rounded">
                              {h.halfDaySession === 'morning' ? 'AM' : 'PM'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface HolidayFormModalProps {
  title: string;
  form: Omit<Holiday, 'id'>;
  onChange: (key: keyof Omit<Holiday, 'id'>, value: any) => void;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
}

const HolidayFormModal = ({ title, form, onChange, onSave, onClose, saveLabel }: HolidayFormModalProps) => (
  <Modal title={title} onClose={onClose}>
    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
      <Field label="Holiday Name" required>
        <input
          type="text"
          className={inputCls}
          placeholder="e.g. Republic Day, Diwali"
          value={form.name}
          onChange={e => onChange('name', e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date" required>
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <DateInput
              className={`${inputCls} pl-9`}
              value={form.date}
              onChange={e => onChange('date', e.target.value)}
            />
          </div>
        </Field>
        <Field label="Holiday Type" required>
          <select
            className={selectCls}
            value={form.type}
            onChange={e => onChange('type', e.target.value as HolidayType)}
          >
            {HOLIDAY_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      {/* Half-Day Toggle */}
      <div className={`p-4 rounded-xl border-2 transition-all ${form.isHalfDay ? 'bg-teal-50 border-teal-300' : 'bg-accent/30 border-border'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${form.isHalfDay ? 'bg-teal-100' : 'bg-accent'}`}>
              <Sunset size={16} className={form.isHalfDay ? 'text-teal-600' : 'text-muted-foreground'} />
            </div>
            <div>
              <p className="font-bold text-sm">Half-Day Holiday</p>
              <p className="text-[10px] text-muted-foreground">Mark this as a half-day holiday</p>
            </div>
          </div>
          <div
            onClick={() => onChange('isHalfDay', !form.isHalfDay)}
            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${form.isHalfDay ? 'bg-teal-500' : 'bg-border'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isHalfDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </div>
        {form.isHalfDay && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Field label="Half-Day Session">
              <div className="flex gap-3">
                <button
                  onClick={() => onChange('halfDaySession', 'morning')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all flex-1 justify-center ${
                    form.halfDaySession === 'morning'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  <Sun size={15} /> Morning (AM)
                </button>
                <button
                  onClick={() => onChange('halfDaySession', 'afternoon')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all flex-1 justify-center ${
                    form.halfDaySession === 'afternoon'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  <Sunset size={15} /> Afternoon (PM)
                </button>
              </div>
            </Field>
          </motion.div>
        )}
      </div>

      <Field label="Description">
        <input
          type="text"
          className={inputCls}
          placeholder="Brief description of the holiday"
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
        />
      </Field>
      <Field label="Applicable Location">
        <input
          type="text"
          className={inputCls}
          placeholder="e.g. All, Mumbai, Delhi"
          value={form.location}
          onChange={e => onChange('location', e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-3 cursor-pointer group">
        <div
          onClick={() => onChange('isRecurring', !form.isRecurring)}
          className={`w-10 h-5 rounded-full transition-colors relative ${form.isRecurring ? 'bg-primary' : 'bg-border'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
        <div>
          <span className="text-sm font-medium">Recurring Holiday</span>
          <p className="text-[10px] text-muted-foreground">Repeats every year on the same date</p>
        </div>
      </label>
      {form.date && (
        <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg border border-border text-xs text-muted-foreground">
          <Calendar size={12} />
          <span>Falls on <strong>{getDayName(form.date)}</strong> · {formatDate(form.date)}</span>
          {form.isHalfDay && (
            <span className="ml-2 text-teal-600 font-semibold">
              · Half-Day ({form.halfDaySession === 'morning' ? 'Morning' : 'Afternoon'})
            </span>
          )}
        </div>
      )}
    </div>
    <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
      <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      <button onClick={onSave} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
        {saveLabel}
      </button>
    </div>
  </Modal>
);

interface ListFormData {
  name: string;
  year: number;
  fromDate: string;
  toDate: string;
  description: string;
  status: 'Active' | 'Draft' | 'Archived';
}

interface HolidayListFormModalProps {
  title: string;
  form: ListFormData;
  onChange: (key: keyof ListFormData, value: any) => void;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
}

const HolidayListFormModal = ({ title, form, onChange, onSave, onClose, saveLabel }: HolidayListFormModalProps) => (
  <Modal title={title} onClose={onClose}>
    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
      <Field label="List Name" required>
        <input
          type="text"
          className={inputCls}
          placeholder="e.g. Holiday List 2025"
          value={form.name}
          onChange={e => onChange('name', e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Year" required>
          <input
            type="number"
            className={inputCls}
            placeholder="e.g. 2025"
            min={2000}
            max={2100}
            value={form.year}
            onChange={e => onChange('year', parseInt(e.target.value) || CURRENT_YEAR)}
          />
        </Field>
        <Field label="Status">
          <select
            className={selectCls}
            value={form.status}
            onChange={e => onChange('status', e.target.value as ListFormData['status'])}
          >
            <option>Active</option>
            <option>Draft</option>
            <option>Archived</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="From Date" required hint="Start of the holiday period">
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <DateInput
              className={`${inputCls} pl-9`}
              value={form.fromDate}
              onChange={e => onChange('fromDate', e.target.value)}
            />
          </div>
        </Field>
        <Field label="To Date" required hint="End of the holiday period">
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <DateInput
              className={`${inputCls} pl-9`}
              value={form.toDate}
              onChange={e => onChange('toDate', e.target.value)}
            />
          </div>
        </Field>
      </div>
      {form.fromDate && form.toDate && (
        <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg border border-border text-xs text-muted-foreground">
          <Calendar size={12} />
          <span>{formatDate(form.fromDate)} → {formatDate(form.toDate)}</span>
        </div>
      )}
      {form.fromDate && form.toDate && new Date(form.fromDate) > new Date(form.toDate) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
          <AlertCircle size={12} />
          From Date must be before To Date.
        </div>
      )}
      <Field label="Description">
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          placeholder="Brief description of this holiday list"
          value={form.description}
          onChange={e => onChange('description', e.target.value)}
        />
      </Field>
    </div>
    <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
      <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      <button onClick={onSave} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
        {saveLabel}
      </button>
    </div>
  </Modal>
);

interface HolidayListMasterProps {
  onBack: () => void;
}

const emptyHolidayForm = (): Omit<Holiday, 'id'> => ({
  name: '',
  date: '',
  type: 'National',
  description: '',
  isRecurring: false,
  location: 'All',
  isHalfDay: false,
  halfDaySession: 'afternoon',
});

const emptyListForm = (): ListFormData => ({
  name: `Holiday List ${CURRENT_YEAR}`,
  year: CURRENT_YEAR,
  fromDate: `${CURRENT_YEAR}-01-01`,
  toDate: `${CURRENT_YEAR}-12-31`,
  description: '',
  status: 'Active',
});

export default function HolidayListMaster({ onBack }: HolidayListMasterProps) {
  const { canEdit } = useMasterAccess();
  // Stored in and retrieved from Supabase `holiday_lists` + `holidays` only.
  const listsTable = useTable<DbHolidayListRow>('holiday_lists', { orderBy: { column: 'year', ascending: false } });
  const holidaysTable = useTable<DbHolidayRow>('holidays', { orderBy: { column: 'holiday_date', ascending: true } });
  const lists = useMemo<HolidayList[]>(() =>
    listsTable.rows.map(lr => rowToHolidayList(
      lr,
      holidaysTable.rows.filter(h => h.holiday_list_id === lr.id).map(rowToHoliday),
    )),
    [listsTable.rows, holidaysTable.rows]);
  const [selectedListId, setSelectedListId] = useState<string>('');

  // Default the selection to the first list once data loads.
  useEffect(() => {
    if (lists.length === 0) { if (selectedListId) setSelectedListId(''); return; }
    if (!lists.some(l => l.id === selectedListId)) setSelectedListId(lists[0].id);
  }, [lists, selectedListId]);

  const [listModal, setListModal] = useState(false);
  const [editingList, setEditingList] = useState<HolidayList | null>(null);
  const [listForm, setListForm] = useState<ListFormData>(emptyListForm());

  const [holidayModal, setHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayForm, setHolidayForm] = useState<Omit<Holiday, 'id'>>(emptyHolidayForm());

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<HolidayType | 'All'>('All');
  const [showWeeklyGenerator, setShowWeeklyGenerator] = useState(false);

  const selectedList = lists.find(l => l.id === selectedListId) ?? null;

  const filteredHolidays = useMemo(() => {
    if (!selectedList) return [];
    return selectedList.holidays
      .filter(h => {
        const matchSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
          h.description.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === 'All' || h.type === typeFilter;
        return matchSearch && matchType;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedList, search, typeFilter]);

  const typeCounts = useMemo(() => {
    if (!selectedList) return {} as Record<HolidayType, number>;
    return HOLIDAY_TYPES.reduce((acc, t) => {
      acc[t] = selectedList.holidays.filter(h => h.type === t).length;
      return acc;
    }, {} as Record<HolidayType, number>);
  }, [selectedList]);

  const halfDayCount = useMemo(() => {
    if (!selectedList) return 0;
    return selectedList.holidays.filter(h => h.isHalfDay).length;
  }, [selectedList]);

  const openAddList = () => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    setEditingList(null);
    setListForm(emptyListForm());
    setListModal(true);
  };

  const openEditList = (list: HolidayList) => {
    setEditingList(list);
    setListForm({
      name: list.name,
      year: list.year,
      fromDate: list.fromDate,
      toDate: list.toDate,
      description: list.description,
      status: list.status,
    });
    setListModal(true);
  };

  const saveList = async () => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    if (!listForm.name) { toast.error('List name is required.'); return; }
    if (!listForm.fromDate || !listForm.toDate) { toast.error('From Date and To Date are required.'); return; }
    if (new Date(listForm.fromDate) > new Date(listForm.toDate)) { toast.error('From Date must be before To Date.'); return; }

    const row = listFormToRow(listForm);
    if (editingList) {
      const err = (await listsTable.update(editingList.id, row)).error;
      if (err) { toast.error(err); return; }
      toast.success('Holiday list updated.');
    } else {
      const { data, error } = await listsTable.insert(row);
      if (error) { toast.error(error); return; }
      if (data) setSelectedListId(data.id);
      toast.success('Holiday list created.');
    }
    setListModal(false);
  };

  const deleteList = async (id: string) => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    if (lists.length === 1) { toast.error('At least one holiday list must exist.'); return; }
    const err = (await listsTable.remove(id)).error;
    if (err) { toast.error(err); return; }
    if (selectedListId === id) setSelectedListId('');
    toast.info('Holiday list deleted.');
  };

  const openAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayForm(emptyHolidayForm());
    setHolidayModal(true);
  };

  const openEditHoliday = (h: Holiday) => {
    setEditingHoliday(h);
    setHolidayForm({
      name: h.name,
      date: h.date,
      type: h.type,
      description: h.description,
      isRecurring: h.isRecurring,
      location: h.location,
      isHalfDay: h.isHalfDay,
      halfDaySession: h.halfDaySession ?? 'afternoon',
    });
    setHolidayModal(true);
  };

  const saveHoliday = async () => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    if (!holidayForm.name) { toast.error('Holiday name is required.'); return; }
    if (!holidayForm.date) { toast.error('Date is required.'); return; }
    if (!selectedListId) { toast.error('No holiday list selected.'); return; }

    const row = holidayFormToRow(holidayForm, selectedListId);
    const err = editingHoliday
      ? (await holidaysTable.update(editingHoliday.id, row)).error
      : (await holidaysTable.insert(row)).error;
    if (err) { toast.error(err); return; }
    toast.success(editingHoliday ? 'Holiday updated.' : 'Holiday added.');
    setHolidayModal(false);
  };

  const deleteHoliday = async (id: string) => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    const err = (await holidaysTable.remove(id)).error;
    if (err) { toast.error(err); return; }
    toast.info('Holiday removed.');
  };

  const handleWeeklyGenerate = async (newHolidays: Holiday[]) => {
    if (!canEdit) { toast.error('View only — only an Administrator can change masters.'); return; }
    if (!selectedListId || !selectedList) return;
    // Replace any existing weekly-off holidays in this list with the generated set.
    const stale = selectedList.holidays.filter(h => h.type === 'Weekly Off' || h.type === 'Half-Day Weekly Off');
    const delErr = (await Promise.all(stale.map(h => holidaysTable.remove(h.id))))
      .map(r => r.error).find(Boolean);
    if (delErr) { toast.error(delErr); return; }
    const insErr = (await Promise.all(newHolidays.map(h =>
      holidaysTable.insert(holidayFormToRow(h, selectedListId)))))
      .map(r => r.error).find(Boolean);
    if (insErr) { toast.error(insErr); return; }
  };

  const handleExport = () => {
    if (!selectedList) return;
    const rows = [
      ['#', 'Holiday Name', 'Date', 'Day', 'Type', 'Half-Day', 'Session', 'Description', 'Location', 'Recurring'],
      ...selectedList.holidays
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((h, i) => [
          String(i + 1),
          h.name,
          formatDate(h.date),
          getDayName(h.date),
          h.type,
          h.isHalfDay ? 'Yes' : 'No',
          h.isHalfDay ? (h.halfDaySession === 'morning' ? 'Morning (AM)' : 'Afternoon (PM)') : '—',
          h.description,
          h.location,
          h.isRecurring ? 'Yes' : 'No',
        ])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedList.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Holiday list exported as CSV.');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CalendarDays size={22} className="text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Holiday List Master</h1>
                <p className="text-xs text-muted-foreground">Manage national, festival, half-day, and weekly holidays with auto-generation.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedList && (
                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium text-muted-foreground">
                  <Download size={15} /> Export CSV
                </button>
              )}
              {canEdit && (
                <button onClick={openAddList} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
                  <Plus size={16} /> New Holiday List
                </button>
              )}
            </div>
          </div>
          {!canEdit && <div className="mt-3"><ViewOnlyBanner /></div>}
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-emerald-100 rounded-xl"><CalendarDays size={20} className="text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Holiday Lists</p>
                <p className="font-bold text-lg mt-0.5">{lists.length}</p>
                <p className="text-[10px] text-muted-foreground">{lists.filter(l => l.status === 'Active').length} active</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-blue-100 rounded-xl"><Flag size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">National</p>
                <p className="font-bold text-lg mt-0.5">{selectedList ? typeCounts['National'] : 0}</p>
                <p className="text-[10px] text-muted-foreground">In selected list</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-amber-100 rounded-xl"><Star size={20} className="text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Festival</p>
                <p className="font-bold text-lg mt-0.5">{selectedList ? typeCounts['Festival'] : 0}</p>
                <p className="text-[10px] text-muted-foreground">In selected list</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-emerald-100 rounded-xl"><Repeat size={20} className="text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Weekly Off</p>
                <p className="font-bold text-lg mt-0.5">{selectedList ? typeCounts['Weekly Off'] : 0}</p>
                <p className="text-[10px] text-muted-foreground">In selected list</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-teal-100 rounded-xl"><Sunset size={20} className="text-teal-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Half-Day</p>
                <p className="font-bold text-lg mt-0.5">{selectedList ? halfDayCount : 0}</p>
                <p className="text-[10px] text-muted-foreground">In selected list</p>
              </div>
            </motion.div>
          </div>

          {/* Holiday Lists */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Holiday Lists</h2>
              <button onClick={openAddList} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <Plus size={14} /> Add New List
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {lists.map(list => (
                <HolidayListCard
                  key={list.id}
                  list={list}
                  isSelected={selectedListId === list.id}
                  onSelect={() => setSelectedListId(list.id)}
                  onEdit={() => openEditList(list)}
                  onDelete={() => deleteList(list.id)}
                />
              ))}
            </div>
          </div>

          {selectedList && (
            <motion.div key={selectedList.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="bg-card rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold">{selectedList.name}</h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedList.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' :
                        selectedList.status === 'Draft' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {selectedList.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {formatDate(selectedList.fromDate)} → {formatDate(selectedList.toDate)}
                      </span>
                      <span>·</span>
                      <span>{selectedList.holidays.length} holidays total</span>
                      {halfDayCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-teal-600 font-medium flex items-center gap-1">
                            <Sunset size={12} /> {halfDayCount} half-day
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowWeeklyGenerator(v => !v)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        showWeeklyGenerator
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-emerald-400 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <Repeat size={15} />
                      Weekly Generator
                    </button>
                    <button
                      onClick={openAddHoliday}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium"
                    >
                      <Plus size={15} /> Add Holiday
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {HOLIDAY_TYPES.map(t => {
                    const count = typeCounts[t];
                    if (count === 0) return null;
                    const style = TYPE_STYLES[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(typeFilter === t ? 'All' : t)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                          typeFilter === t
                            ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-current`
                            : `${style.bg} ${style.text} ${style.border} hover:opacity-80`
                        }`}
                      >
                        {t} ({count})
                      </button>
                    );
                  })}
                  {typeFilter !== 'All' && (
                    <button onClick={() => setTypeFilter('All')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <X size={12} /> Clear filter
                    </button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {showWeeklyGenerator && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <WeeklyGenerator fromDate={selectedList.fromDate} toDate={selectedList.toDate} onGenerate={handleWeeklyGenerate} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    placeholder="Search holidays by name or description..."
                    className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <select
                    className="pl-8 pr-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as HolidayType | 'All')}
                  >
                    <option value="All">All Types</option>
                    {HOLIDAY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 size={13} className="text-green-500" />
                  <span>{filteredHolidays.length} of {selectedList.holidays.length} holidays</span>
                </div>
              </div>

              {filteredHolidays.length > 0 ? (
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-10">#</th>
                          <th className="px-4 py-3 font-semibold">Holiday Name</th>
                          <th className="px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Location</th>
                          <th className="px-4 py-3 font-semibold w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredHolidays.map((h, i) => (
                          <HolidayRow key={h.id} holiday={h} index={i} onEdit={openEditHoliday} onDelete={deleteHoliday} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CalendarDays size={28} className="text-emerald-600" />
                  </div>
                  <p className="font-semibold text-muted-foreground">
                    {search || typeFilter !== 'All' ? 'No holidays match your filters' : 'No holidays added yet'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 mb-5">
                    {search || typeFilter !== 'All'
                      ? 'Try adjusting your search or filter criteria'
                      : 'Add national, festival, half-day holidays or use the weekly generator'}
                  </p>
                  {!search && typeFilter === 'All' && (
                    <div className="flex items-center gap-3 justify-center">
                      <button onClick={openAddHoliday} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium">
                        <Plus size={15} /> Add Holiday
                      </button>
                      <button onClick={() => setShowWeeklyGenerator(true)} className="flex items-center gap-2 px-5 py-2 border border-emerald-400 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors text-sm font-medium">
                        <Repeat size={15} /> Weekly Generator
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedList.holidays.length > 0 && (
                <MonthlyCalendarView holidays={selectedList.holidays} year={selectedList.year} />
              )}
            </motion.div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {listModal && (
          <HolidayListFormModal
            title={editingList ? 'Edit Holiday List' : 'Create Holiday List'}
            form={listForm}
            onChange={(key, val) => setListForm(f => ({ ...f, [key]: val }))}
            onSave={saveList}
            onClose={() => setListModal(false)}
            saveLabel={editingList ? 'Save Changes' : 'Create List'}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {holidayModal && (
          <HolidayFormModal
            title={editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
            form={holidayForm}
            onChange={(key, val) => setHolidayForm(f => ({ ...f, [key]: val }))}
            onSave={saveHoliday}
            onClose={() => setHolidayModal(false)}
            saveLabel={editingHoliday ? 'Save Changes' : 'Add Holiday'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface MonthlyCalendarViewProps {
  holidays: Holiday[];
  year: number;
}

function MonthlyCalendarView({ holidays, year }: MonthlyCalendarViewProps) {
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  const monthData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const monthHolidays = holidays.filter(h => {
        const d = new Date(h.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === m;
      }).sort((a, b) => a.date.localeCompare(b.date));
      return { month: m, holidays: monthHolidays };
    }).filter(m => m.holidays.length > 0);
  }, [holidays, year]);

  if (monthData.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
        <CalendarDays size={16} className="text-primary" />
        <h3 className="font-bold text-sm">Monthly Overview — {year}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{holidays.length} holidays across {monthData.length} months</span>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {monthData.map(({ month, holidays: mh }) => {
          const monthName = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long' });
          const isExpanded = expandedMonth === month;
          const halfDayInMonth = mh.filter(h => h.isHalfDay).length;
          return (
            <motion.div key={month} className="bg-accent/30 rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setExpandedMonth(isExpanded ? null : month)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{monthName}</span>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{mh.length}</span>
                  {halfDayInMonth > 0 && (
                    <span className="text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Sunset size={9} /> {halfDayInMonth}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from(new Set(mh.map(h => h.type))).slice(0, 3).map(t => {
                      const style = TYPE_STYLES[t];
                      return <span key={t} className={`w-2 h-2 rounded-full ${style.bg.replace('bg-', 'bg-').replace('-100', '-400')}`} />;
                    })}
                  </div>
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-3 space-y-1.5 border-t border-border pt-2">
                      {mh.map(h => (
                        <div key={h.id} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-muted-foreground w-20 shrink-0">{formatDate(h.date)}</span>
                          <span className="text-xs font-medium flex-1 truncate">{h.name}</span>
                          {h.isHalfDay && (
                            <span className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-full shrink-0">
                              {h.halfDaySession === 'morning' ? 'AM' : 'PM'}
                            </span>
                          )}
                          <TypeBadge type={h.type} isHalfDay={h.isHalfDay} />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {!isExpanded && (
                <div className="px-4 pb-3 space-y-1">
                  {mh.slice(0, 2).map(h => (
                    <div key={h.id} className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground w-20 shrink-0">{formatDate(h.date)}</span>
                      <span className="text-xs font-medium flex-1 truncate">{h.name}</span>
                      {h.isHalfDay && (
                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-full shrink-0">
                          {h.halfDaySession === 'morning' ? 'AM' : 'PM'}
                        </span>
                      )}
                      <TypeBadge type={h.type} isHalfDay={h.isHalfDay} />
                    </div>
                  ))}
                  {mh.length > 2 && (
                    <button onClick={() => setExpandedMonth(month)} className="text-[11px] text-primary hover:underline">
                      +{mh.length - 2} more
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}