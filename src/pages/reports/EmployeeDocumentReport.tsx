import { todayFormatted } from '../../utils/date';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  ChevronLeft, Search, Eye, Printer, Mail, RefreshCw,
  FileSignature, ScrollText, BadgeCheck, Banknote, MapPin, FileText,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../supabase/client';
import { useEstablishment } from '../../lib/reports';
import {
  loadEmployeeMergeData, loadLetterhead, buildLetterHtml, openLetterPrint,
} from '../../lib/letters';
import { sendEmployeeEmail } from '../../lib/email';

const db = supabase as unknown as SupabaseClient;

// ─── Document catalog ───────────────────────────────────────────────────────────
// Each entry is a self-contained letter/certificate template. `body` receives the
// employee's resolved merge-data map (token → value, from loadEmployeeMergeData) plus
// the establishment name + reference no., and returns the inner HTML of the letter.

type MergeMap = Record<string, string>;
interface DocType {
  slug: string;
  category: string;        // email module slug (see emailCategoryMeta)
  title: string;           // letter title + page heading
  blurb: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  refCode: string;         // used in the auto reference no.
  body: (d: MergeMap, ctx: { company: string; refNo: string; today: string }) => string;
}

const g = (d: MergeMap, token: string) => (d[token] ?? '').trim();
const orDash = (v: string) => (v ? v : '—');

const today = () => todayFormatted();

const refMeta = (d: MergeMap, refNo: string, todayStr: string) =>
  `<table style="width:100%;border-collapse:collapse;margin:0 0 22px;font-size:13px;">
     <tr>
       <td style="vertical-align:top;">Ref: <strong>${refNo}</strong></td>
       <td style="vertical-align:top;text-align:right;">Date: <strong>${todayStr}</strong></td>
     </tr>
   </table>`;

const signature = (company: string) =>
  `<div style="margin-top:48px;">
     <p style="margin:0 0 2px;">For <strong>${company || 'the Company'}</strong>,</p>
     <div style="height:46px;"></div>
     <p style="margin:0;font-weight:700;">Authorised Signatory</p>
     <p style="margin:0;font-size:12px;color:#475569;">Human Resources Department</p>
   </div>`;

const heading = (t: string) =>
  `<h2 style="text-align:center;text-transform:uppercase;letter-spacing:1px;font-size:18px;margin:0 0 6px;">${t}</h2>
   <div style="width:64px;height:3px;background:#1e3a5f;margin:0 auto 22px;"></div>`;

const DOC_TYPES: Record<string, DocType> = {
  appointment: {
    slug: 'appointment', category: 'appointment', title: 'Appointment Order', refCode: 'APO',
    blurb: 'Personalised appointment order confirming the role, location and terms of employment.',
    icon: FileSignature,
    body: (d, c) => {
      const name = orDash(g(d, '{{employee.name}}'));
      return `${refMeta(d, c.refNo, c.today)}
        ${heading('Appointment Order')}
        <p>Dear ${name},</p>
        <p>With reference to your application and the subsequent selection process, we are pleased to appoint you as
        <strong>${orDash(g(d, '{{employment.designation}}'))}</strong> in the
        <strong>${orDash(g(d, '{{employment.department}}'))}</strong> department at
        <strong>${orDash(g(d, '{{employment.workLocation}}'))}</strong>, with effect from
        <strong>${orDash(g(d, '{{employment.doj}}'))}</strong>.</p>
        <p>Your annual cost to company (CTC) shall be <strong>${orDash(g(d, '{{salary.ctcAnnual}}'))}</strong>
        (<strong>${orDash(g(d, '{{salary.ctcMonthly}}'))}</strong> per month), subject to applicable statutory
        deductions. Your employee identification number is <strong>${orDash(g(d, '{{employee.code}}'))}</strong>.</p>
        <p>This appointment is governed by the terms and conditions of service, the standing orders and the policies of
        the organisation as amended from time to time. You will be on probation as per company policy, during which your
        performance and conduct will be assessed for confirmation of services.</p>
        <p>We welcome you to the organisation and look forward to a long and mutually rewarding association.</p>
        ${signature(c.company)}`;
    },
  },
  experience: {
    slug: 'experience', category: 'experience', title: 'Experience Certificate', refCode: 'EXP',
    blurb: 'Experience certificate confirming the period and nature of service.',
    icon: ScrollText,
    body: (d, c) => `${refMeta(d, c.refNo, c.today)}
      ${heading('Experience Certificate')}
      <p style="text-align:center;font-weight:600;margin:0 0 18px;">TO WHOMSOEVER IT MAY CONCERN</p>
      <p>This is to certify that <strong>${orDash(g(d, '{{employee.name}}'))}</strong>
      ${g(d, '{{employee.fatherName}}') ? `, ${g(d, '{{employee.fatherName}}')}'s ${g(d, '{{employee.gender}}') === 'Female' ? 'daughter' : 'son'},` : ''}
      bearing Employee ID <strong>${orDash(g(d, '{{employee.code}}'))}</strong>, was employed with
      <strong>${c.company || 'our organisation'}</strong> as
      <strong>${orDash(g(d, '{{employment.designation}}'))}</strong> in the
      <strong>${orDash(g(d, '{{employment.department}}'))}</strong> department.</p>
      <p>The employee served the organisation from <strong>${orDash(g(d, '{{employment.doj}}'))}</strong> to date at
      <strong>${orDash(g(d, '{{employment.workLocation}}'))}</strong>. During the tenure of service, we found the
      conduct and performance to be satisfactory.</p>
      <p>We wish the employee success in all future endeavours.</p>
      ${signature(c.company)}`,
  },
  service: {
    slug: 'service', category: 'service', title: 'Service Certificate', refCode: 'SVC',
    blurb: 'Service certificate confirming current, ongoing employment.',
    icon: BadgeCheck,
    body: (d, c) => `${refMeta(d, c.refNo, c.today)}
      ${heading('Service Certificate')}
      <p style="text-align:center;font-weight:600;margin:0 0 18px;">TO WHOMSOEVER IT MAY CONCERN</p>
      <p>This is to certify that <strong>${orDash(g(d, '{{employee.name}}'))}</strong> (Employee ID
      <strong>${orDash(g(d, '{{employee.code}}'))}</strong>) is presently working with
      <strong>${c.company || 'our organisation'}</strong> as
      <strong>${orDash(g(d, '{{employment.designation}}'))}</strong> in the
      <strong>${orDash(g(d, '{{employment.department}}'))}</strong> department at
      <strong>${orDash(g(d, '{{employment.workLocation}}'))}</strong>.</p>
      <p>The employee has been in continuous service of the organisation since
      <strong>${orDash(g(d, '{{employment.doj}}'))}</strong> and continues to be on the rolls of the company as on the
      date of this certificate.</p>
      <p>This certificate is issued at the request of the employee for record purposes.</p>
      ${signature(c.company)}`,
  },
  'income-proof': {
    slug: 'income-proof', category: 'income', title: 'Income Proof', refCode: 'INC',
    blurb: 'Salary / income certificate stating the employee’s remuneration.',
    icon: Banknote,
    body: (d, c) => `${refMeta(d, c.refNo, c.today)}
      ${heading('Salary / Income Certificate')}
      <p style="text-align:center;font-weight:600;margin:0 0 18px;">TO WHOMSOEVER IT MAY CONCERN</p>
      <p>This is to certify that <strong>${orDash(g(d, '{{employee.name}}'))}</strong> (Employee ID
      <strong>${orDash(g(d, '{{employee.code}}'))}</strong>) is employed with
      <strong>${c.company || 'our organisation'}</strong> as
      <strong>${orDash(g(d, '{{employment.designation}}'))}</strong>,
      <strong>${orDash(g(d, '{{employment.department}}'))}</strong> department, since
      <strong>${orDash(g(d, '{{employment.doj}}'))}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:14px;">
        <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;">Gross Monthly Remuneration (CTC)</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${orDash(g(d, '{{salary.ctcMonthly}}'))}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;">Annual Cost to Company (CTC)</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${orDash(g(d, '{{salary.ctcAnnual}}'))}</td></tr>
        <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;">PAN</td>
            <td style="padding:6px 10px;border:1px solid #cbd5e1;text-align:right;">${orDash(g(d, '{{statutory.pan}}'))}</td></tr>
      </table>
      <p>This certificate is issued at the request of the employee for the purpose of furnishing income proof and may
      be used for loan, visa or other official purposes as required.</p>
      ${signature(c.company)}`,
  },
  'address-proof': {
    slug: 'address-proof', category: 'address', title: 'Address Proof', refCode: 'ADP',
    blurb: 'Residential address-proof letter for a bonafide employee.',
    icon: MapPin,
    body: (d, c) => `${refMeta(d, c.refNo, c.today)}
      ${heading('Address Proof')}
      <p style="text-align:center;font-weight:600;margin:0 0 18px;">TO WHOMSOEVER IT MAY CONCERN</p>
      <p>This is to certify that <strong>${orDash(g(d, '{{employee.name}}'))}</strong>
      ${g(d, '{{employee.fatherName}}') ? `, ${g(d, '{{employee.fatherName}}')}'s ${g(d, '{{employee.gender}}') === 'Female' ? 'daughter' : 'son'},` : ''}
      bearing Employee ID <strong>${orDash(g(d, '{{employee.code}}'))}</strong>, is a bonafide employee of
      <strong>${c.company || 'our organisation'}</strong>, working as
      <strong>${orDash(g(d, '{{employment.designation}}'))}</strong> since
      <strong>${orDash(g(d, '{{employment.doj}}'))}</strong>.</p>
      <p>As per our records, the residential address of the employee is:</p>
      <p style="margin:6px 0 16px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;">
        <strong>${orDash(g(d, '{{employee.address}}'))}</strong>
      </p>
      <p>This letter is issued at the request of the employee for the purpose of address verification.</p>
      ${signature(c.company)}`,
  },
};

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

interface EmpRow { id: string; employee_id: string | null; first_name: string | null; middle_name: string | null; last_name: string | null; email: string | null; }
const empName = (e: EmpRow) => [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ');

export default function EmployeeDocumentReport() {
  const navigate = useNavigate();
  const est = useEstablishment();
  const { docType = '' } = useParams();
  const doc = DOC_TYPES[docType];

  const [rows, setRows] = useState<EmpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [merge, setMerge] = useState<MergeMap | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await db.from('employees')
        .select('id, employee_id, first_name, middle_name, last_name, email').order('first_name');
      if (!active) return;
      if (error) { console.warn('[employee-document] load failed:', error.message); setRows([]); }
      else setRows((data ?? []) as EmpRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => empName(r).toLowerCase().includes(q) || String(r.employee_id ?? '').toLowerCase().includes(q));
  }, [rows, search]);

  useEffect(() => { if (!selectedId && rows.length) setSelectedId(rows[0].id); }, [rows, selectedId]);

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId]);

  const refNo = useMemo(() => {
    if (!selected || !doc) return '';
    return `${(est.name || 'ORG').slice(0, 3).toUpperCase()}/${doc.refCode}/${new Date().getFullYear()}/${selected.employee_id || '0000'}`;
  }, [selected, doc, est.name]);

  // Load real merge data whenever the selected employee changes.
  useEffect(() => {
    if (!selectedId) { setMerge(null); return; }
    let active = true;
    setMergeLoading(true);
    void (async () => {
      const data = await loadEmployeeMergeData(selectedId, refNo);
      if (active) { setMerge(data); setMergeLoading(false); }
    })();
    return () => { active = false; };
  }, [selectedId, refNo]);

  const bodyHtml = useMemo(() => {
    if (!doc || !merge) return '';
    return doc.body(merge, { company: est.name || '', refNo, today: today() });
  }, [doc, merge, est.name, refNo]);

  const documentTitle = useMemo(
    () => (selected && doc ? `${doc.title} — ${empName(selected)}` : doc?.title ?? ''),
    [selected, doc]);

  const handlePrint = async () => {
    if (!bodyHtml || !selectedId) return;
    const lh = await loadLetterhead(selectedId);
    const html = buildLetterHtml({ title: documentTitle, bodyHtml, letterhead: lh, useLetterhead: true });
    if (!openLetterPrint(html)) toast.error('Popup blocked — allow popups to view/print.');
  };

  const handleEmail = async () => {
    if (!bodyHtml || !selected || !doc) return;
    const to = merge?.['{{employee.email}}']?.trim();
    if (!to) { toast.error('This employee has no email address on file.'); return; }
    setSending(true);
    try {
      const lh = await loadLetterhead(selected.id);
      const html = buildLetterHtml({ title: documentTitle, bodyHtml, letterhead: lh, useLetterhead: true, withToolbar: false });
      const res = await sendEmployeeEmail({
        employeeId: selected.id, toEmail: to, category: doc.category,
        documentTitle, message: `<p>Dear ${empName(selected)},</p><p>Please find your <strong>${doc.title}</strong> attached.</p>`,
        documentHtml: html,
      });
      if (res.error) toast.error(`Email failed: ${res.error}`);
      else if (res.status === 'Simulated') toast.success('Email simulated (SMTP not configured) — logged in Email Communications.');
      else if (res.status === 'No Email') toast.error('No recipient email — nothing sent.');
      else toast.success(`${doc.title} emailed to ${to}.`);
    } catch (e) {
      toast.error(`Email failed: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  };

  if (!doc) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <FileText size={36} className="mx-auto text-muted-foreground mb-3" />
            <h1 className="text-lg font-bold mb-1">Unknown document type</h1>
            <p className="text-sm text-muted-foreground mb-4">“{docType}” is not a recognised employee document.</p>
            <button onClick={() => navigate('/reports/g/employee')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Back to Employee Reports</button>
          </div>
        </main>
      </div>
    );
  }

  const Icon = doc.icon;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/employee')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-blue-100 rounded-lg"><Icon size={22} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold">{doc.title}</h1>
                <p className="text-xs text-muted-foreground">{doc.blurb}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleEmail} disabled={!selected || !bodyHtml || sending}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium disabled:opacity-50">
                {sending ? <RefreshCw size={15} className="animate-spin" /> : <Mail size={15} />} Email
              </button>
              <button onClick={handlePrint} disabled={!selected || !bodyHtml}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50">
                <Printer size={15} /> View / Print
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Employee Picker */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4 h-fit lg:sticky lg:top-24">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
            </div>
            <div className="text-[11px] text-muted-foreground mb-2 px-1">{filtered.length} employees</div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-3"><RefreshCw size={14} className="animate-spin" /> Loading employees…</div>}
              {!loading && filtered.length === 0 && <div className="text-sm text-muted-foreground px-2 py-3">No employees found.</div>}
              {filtered.map(r => {
                const name = empName(r);
                const active = r.id === selectedId;
                return (
                  <button key={r.id} onClick={() => setSelectedId(r.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${active ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent border border-transparent'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>{initialsOf(name)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name || '—'}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{r.employee_id || '—'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live letter preview */}
          <div>
            {!selected ? (
              <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center text-muted-foreground text-sm">
                {loading ? 'Loading…' : 'Select an employee to generate the document.'}
              </div>
            ) : mergeLoading || !merge ? (
              <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <RefreshCw size={15} className="animate-spin" /> Loading employee data…
              </div>
            ) : (
              <div className="bg-slate-200/60 rounded-xl border border-border p-6 flex justify-center">
                <div className="bg-white shadow-lg w-full max-w-[210mm] px-[18mm] py-[16mm] text-[14px] leading-[1.7] text-gray-800"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              </div>
            )}
            {selected && merge && (
              <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                <Eye size={12} /> Live preview (letter body only). Use <strong>View / Print</strong> to render on the work-location letterhead.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
