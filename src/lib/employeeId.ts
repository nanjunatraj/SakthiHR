// Configurable Employee ID generation pattern. The pattern is authored in
// Establishment Master (stored in establishment.employee_id_pattern jsonb) and
// consumed by Employee Master to generate each new employee's ID.
//
// A pattern is an ordered list of segments. Each segment contributes a piece of
// the ID — the establishment code, the year of appointment, the date of birth,
// a running serial number, a delimiter, or static text.

export type EmpIdSegmentType = 'estCode' | 'year' | 'dob' | 'serial' | 'delimiter' | 'text';

export interface EmpIdSegment {
  id: string;
  type: EmpIdSegmentType;
  /** static text (type 'text') or an override delimiter (type 'delimiter'). */
  value?: string;
  /** year format ('YYYY' | 'YY') or dob format ('YYYY'|'YY'|'DDMMYYYY'|'DDMMYY'|'YYYYMMDD'). */
  format?: string;
  /** number of digits for the serial (type 'serial'). */
  digits?: number;
}

export interface EmpIdPattern {
  enabled: boolean;
  /** Value emitted by 'estCode' segments. */
  establishmentCode: string;
  /** Default delimiter emitted by 'delimiter' segments. */
  delimiter: string;
  /** First serial number issued. */
  serialStart: number;
  segments: EmpIdSegment[];
}

export const SEGMENT_META: Record<EmpIdSegmentType, { label: string; desc: string }> = {
  estCode: { label: 'Establishment Code', desc: 'The configured establishment / unit code' },
  year: { label: 'Year of Appointment', desc: "Year from the employee's date of joining" },
  dob: { label: 'Date of Birth', desc: "Formatted from the employee's date of birth" },
  serial: { label: 'Running Serial No.', desc: 'Auto-incrementing, zero-padded number' },
  delimiter: { label: 'Delimiter', desc: 'A separator such as - / or .' },
  text: { label: 'Static Text', desc: 'A fixed literal (e.g. EMP)' },
};

export const YEAR_FORMATS = ['YYYY', 'YY'] as const;
export const DOB_FORMATS = ['DDMMYYYY', 'DDMMYY', 'YYYYMMDD', 'YYYY', 'YY'] as const;

const uid = () => `seg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** A sensible starting pattern: EMP-<YY>-<0001>. */
export function defaultEmpIdPattern(): EmpIdPattern {
  return {
    enabled: true,
    establishmentCode: 'EMP',
    delimiter: '-',
    serialStart: 1,
    segments: [
      { id: uid(), type: 'estCode' },
      { id: uid(), type: 'delimiter' },
      { id: uid(), type: 'year', format: 'YY' },
      { id: uid(), type: 'delimiter' },
      { id: uid(), type: 'serial', digits: 4 },
    ],
  };
}

export function newSegment(type: EmpIdSegmentType): EmpIdSegment {
  const base: EmpIdSegment = { id: uid(), type };
  if (type === 'serial') base.digits = 4;
  if (type === 'year') base.format = 'YY';
  if (type === 'dob') base.format = 'DDMMYYYY';
  if (type === 'text') base.value = '';
  return base;
}

const yyyy = (d: Date) => String(d.getFullYear());
const yy = (d: Date) => String(d.getFullYear()).slice(-2);
const dd = (d: Date) => String(d.getDate()).padStart(2, '0');
const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, '0');

function fmtDate(dateIso: string, format: string): string {
  if (!dateIso) return '';
  const d = new Date(dateIso + (dateIso.length <= 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return '';
  switch (format) {
    case 'YYYY': return yyyy(d);
    case 'YY': return yy(d);
    case 'DDMMYYYY': return `${dd(d)}${mm(d)}${yyyy(d)}`;
    case 'DDMMYY': return `${dd(d)}${mm(d)}${yy(d)}`;
    case 'YYYYMMDD': return `${yyyy(d)}${mm(d)}${dd(d)}`;
    default: return yyyy(d);
  }
}

export interface EmpIdContext {
  serial: number;
  /** Date of joining (YYYY-MM-DD) — drives the year-of-appointment segment. */
  doj?: string;
  /** Date of birth (YYYY-MM-DD) — drives the dob segment. */
  dob?: string;
}

/** Render the Employee ID for the given pattern + context. */
export function buildEmployeeId(pattern: EmpIdPattern, ctx: EmpIdContext): string {
  const dojIso = ctx.doj || new Date().toISOString().split('T')[0];
  return pattern.segments.map(seg => {
    switch (seg.type) {
      case 'estCode': return pattern.establishmentCode ?? '';
      case 'delimiter': return seg.value ?? pattern.delimiter ?? '';
      case 'text': return seg.value ?? '';
      case 'year': return fmtDate(dojIso, seg.format || 'YY');
      case 'dob': return ctx.dob ? fmtDate(ctx.dob, seg.format || 'DDMMYYYY') : '';
      case 'serial': return String(Math.max(0, ctx.serial)).padStart(seg.digits ?? 4, '0');
      default: return '';
    }
  }).join('');
}

/** A representative sample ID for the pattern (preview), using placeholder data. */
export function sampleEmployeeId(pattern: EmpIdPattern): string {
  return buildEmployeeId(pattern, {
    serial: pattern.serialStart || 1,
    doj: new Date().toISOString().split('T')[0],
    dob: '1995-06-15',
  });
}
