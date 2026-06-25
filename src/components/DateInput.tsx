import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from '../utils/date';

// Drop-in replacement for <input type="date">. Displays and accepts dates as
// dd/MMM/yyyy (e.g. 25/Jun/2026) while still storing the value as an ISO
// yyyy-MM-dd string, so the rest of the app is unchanged. A native calendar
// picker is overlaid on the right for point-and-click selection.
//
// onChange mirrors the native event shape ({ target: { value } }) so existing
// handlers like `e => set(e.target.value)` keep working without edits.

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function buildISO(year: number, monthIdx: number, day: number): string | null {
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return null;
  const d = new Date(year, monthIdx, day);
  if (isNaN(d.getTime()) || d.getMonth() !== monthIdx || d.getDate() !== day) return null;
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse user text into an ISO date. Returns '' for empty input and null when
 * the text can't be understood. Accepts dd/MMM/yyyy plus a few lenient
 * variants (dd-MMM-yyyy, dd MMM yyyy, dd/MM/yyyy, and raw ISO).
 */
function parseToISO(input: string): string | null {
  const s = input.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd <sep> MMM <sep> yyyy  (month as name)
  let m = s.match(/^(\d{1,2})[\s/\-.]+([A-Za-z]{3,})[\s/\-.]+(\d{4})$/);
  if (m) {
    const monthIdx = MONTH_ABBR.indexOf(m[2].slice(0, 3).toLowerCase());
    return buildISO(Number(m[3]), monthIdx, Number(m[1]));
  }
  // dd <sep> MM <sep> yyyy  (numeric month)
  m = s.match(/^(\d{1,2})[\s/\-.]+(\d{1,2})[\s/\-.]+(\d{4})$/);
  if (m) return buildISO(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

interface DateInputProps {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  id?: string;
  name?: string;
  placeholder?: string;
}

export default function DateInput({
  value = '',
  onChange,
  className = '',
  required,
  disabled,
  min,
  max,
  id,
  name,
  placeholder = 'dd/MMM/yyyy',
}: DateInputProps) {
  const [text, setText] = useState(() => (value ? formatDate(value) : ''));
  const nativeRef = useRef<HTMLInputElement>(null);

  // Re-sync the visible text whenever the controlled value changes externally.
  useEffect(() => {
    setText(value ? formatDate(value) : '');
  }, [value]);

  const emit = (iso: string) => {
    if (iso !== value) onChange?.({ target: { value: iso } });
  };

  // Parse what the user typed; commit if valid, otherwise revert to last good.
  const commit = () => {
    const iso = parseToISO(text);
    if (iso === null) {
      setText(value ? formatDate(value) : '');
      return;
    }
    setText(iso ? formatDate(iso) : '');
    emit(iso);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        id={id}
        name={name}
        className={`${className} pr-9`}
        value={text}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      />
      <Calendar
        size={15}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      {/* Invisible native date picker overlaying the calendar icon. */}
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        min={min}
        max={max}
        value={value || ''}
        onChange={e => { setText(e.target.value ? formatDate(e.target.value) : ''); emit(e.target.value); }}
        className="absolute right-0 top-0 h-full w-9 opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}
