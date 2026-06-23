import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import type { LetterheadWrap } from './exportStatement';

const ldb = supabase as unknown as SupabaseClient;

// ─── Categories ─────────────────────────────────────────────────────────────────

export interface LetterCategory { key: string; label: string }

export const LETTER_CATEGORIES: LetterCategory[] = [
  { key: 'payslip', label: 'Payslip' },
  { key: 'offer', label: 'Offer Letter' },
  { key: 'appointment', label: 'Appointment Order / Letter' },
  { key: 'experience', label: 'Experience Certificate' },
  { key: 'relieving', label: 'Relieving Letter' },
  { key: 'service', label: 'Service Certificate' },
  { key: 'resignation_acceptance', label: 'Resignation Acceptance Letter' },
  { key: 'fnf', label: 'Full & Final Settlement Letter' },
  { key: 'exit_interview', label: 'Exit Interview Letter' },
  { key: 'show_cause', label: 'Show-Cause Notice (Absconding)' },
  { key: 'termination', label: 'Termination Letter (Abandonment)' },
  { key: 'retirement_notice', label: 'Notice of Retirement' },
  { key: 'condolence', label: 'Condolence Letter' },
  { key: 'leave_application', label: 'Leave Application' },
  { key: 'loan_application', label: 'Loan Application' },
  { key: 'deduction', label: 'Deductions Letter' },
  { key: 'disciplinary', label: 'Disciplinary Action Letter' },
  { key: 'memo', label: 'Memo' },
  { key: 'late_warning', label: 'Late Coming Warning' },
  { key: 'lop_absence', label: 'Unauthorized Absence / LOP' },
];

export const categoryLabel = (key: string): string =>
  LETTER_CATEGORIES.find(c => c.key === key)?.label ?? key;

/** Languages a letter format can be authored in. The body holds regional-script text;
 *  the PDF renders it as-is (Noto fonts are loaded in buildLetterHtml). */
export const LETTER_LANGUAGES = ['English', 'Tamil', 'Kannada', 'Hindi', 'Telugu', 'Malayalam', 'Marathi'] as const;
export type LetterLanguage = typeof LETTER_LANGUAGES[number];

// ─── Placeholder catalog ──────────────────────────────────────────────────────

export interface PlaceholderGroup { group: string; tokens: { token: string; label: string }[] }

export const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    group: 'Employee',
    tokens: [
      { token: '{{employee.name}}', label: 'Full Name' },
      { token: '{{employee.code}}', label: 'Employee ID' },
      { token: '{{employee.fatherName}}', label: "Father's Name" },
      { token: '{{employee.dob}}', label: 'Date of Birth' },
      { token: '{{employee.gender}}', label: 'Gender' },
      { token: '{{employee.mobile}}', label: 'Mobile' },
      { token: '{{employee.email}}', label: 'Email' },
      { token: '{{employee.address}}', label: 'Address' },
    ],
  },
  {
    group: 'Employment',
    tokens: [
      { token: '{{employment.designation}}', label: 'Designation' },
      { token: '{{employment.department}}', label: 'Department' },
      { token: '{{employment.workLocation}}', label: 'Work Location' },
      { token: '{{employment.grade}}', label: 'Grade' },
      { token: '{{employment.type}}', label: 'Employee Type' },
      { token: '{{employment.doj}}', label: 'Date of Joining' },
      { token: '{{employment.confirmation}}', label: 'Date of Confirmation' },
    ],
  },
  {
    group: 'Statutory',
    tokens: [
      { token: '{{statutory.pan}}', label: 'PAN' },
      { token: '{{statutory.uan}}', label: 'UAN' },
      { token: '{{statutory.aadhaarLast4}}', label: 'Aadhaar (last 4)' },
    ],
  },
  {
    group: 'Salary',
    tokens: [
      { token: '{{salary.ctcMonthly}}', label: 'CTC (monthly)' },
      { token: '{{salary.ctcAnnual}}', label: 'CTC (annual)' },
    ],
  },
  {
    group: 'Company',
    tokens: [
      { token: '{{company.name}}', label: 'Company Name' },
      { token: '{{company.address}}', label: 'Company Address' },
    ],
  },
  {
    group: 'Letter',
    tokens: [
      { token: '{{date.today}}', label: "Today's Date" },
      { token: '{{letter.refNo}}', label: 'Reference No.' },
    ],
  },
];

// ─── Merge data ─────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return '';
  const day = String(dt.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const aadhaarLast4 = (a?: string | null) => (a ? `XXXX XXXX ${String(a).replace(/\D/g, '').slice(-4)}` : '');

/** Sample data so HR can preview a template without selecting an employee. */
export const SAMPLE_MERGE_DATA: Record<string, string> = {
  '{{employee.name}}': 'John Doe',
  '{{employee.code}}': 'EMP0001',
  '{{employee.fatherName}}': 'Richard Doe',
  '{{employee.dob}}': '01-Jan-1990',
  '{{employee.gender}}': 'Male',
  '{{employee.mobile}}': '+91 98765 43210',
  '{{employee.email}}': 'john.doe@company.com',
  '{{employee.address}}': '123, MG Road, Bengaluru, Karnataka',
  '{{employment.designation}}': 'Software Engineer',
  '{{employment.department}}': 'Engineering',
  '{{employment.workLocation}}': 'Head Office',
  '{{employment.grade}}': 'Grade A',
  '{{employment.type}}': 'Permanent',
  '{{employment.doj}}': '01-Apr-2024',
  '{{employment.confirmation}}': '01-Oct-2024',
  '{{statutory.pan}}': 'ABCDE1234F',
  '{{statutory.uan}}': '100123456789',
  '{{statutory.aadhaarLast4}}': 'XXXX XXXX 1234',
  '{{salary.ctcMonthly}}': '₹75,000',
  '{{salary.ctcAnnual}}': '₹9,00,000',
  '{{company.name}}': 'Your Company Pvt Ltd',
  '{{company.address}}': 'Corporate Office, City, State',
  '{{date.today}}': fmtDate(new Date().toISOString().slice(0, 10)),
  '{{letter.refNo}}': 'REF/2026/0001',
};

/** Load the flat token→value map for a given employee (real DB data). */
export async function loadEmployeeMergeData(employeeId: string, refNo?: string): Promise<Record<string, string>> {
  const { data: e } = await ldb
    .from('employees')
    .select('employee_id, first_name, middle_name, last_name, father_name, date_of_birth, gender, mobile_number, email, present_address_line1, present_address_line2, present_city, present_state, present_pincode, date_of_joining, date_of_confirmation, designation:designations(name), department:departments(name), work_location:work_locations(name), grade:employee_grades(name), employee_type:employee_types(name), employee_statutory(pan_no, uan_no, aadhar_no), employee_salary_assignments(ctc_monthly, ctc_annual)')
    .eq('id', employeeId)
    .maybeSingle();
  const { data: est } = await ldb.from('establishment').select('name, address_line1, address_line2, city, state').limit(1).maybeSingle();

  const r = (e ?? {}) as Record<string, any>;
  const stat = Array.isArray(r.employee_statutory) ? r.employee_statutory[0] : r.employee_statutory;
  const asg = Array.isArray(r.employee_salary_assignments) ? r.employee_salary_assignments[0] : r.employee_salary_assignments;
  const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ');
  const address = [r.present_address_line1, r.present_address_line2, r.present_city, r.present_state, r.present_pincode].filter(Boolean).join(', ');
  const est2 = (est ?? {}) as Record<string, any>;
  const companyAddress = [est2.address_line1, est2.address_line2, est2.city, est2.state].filter(Boolean).join(', ');

  return {
    '{{employee.name}}': name,
    '{{employee.code}}': r.employee_id ?? '',
    '{{employee.fatherName}}': r.father_name ?? '',
    '{{employee.dob}}': fmtDate(r.date_of_birth),
    '{{employee.gender}}': r.gender ?? '',
    '{{employee.mobile}}': r.mobile_number ?? '',
    '{{employee.email}}': r.email ?? '',
    '{{employee.address}}': address,
    '{{employment.designation}}': r.designation?.name ?? '',
    '{{employment.department}}': r.department?.name ?? '',
    '{{employment.workLocation}}': r.work_location?.name ?? '',
    '{{employment.grade}}': r.grade?.name ?? '',
    '{{employment.type}}': r.employee_type?.name ?? '',
    '{{employment.doj}}': fmtDate(r.date_of_joining),
    '{{employment.confirmation}}': fmtDate(r.date_of_confirmation),
    '{{statutory.pan}}': stat?.pan_no ?? '',
    '{{statutory.uan}}': stat?.uan_no ?? '',
    '{{statutory.aadhaarLast4}}': aadhaarLast4(stat?.aadhar_no),
    '{{salary.ctcMonthly}}': asg?.ctc_monthly ? inr(Number(asg.ctc_monthly)) : '',
    '{{salary.ctcAnnual}}': asg?.ctc_annual ? inr(Number(asg.ctc_annual)) : '',
    '{{company.name}}': est2.name ?? '',
    '{{company.address}}': companyAddress,
    '{{date.today}}': fmtDate(new Date().toISOString().slice(0, 10)),
    '{{letter.refNo}}': refNo ?? '',
  };
}

/** Replace every {{token}} in the body with its value. */
export function mergeTemplate(body: string, data: Record<string, string>, highlightUnresolved = false): string {
  return body.replace(/\{\{\s*[\w.]+\s*\}\}/g, m => {
    const key = m.replace(/\s+/g, '');
    if (key in data) return data[key] ?? '';
    return highlightUnresolved ? `<span style="background:#fef3c7;color:#92400e;border-radius:3px;padding:0 2px;">${m}</span>` : '';
  });
}

// ─── Letterhead ─────────────────────────────────────────────────────────────────

export interface Letterhead { row: Record<string, any> }

/** Load the active letterhead for the employee's work location (no location → org default). */
export async function loadLetterhead(employeeId?: string): Promise<Record<string, any> | null> {
  let locationId: string | null = null;
  if (employeeId) {
    const { data: emp } = await ldb.from('employees').select('work_location_id').eq('id', employeeId).maybeSingle();
    locationId = (emp as any)?.work_location_id ?? null;
  }
  if (locationId) {
    const { data } = await ldb.from('letterheads').select('*').eq('location_id', locationId).eq('is_active', true).limit(1).maybeSingle();
    if (data) return data as Record<string, any>;
  }
  const { data: any1 } = await ldb.from('letterheads').select('*').eq('is_active', true).limit(1).maybeSingle();
  return (any1 as Record<string, any>) ?? null;
}

const FONT_PX: Record<string, string> = { xs: '11px', sm: '13px', base: '15px', lg: '18px', xl: '22px', '2xl': '28px' };
const IMG_H: Record<string, string> = { sm: '48px', md: '72px', lg: '110px' };
const DIV_PX: Record<string, string> = { thin: '1px', medium: '2px', thick: '4px' };

function renderLetterheadHeader(lh: Record<string, any>): string {
  if (!lh || lh.header_enabled === false) return '';
  if (lh.header_use_custom_html && lh.header_custom_html) return `<div class="lh-header">${lh.header_custom_html}</div>`;
  const align = (a?: string) => `text-align:${a || 'center'};`;
  const logo = lh.header_logo_url
    ? `<div style="text-align:${lh.header_logo_position || 'center'};"><img src="${lh.header_logo_url}" style="height:${IMG_H[lh.header_logo_size as string] || '72px'};object-fit:contain;" /></div>`
    : '';
  const banner = lh.header_image_url
    ? `<div><img src="${lh.header_image_url}" style="display:block;width:100%;height:auto;object-fit:contain;" /></div>`
    : '';
  const company = lh.header_company_name
    ? `<div style="${align(lh.header_company_name_align)}font-weight:800;font-size:${FONT_PX[lh.header_company_name_size as string] || '22px'};color:${lh.header_company_name_color || '#1e3a5f'};">${lh.header_company_name}</div>`
    : '';
  const tagline = lh.header_tagline ? `<div style="${align(lh.header_tagline_alignment)}color:${lh.header_tagline_color || '#64748b'};font-size:12px;">${lh.header_tagline}</div>` : '';
  const addr = lh.header_address_line ? `<div style="${align(lh.header_address_alignment)}font-size:11px;color:#475569;">${lh.header_address_line}</div>` : '';
  const contact = lh.header_contact_line ? `<div style="${align(lh.header_contact_alignment)}font-size:11px;color:#475569;">${lh.header_contact_line}</div>` : '';
  const web = lh.header_website_line ? `<div style="${align(lh.header_website_alignment)}font-size:11px;color:#475569;">${lh.header_website_line}</div>` : '';
  const divider = lh.header_divider_enabled !== false
    ? `<hr style="border:none;border-top:${DIV_PX[lh.header_divider_thickness as string] || '2px'} solid ${lh.header_divider_color || '#1e3a5f'};margin:10px 0 0;" />`
    : '';
  return `<div class="lh-header" style="background:${lh.header_bg_color || 'transparent'};padding-bottom:6px;">${banner}${logo}${company}${tagline}${addr}${contact}${web}${divider}</div>`;
}

function renderLetterheadFooter(lh: Record<string, any>): string {
  if (!lh || lh.footer_enabled === false) return '';
  if (lh.footer_use_custom_html && lh.footer_custom_html) return `<div class="lh-footer">${lh.footer_custom_html}</div>`;
  const align = (a?: string) => `text-align:${a || 'center'};`;
  const divider = lh.footer_divider_enabled !== false
    ? `<hr style="border:none;border-top:${DIV_PX[lh.footer_divider_thickness as string] || '1px'} solid ${lh.footer_divider_color || '#cbd5e1'};margin:0 0 6px;" />`
    : '';
  const img = lh.footer_image_url ? `<div><img src="${lh.footer_image_url}" style="display:block;width:100%;height:auto;object-fit:contain;" /></div>` : '';
  const l1 = lh.footer_line1 ? `<div style="${align(lh.footer_line1_alignment)}font-size:11px;color:${lh.footer_line1_color || '#475569'};">${lh.footer_line1}</div>` : '';
  const l2 = lh.footer_line2 ? `<div style="${align(lh.footer_line2_alignment)}font-size:11px;color:${lh.footer_line2_color || '#475569'};">${lh.footer_line2}</div>` : '';
  return `<div class="lh-footer" style="background:${lh.footer_bg_color || 'transparent'};padding-top:6px;">${divider}${img}${l1}${l2}</div>`;
}

// ─── Printable HTML ───────────────────────────────────────────────────────────

export interface BuildLetterOpts {
  title: string;
  bodyHtml: string;
  letterhead?: Record<string, any> | null;
  useLetterhead?: boolean;
  /** When false (preview), the print/close toolbar is omitted. */
  withToolbar?: boolean;
}

export function buildLetterHtml({ title, bodyHtml, letterhead, useLetterhead = true, withToolbar = true }: BuildLetterOpts): string {
  const lh = useLetterhead ? letterhead : null;
  const header = lh ? renderLetterheadHeader(lh) : '';
  const footer = lh ? renderLetterheadFooter(lh) : '';
  const toolbar = withToolbar
    ? `<div class="no-print" style="position:sticky;top:0;background:#1e293b;color:#fff;padding:10px 16px;display:flex;gap:10px;align-items:center;justify-content:flex-end;font-family:system-ui;">
         <span style="margin-right:auto;font-weight:600;">${title}</span>
         <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;">🖨 Print / Save as PDF</button>
         <button onclick="window.close()" style="background:#475569;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;">Close</button>
       </div>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil&family=Noto+Sans+Kannada&family=Noto+Sans+Devanagari&family=Noto+Sans+Telugu&family=Noto+Sans+Malayalam&family=Noto+Serif&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body { margin:0; background:#e2e8f0; color:#1f2937;
      font-family: Georgia, 'Times New Roman', 'Noto Serif', 'Noto Sans Tamil', 'Noto Sans Kannada', 'Noto Sans Devanagari', 'Noto Sans Telugu', 'Noto Sans Malayalam', serif; }
    /* Header flush to the top edge, footer flush to the bottom edge; margins inset the letter body only. */
    .page { width:210mm; min-height:297mm; margin:16px auto; background:#fff; padding:0; box-shadow:0 4px 24px rgba(0,0,0,.12); display:flex; flex-direction:column; }
    .lh-body { flex:1 0 auto; padding:14mm 18mm; font-size:14px; line-height:1.7; }
    .lh-body p { margin:0 0 12px; }
    .lh-header { margin:0; } .lh-footer { margin:0; }
    @media print {
      body { background:#fff; }
      .no-print { display:none !important; }
      .page { width:auto; margin:0; padding:0; box-shadow:none; }
      @page { size:A4; margin:0; }
    }
  </style></head>
  <body>${toolbar}
    <div class="page">
      ${header}
      <div class="lh-body">${bodyHtml}</div>
      ${footer}
    </div>
  </body></html>`;
}

/**
 * Load the active letterhead designated for payslips (use_for_payslip = true) for the
 * employee's work location, falling back to any active payslip-enabled letterhead (org default).
 * Returns null when no work-location letterhead is marked for use on payslips.
 */
export async function loadPayslipLetterhead(employeeId?: string): Promise<Record<string, any> | null> {
  let locationId: string | null = null;
  if (employeeId) {
    const { data: emp } = await ldb.from('employees').select('work_location_id').eq('id', employeeId).maybeSingle();
    locationId = (emp as any)?.work_location_id ?? null;
  }
  if (locationId) {
    const { data } = await ldb.from('letterheads').select('*')
      .eq('location_id', locationId).eq('is_active', true).eq('use_for_payslip', true).limit(1).maybeSingle();
    if (data) return data as Record<string, any>;
  }
  const { data: any1 } = await ldb.from('letterheads').select('*')
    .eq('is_active', true).eq('use_for_payslip', true).limit(1).maybeSingle();
  return (any1 as Record<string, any>) ?? null;
}

/** Header/footer HTML fragments for a letterhead row — for embedding into other documents (e.g. payslips). */
export function letterheadParts(lh: Record<string, any> | null): { header: string; footer: string } {
  if (!lh) return { header: '', footer: '' };
  return { header: renderLetterheadHeader(lh), footer: renderLetterheadFooter(lh) };
}

// ── Paper geometry (mm) for full-size letterhead printing ──
const PAPER_DIMS: Record<string, { w: number; h: number; css: string }> = {
  a4: { w: 210, h: 297, css: 'A4' },
  letter: { w: 215.9, h: 279.4, css: 'Letter' },
  legal: { w: 215.9, h: 355.6, css: 'Legal' },
};
export function paperDims(paperSize?: string): { w: number; h: number; css: string } {
  return PAPER_DIMS[(paperSize || 'A4').trim().toLowerCase()] ?? PAPER_DIMS.a4;
}

/** Load the org-default active letterhead (prefers a payslip-enabled one) — used for org-wide reports. */
export async function loadReportLetterhead(): Promise<Record<string, any> | null> {
  const { data } = await ldb.from('letterheads').select('*')
    .eq('is_active', true).order('use_for_payslip', { ascending: false }).limit(1);
  const rows = (data as Record<string, any>[]) ?? [];
  return rows[0] ?? null;
}

/**
 * Build a paper-sized letterhead print wrapper (header/footer HTML + paper geometry + margins)
 * for embedding a report onto the Work Location letterhead. Shape matches `LetterheadWrap`
 * in lib/exportStatement.ts. Returns null when there is no letterhead.
 */
export function letterheadPrintConfig(lh: Record<string, any> | null): LetterheadWrap | null {
  if (!lh) return null;
  const d = paperDims(lh.paper_size as string);
  const mm = (v: any, def: number) => (typeof v === 'number' && v >= 0 ? v : def);
  return {
    header: renderLetterheadHeader(lh),
    footer: renderLetterheadFooter(lh),
    paperSize: d.css,
    widthMm: d.w,
    heightMm: d.h,
    marginTop: mm(lh.margin_top, 20),
    marginBottom: mm(lh.margin_bottom, 20),
    marginLeft: mm(lh.margin_left, 25),
    marginRight: mm(lh.margin_right, 25),
  };
}

/** Open a printable letter in a new tab. Returns false if the popup was blocked. */
export function openLetterPrint(html: string): boolean {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) { URL.revokeObjectURL(url); return false; }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
