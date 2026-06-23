import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import { toast } from 'react-toastify';
import type { LucideIcon } from 'lucide-react';
import {
  FileText, ChevronLeft, Plus, Search, X, Pencil, Trash2, Copy, Star,
  Eye, Send, Printer, Download, CheckCircle2, FileSignature, Power, Users, Info, Wand2,
  Wallet, CalendarDays, Banknote, Clock, ShieldAlert, ChevronDown, ChevronRight,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import {
  LETTER_CATEGORIES, LETTER_LANGUAGES, categoryLabel, PLACEHOLDER_GROUPS, SAMPLE_MERGE_DATA,
  mergeTemplate, loadEmployeeMergeData, loadLetterhead, buildLetterHtml, openLetterPrint,
} from '../../lib/letters';
import {
  loadPayslipPeriods, loadPayslipData, buildPayslipBody, type PayslipPeriodOpt,
  parsePayslipConfig, PAYSLIP_HEADER_FIELDS, PAYSLIP_COLUMN_LABELS, SAMPLE_PAYSLIP_DOC,
  type PayslipConfig, type PayslipColumn,
} from '../../lib/payslipTemplate';
import { resolveTemplateId, type DocFormatCategory } from '../../lib/employeeFormats';
import { LETTER_MODELS } from '../../lib/letterModels';

const tdb = supabase as unknown as SupabaseClient;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LetterTemplate {
  id: string;
  category: string;
  name: string;
  subject: string;
  body: string;
  useLetterhead: boolean;
  isDefault: boolean;
  isActive: boolean;
  language: string;
}

interface GeneratedLetter {
  id: string;
  templateId: string | null;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  category: string;
  title: string;
  bodyHtml: string;
  useLetterhead: boolean;
  refNo: string;
  status: string;
  sentAt: string | null;
  acknowledgedAt: string | null;
}

interface EmpPick { id: string; code: string; name: string }

const rowToTemplate = (r: Record<string, any>): LetterTemplate => ({
  id: r.id, category: r.category ?? '', name: r.name ?? '', subject: r.subject ?? '',
  body: r.body ?? '', useLetterhead: r.use_letterhead !== false, isDefault: !!r.is_default, isActive: r.is_active !== false,
  language: r.language ?? 'English',
});

const rowToGenerated = (r: Record<string, any>): GeneratedLetter => {
  const e = r.employee ?? null;
  const name = e ? [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') : '';
  return {
    id: r.id, templateId: r.template_id ?? null, employeeId: r.employee_id ?? '',
    employeeName: name, employeeCode: e?.employee_id ?? '', category: r.category ?? '',
    title: r.title ?? '', bodyHtml: r.body_html ?? '', useLetterhead: r.use_letterhead !== false,
    refNo: r.ref_no ?? '', status: r.status ?? 'Draft',
    sentAt: r.sent_at ?? null, acknowledgedAt: r.acknowledged_at ?? null,
  };
};

const inputCls = 'w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all';

// Letter categories grouped by the HR activity / module they belong to. Drives the
// grouped, collapsible category rail. Every LETTER_CATEGORIES key is placed in exactly
// one group; any new/unmapped key falls back to an "Other" group (computed below).
interface CategoryGroup { label: string; icon: LucideIcon; cats: string[] }
const CATEGORY_GROUPS: CategoryGroup[] = [
  { label: 'Employee', icon: Users, cats: ['offer', 'appointment', 'experience', 'service', 'relieving', 'resignation_acceptance', 'exit_interview', 'retirement_notice', 'condolence'] },
  { label: 'Payroll', icon: Wallet, cats: ['payslip', 'deduction', 'fnf'] },
  { label: 'Leave', icon: CalendarDays, cats: ['leave_application'] },
  { label: 'Loan & Advances', icon: Banknote, cats: ['loan_application'] },
  { label: 'Attendance', icon: Clock, cats: ['late_warning', 'lop_absence'] },
  { label: 'Disciplinary Action', icon: ShieldAlert, cats: ['show_cause', 'termination', 'disciplinary', 'memo'] },
];

function genRefNo(): string {
  const y = new Date().getFullYear();
  return `REF/${y}/${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

// ─── Template editor modal ──────────────────────────────────────────────────────

interface EditorProps {
  initial: Partial<LetterTemplate> & { category: string };
  onClose: () => void;
  onSaved: () => void;
}

const TemplateEditor = ({ initial, onClose, onSaved }: EditorProps) => {
  const [name, setName] = useState(initial.name ?? '');
  const [subject, setSubject] = useState(initial.subject ?? '');
  const [body, setBody] = useState(initial.body ?? '');
  const [useLetterhead, setUseLetterhead] = useState(initial.useLetterhead ?? true);
  const [isActive, setIsActive] = useState(initial.isActive ?? true);
  const [isDefault, setIsDefault] = useState(initial.isDefault ?? false);
  const [language, setLanguage] = useState(initial.language ?? 'English');
  const [saving, setSaving] = useState(false);
  const [letterhead, setLetterhead] = useState<Record<string, any> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const isPayslip = initial.category === 'payslip';
  const [psConfig, setPsConfig] = useState<PayslipConfig>(() => parsePayslipConfig(initial.body));

  const toggleHeaderField = (key: string) => setPsConfig(c => ({
    ...c, headerFields: c.headerFields.includes(key) ? c.headerFields.filter(k => k !== key) : [...c.headerFields, key],
  }));
  const toggleColumn = (col: PayslipColumn) => setPsConfig(c => {
    const next = { ...c.columns, [col]: !c.columns[col] };
    if (!next.actual && !next.earned && !next.ytd) return c; // keep at least one
    return { ...c, columns: next };
  });

  useEffect(() => { void loadLetterhead().then(setLetterhead); }, []);

  const insertToken = (token: string) => {
    const el = bodyRef.current;
    if (!el) { setBody(b => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  };

  const previewHtml = useMemo(() => {
    if (isPayslip) {
      return buildLetterHtml({ title: name || 'Payslip', bodyHtml: buildPayslipBody(SAMPLE_PAYSLIP_DOC, '₹', psConfig), letterhead, useLetterhead, withToolbar: false });
    }
    const mergedSubject = mergeTemplate(subject || '', SAMPLE_MERGE_DATA);
    const mergedBody = mergeTemplate(body || '<p style="color:#94a3b8">Start typing the letter body…</p>', SAMPLE_MERGE_DATA, true);
    const titled = mergedSubject ? `<h2 style="text-align:center;margin:0 0 18px;font-size:16px;">${mergedSubject}</h2>` : '';
    return buildLetterHtml({ title: mergedSubject || name || 'Preview', bodyHtml: titled + mergedBody, letterhead, useLetterhead, withToolbar: false });
  }, [isPayslip, psConfig, subject, body, name, letterhead, useLetterhead]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Template name is required.'); return; }
    setSaving(true);
    const row = {
      category: initial.category, name: name.trim(), subject: subject.trim() || null,
      body: isPayslip ? JSON.stringify(psConfig) : body, use_letterhead: useLetterhead, is_active: isActive, is_default: isDefault, language, updated_at: new Date().toISOString(),
    };
    let id = initial.id;
    if (id) {
      const { error } = await tdb.from('letter_templates').update(row).eq('id', id);
      if (error) { setSaving(false); toast.error(error.message); return; }
    } else {
      const { data, error } = await tdb.from('letter_templates').insert(row).select('id').single();
      if (error || !data) { setSaving(false); toast.error(error?.message ?? 'Save failed.'); return; }
      id = (data as any).id;
    }
    if (isDefault && id) {
      await tdb.from('letter_templates').update({ is_default: false }).eq('category', initial.category).neq('id', id);
    }
    setSaving(false);
    toast.success('Template saved.');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-6xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-rose-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-xl"><FileText size={20} className="text-rose-600" /></div>
            <div>
              <h2 className="text-base font-bold text-rose-900">{initial.id ? 'Edit' : 'New'} Format — {categoryLabel(initial.category)}</h2>
              <p className="text-xs text-rose-600">{isPayslip ? 'Payslip content is generated automatically from payroll data — set a name and choose letterhead.' : 'Compose the letter and insert placeholders; the preview merges sample data.'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          {/* Left: editor */}
          <div className="p-5 overflow-y-auto space-y-4 border-r border-border">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Format Name <span className="text-destructive">*</span></label>
                  <input className={inputCls} placeholder="e.g. Standard Offer Letter" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Language</label>
                  <select className={inputCls} value={language} onChange={e => setLanguage(e.target.value)}>
                    {LETTER_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Subject / Heading</label>
                <input className={inputCls} placeholder={isPayslip ? 'e.g. Salary Slip' : 'e.g. Offer of Employment — {{employee.name}}'} value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
            </div>

            {isPayslip ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Header — Employee Fields</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-accent/30 rounded-xl border border-border">
                    {PAYSLIP_HEADER_FIELDS.map(fld => {
                      const on = psConfig.headerFields.includes(fld.key);
                      return (
                        <button key={fld.key} type="button" onClick={() => toggleHeaderField(fld.key)}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-muted-foreground border-border hover:border-indigo-300'}`}>
                          {fld.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Tap to include/exclude on the payslip header.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Attendance Summary</label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={psConfig.attendanceSummary} onChange={() => setPsConfig(c => ({ ...c, attendanceSummary: !c.attendanceSummary }))} className="rounded border-border" />
                    Show working / present / leave / LOP / overtime cards
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Body — Value Columns</label>
                  <div className="flex flex-wrap gap-2">
                    {(['actual', 'earned', 'ytd'] as PayslipColumn[]).map(col => {
                      const on = psConfig.columns[col];
                      return (
                        <button key={col} type="button" onClick={() => toggleColumn(col)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-muted-foreground border-border hover:border-blue-300'}`}>
                          {PAYSLIP_COLUMN_LABELS[col]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Actual = full-month entitlement · Earned = paid this period · YTD = financial-year to date. At least one required.</p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Placeholders — click to insert</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-accent/30 rounded-xl border border-border">
                    {PLACEHOLDER_GROUPS.map(g => (
                      <div key={g.group}>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{g.group}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {g.tokens.map(t => (
                            <button key={t.token} type="button" onClick={() => insertToken(t.token)}
                              className="px-2 py-1 text-[10px] font-mono rounded-md bg-white border border-border hover:border-rose-300 hover:bg-rose-50 transition-colors" title={t.token}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Letter Body <span className="text-[10px] normal-case text-muted-foreground">(HTML allowed — &lt;p&gt;, &lt;b&gt;, &lt;ul&gt;…)</span></label>
                  <textarea ref={bodyRef} className={`${inputCls} font-mono text-xs min-h-[220px] resize-y`} value={body} onChange={e => setBody(e.target.value)}
                    placeholder={'<p>Dear {{employee.name}},</p>\n<p>We are pleased to offer you the position of {{employment.designation}} …</p>'} />
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={useLetterhead} onChange={e => setUseLetterhead(e.target.checked)} className="rounded border-border" />
                Render on letterhead
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded border-border" />
                Active
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded border-border" />
                Default format for this category
              </label>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="bg-accent/20 p-5 overflow-hidden flex flex-col">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{isPayslip ? 'Payslip Layout (sample data)' : 'Live Preview (sample data)'}</p>
            <iframe title="preview" srcDoc={previewHtml} className="flex-1 w-full rounded-xl border border-border bg-white" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-accent/10">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors shadow-md disabled:opacity-50">
            <CheckCircle2 size={15} /> {saving ? 'Saving…' : 'Save Format'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── In-app document viewer (popup-proof View / Print) ───────────────────────────

const DocViewerModal = ({ html, title, onClose }: { html: string; title: string; onClose: () => void }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const printDoc = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-4xl h-[92vh] rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-slate-50 to-indigo-50">
          <div className="flex items-center gap-2"><Eye size={18} className="text-indigo-600" /><h2 className="text-sm font-bold text-indigo-900">{title}</h2></div>
          <div className="flex items-center gap-2">
            <button onClick={printDoc} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              <Printer size={15} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
          </div>
        </div>
        <iframe title="doc-viewer" ref={frameRef} srcDoc={html} className="flex-1 w-full bg-white" />
      </motion.div>
    </div>
  );
};

// ─── Generate-letter modal ──────────────────────────────────────────────────────

interface GenerateProps {
  template: LetterTemplate;
  employees: EmpPick[];
  onClose: () => void;
  onSaved: () => void;
}

const GenerateLetterModal = ({ template, employees, onClose, onSaved }: GenerateProps) => {
  const isPayslip = template.category === 'payslip';
  const [search, setSearch] = useState('');
  const [empId, setEmpId] = useState('');
  const [refNo] = useState(genRefNo());
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [letterhead, setLetterhead] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // Payslip-only state
  const [periods, setPeriods] = useState<PayslipPeriodOpt[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [payslipHtml, setPayslipHtml] = useState<string>('');   // inner body
  const [payslipTitle, setPayslipTitle] = useState('');
  // Effective template — the employee's assigned format for this doc type (else the
  // launched/default template). Only appointment & payslip support per-employee formats.
  const overridable = template.category === 'appointment' || template.category === 'payslip';
  const [effTemplate, setEffTemplate] = useState<LetterTemplate>(template);
  const [usingAssigned, setUsingAssigned] = useState(false);

  const filtered = useMemo(() =>
    employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase())).slice(0, 50),
    [employees, search]);

  // Resolve the employee's assigned format whenever the employee changes.
  useEffect(() => {
    let active = true;
    if (!overridable || !empId) { setEffTemplate(template); setUsingAssigned(false); return; }
    void (async () => {
      const id = await resolveTemplateId(empId, template.category as DocFormatCategory);
      if (!active) return;
      if (id && id !== template.id) {
        const { data: row } = await tdb.from('letter_templates').select('*').eq('id', id).maybeSingle();
        if (!active) return;
        if (row) { setEffTemplate(rowToTemplate(row as Record<string, any>)); setUsingAssigned(true); return; }
      }
      setEffTemplate(template); setUsingAssigned(false);
    })();
    return () => { active = false; };
  }, [empId, overridable, template]);

  // Load processed pay periods for the payslip dropdown.
  useEffect(() => {
    if (!isPayslip) return;
    void loadPayslipPeriods().then(ps => { setPeriods(ps); setPeriodId(p => p || ps[0]?.id || ''); });
  }, [isPayslip]);

  // ── Letter (non-payslip) merge data ──
  useEffect(() => {
    if (isPayslip) return;
    if (!empId) { setData(null); return; }
    setLoading(true);
    Promise.all([loadEmployeeMergeData(empId, refNo), loadLetterhead(empId)]).then(([d, lh]) => {
      setData(d); setLetterhead(lh); setLoading(false);
    });
  }, [empId, refNo, isPayslip]);

  // ── Payslip build (employee + period) ──
  useEffect(() => {
    if (!isPayslip) return;
    if (!empId || !periodId) { setPayslipHtml(''); setData(null); return; }
    const period = periods.find(p => p.id === periodId);
    if (!period) return;
    setLoading(true);
    Promise.all([loadPayslipData(empId, period), loadLetterhead(empId)]).then(([doc, lh]) => {
      setLetterhead(lh);
      if (!doc) { setPayslipHtml(''); setData(null); setLoading(false); return; }
      setPayslipHtml(buildPayslipBody(doc, '₹', parsePayslipConfig(effTemplate.body)));
      setPayslipTitle(`Payslip — ${doc.employee.name} — ${period.name}`);
      setData({ ok: '1' });   // marks "ready" for the enable/disable + persist guards
      setLoading(false);
    });
  }, [isPayslip, empId, periodId, periods, effTemplate]);

  const mergedTitle = useMemo(() => {
    if (isPayslip) return payslipTitle;
    return data ? mergeTemplate(effTemplate.subject || effTemplate.name, data) : '';
  }, [isPayslip, payslipTitle, data, effTemplate]);
  const mergedBody = useMemo(() => (data && !isPayslip ? mergeTemplate(effTemplate.body, data) : ''), [data, effTemplate, isPayslip]);

  const fullBodyHtml = () => {
    if (isPayslip) return payslipHtml;
    const titled = mergedTitle ? `<h2 style="text-align:center;margin:0 0 18px;font-size:16px;">${mergedTitle}</h2>` : '';
    return titled + mergedBody;
  };

  const previewHtml = useMemo(() => {
    if (!data) return '';
    return buildLetterHtml({ title: mergedTitle, bodyHtml: fullBodyHtml(), letterhead, useLetterhead: effTemplate.useLetterhead, withToolbar: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mergedTitle, mergedBody, payslipHtml, letterhead, effTemplate, isPayslip]);

  const [viewerHtml, setViewerHtml] = useState<string | null>(null);
  const openViewer = () => {
    if (!data) return;
    // No in-page toolbar — the viewer modal supplies its own Print button.
    setViewerHtml(buildLetterHtml({ title: mergedTitle, bodyHtml: fullBodyHtml(), letterhead, useLetterhead: effTemplate.useLetterhead, withToolbar: false }));
  };
  const printNow = () => {
    if (!data) return;
    const html = buildLetterHtml({ title: mergedTitle, bodyHtml: fullBodyHtml(), letterhead, useLetterhead: effTemplate.useLetterhead });
    if (!openLetterPrint(html)) toast.error('Popup blocked — use “View / Print” to open it in-app.');
  };

  const persist = async (status: 'Draft' | 'Sent') => {
    if (!empId || !data) { toast.error(isPayslip ? 'Select an employee and pay period first.' : 'Select an employee first.'); return; }
    setBusy(true);
    const row: Record<string, any> = {
      template_id: effTemplate.id, employee_id: empId, category: effTemplate.category,
      title: mergedTitle, body_html: fullBodyHtml(), use_letterhead: effTemplate.useLetterhead,
      ref_no: refNo, status, updated_at: new Date().toISOString(),
    };
    if (status === 'Sent') row.sent_at = new Date().toISOString();
    const { error } = await tdb.from('generated_letters').insert(row);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'Sent'
      ? (isPayslip ? 'Payslip sent to employee.' : 'Letter sent to employee for acknowledgement.')
      : (isPayslip ? 'Payslip saved as draft.' : 'Letter saved as draft.'));
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card w-full max-w-6xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl"><FileSignature size={20} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-base font-bold text-indigo-900">Generate — {template.name}</h2>
              <p className="text-xs text-indigo-600">{categoryLabel(template.category)} · {template.language || 'English'} · Ref {refNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          <div className="p-5 overflow-y-auto border-r border-border">
            {isPayslip && (
              <div className="mb-4">
                <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Pay Period</label>
                {periods.length === 0
                  ? <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">No processed payroll runs yet. Run payroll for a period to generate payslips.</p>
                  : <select className={inputCls} value={periodId} onChange={e => setPeriodId(e.target.value)}>
                      {periods.map(p => <option key={p.id} value={p.id}>{p.name}{p.financialYear ? ` · FY ${p.financialYear}` : ''}</option>)}
                    </select>}
              </div>
            )}
            <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Select Employee</label>
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className={`${inputCls} pl-9`} placeholder="Search by name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {filtered.map(e => (
                <button key={e.id} onClick={() => setEmpId(e.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-all ${empId === e.id ? 'bg-indigo-50 border-indigo-300' : 'bg-card border-border hover:border-indigo-200'}`}>
                  <Users size={14} className="text-muted-foreground shrink-0" />
                  <span className="font-medium">{e.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">{e.code}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No employees match.</p>}
            </div>
          </div>

          <div className="bg-accent/20 p-5 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{isPayslip ? 'Payslip Preview' : 'Letter Preview'}</p>
              {overridable && empId && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${usingAssigned ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {usingAssigned ? `Assigned format: ${effTemplate.name}` : 'Default format'}
                </span>
              )}
            </div>
            {data
              ? <iframe title="gen-preview" srcDoc={previewHtml} className="flex-1 w-full rounded-xl border border-border bg-white" />
              : <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground rounded-xl border border-dashed border-border bg-white text-center px-4">{loading ? 'Loading…' : isPayslip ? (empId && periodId ? 'No processed payroll found for this employee in the selected period.' : 'Select a pay period and employee to preview the payslip.') : 'Select an employee to preview the letter.'}</div>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex flex-wrap justify-end gap-2 bg-accent/10">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={openViewer} disabled={!data} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent text-sm font-medium disabled:opacity-50">
            <Eye size={15} /> View / Print
          </button>
          <button onClick={printNow} disabled={!data} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent text-sm font-medium disabled:opacity-50" title="Open in a new browser tab">
            <Printer size={15} /> Open in Tab
          </button>
          <button onClick={() => persist('Draft')} disabled={!data || busy} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent text-sm font-medium disabled:opacity-50">
            <Download size={15} /> Save Draft
          </button>
          <button onClick={() => persist('Sent')} disabled={!data || busy} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50">
            <Send size={15} /> Send to Employee
          </button>
        </div>
      </motion.div>
      {viewerHtml && <DocViewerModal html={viewerHtml} title={mergedTitle || (isPayslip ? 'Payslip' : 'Letter')} onClose={() => setViewerHtml(null)} />}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplateMaster({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'templates' | 'issued'>('templates');
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [issued, setIssued] = useState<GeneratedLetter[]>([]);
  const [employees, setEmployees] = useState<EmpPick[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>(LETTER_CATEGORIES[0].key);
  const [editor, setEditor] = useState<(Partial<LetterTemplate> & { category: string }) | null>(null);
  const [generateFor, setGenerateFor] = useState<LetterTemplate | null>(null);
  const [viewer, setViewer] = useState<{ html: string; title: string } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (label: string) => setCollapsedGroups(prev => {
    const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n;
  });

  // Activity groups, plus a catch-all "Other" for any category not explicitly mapped.
  const activityGroups = useMemo<CategoryGroup[]>(() => {
    const mapped = new Set(CATEGORY_GROUPS.flatMap(g => g.cats));
    const other = LETTER_CATEGORIES.map(c => c.key).filter(k => !mapped.has(k));
    return other.length ? [...CATEGORY_GROUPS, { label: 'Other', icon: FileText, cats: other }] : CATEGORY_GROUPS;
  }, []);

  const loadTemplates = useCallback(() => {
    void tdb.from('letter_templates').select('*').order('category').order('name')
      .then(({ data }) => setTemplates(((data ?? []) as Record<string, any>[]).map(rowToTemplate)));
  }, []);
  const loadIssued = useCallback(() => {
    void tdb.from('generated_letters').select('*, employee:employee_id(employee_id, first_name, middle_name, last_name)').order('created_at', { ascending: false })
      .then(({ data }) => setIssued(((data ?? []) as Record<string, any>[]).map(rowToGenerated)));
  }, []);
  useEffect(() => {
    loadTemplates(); loadIssued();
    void tdb.from('employees').select('id, employee_id, first_name, middle_name, last_name').order('first_name')
      .then(({ data }) => setEmployees(((data ?? []) as Record<string, any>[]).map(e => ({
        id: e.id, code: e.employee_id ?? '', name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
      }))));
  }, [loadTemplates, loadIssued]);

  const countByCat = useMemo(() => {
    const m: Record<string, number> = {};
    templates.forEach(t => { m[t.category] = (m[t.category] ?? 0) + 1; });
    return m;
  }, [templates]);

  const catTemplates = templates.filter(t => t.category === selectedCat);

  const toggleActive = async (t: LetterTemplate) => {
    await tdb.from('letter_templates').update({ is_active: !t.isActive, updated_at: new Date().toISOString() }).eq('id', t.id);
    loadTemplates();
  };
  const setDefault = async (t: LetterTemplate) => {
    await tdb.from('letter_templates').update({ is_default: false }).eq('category', t.category);
    await tdb.from('letter_templates').update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', t.id);
    loadTemplates();
    toast.success(`"${t.name}" set as default ${categoryLabel(t.category)}.`);
  };
  const duplicate = async (t: LetterTemplate) => {
    await tdb.from('letter_templates').insert({
      category: t.category, name: `${t.name} (Copy)`, subject: t.subject || null, body: t.body,
      use_letterhead: t.useLetterhead, is_active: t.isActive, is_default: false, language: t.language,
    });
    loadTemplates();
    toast.success('Format duplicated.');
  };
  const removeTemplate = async (t: LetterTemplate) => {
    await tdb.from('letter_templates').delete().eq('id', t.id);
    loadTemplates();
    toast.info('Format deleted.');
  };

  // Seed the model (starter) format for every category that currently has none —
  // each becomes the default, active format for its category and is fully editable
  // in the designer. Idempotent: categories that already have a format are skipped.
  const [seeding, setSeeding] = useState(false);
  const loadModelFormats = async () => {
    const missing = Object.keys(LETTER_MODELS).filter(cat => (countByCat[cat] ?? 0) === 0);
    if (missing.length === 0) { toast.info('Every category already has a format — nothing to load.'); return; }
    setSeeding(true);
    const rows = missing.map(cat => {
      const m = LETTER_MODELS[cat];
      return {
        category: cat, name: m.name, subject: m.subject, body: m.body,
        use_letterhead: m.useLetterhead !== false, is_default: true, is_active: true, language: 'English',
      };
    });
    const { error } = await tdb.from('letter_templates').insert(rows);
    setSeeding(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Loaded ${missing.length} model format${missing.length !== 1 ? 's' : ''} — open any category to review or edit.`);
    loadTemplates();
  };

  const viewIssued = async (g: GeneratedLetter) => {
    const lh = g.useLetterhead ? await loadLetterhead(g.employeeId) : null;
    // In-app viewer (popup-proof) with its own Print button — no toolbar in the HTML.
    const html = buildLetterHtml({ title: g.title || 'Letter', bodyHtml: g.bodyHtml, letterhead: lh, useLetterhead: g.useLetterhead, withToolbar: false });
    setViewer({ html, title: g.title || 'Document' });
  };
  const removeIssued = async (g: GeneratedLetter) => {
    await tdb.from('generated_letters').delete().eq('id', g.id);
    loadIssued();
    toast.info('Letter deleted.');
  };

  const STATUS_STYLE: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-600 border-gray-200',
    Sent: 'bg-amber-100 text-amber-700 border-amber-200',
    Acknowledged: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
              <div className="p-2 bg-rose-100 rounded-lg"><FileText size={22} className="text-rose-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Template Master</h1>
                <p className="text-xs text-muted-foreground">Define letter/form templates, generate on letterhead, and send to employees for eSign acknowledgement.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={loadModelFormats} disabled={seeding}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-md hover:from-rose-700 hover:to-orange-600 transition-all disabled:opacity-50"
                title="Create a starter format for every category that has none">
                <Wand2 size={15} /> {seeding ? 'Loading…' : 'Load Model Formats'}
              </button>
              <div className="flex items-center gap-2 bg-accent/50 p-1 rounded-xl">
                <button onClick={() => setTab('templates')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'templates' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Templates</button>
                <button onClick={() => setTab('issued')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'issued' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Issued Letters {issued.length > 0 && <span className="ml-1 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">{issued.length}</span>}</button>
              </div>
            </div>
          </div>
        </div>

        {tab === 'templates' ? (
          <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
            {/* Category rail — grouped by activity */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden h-fit">
              <div className="px-4 py-3 border-b border-border bg-accent/30"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Categories by Activity</p></div>
              <div className="p-2 space-y-1 max-h-[72vh] overflow-y-auto">
                {activityGroups.map(group => {
                  const Icon = group.icon;
                  const total = group.cats.reduce((s, c) => s + (countByCat[c] ?? 0), 0);
                  const open = !collapsedGroups.has(group.label);
                  return (
                    <div key={group.label}>
                      <button onClick={() => toggleGroup(group.label)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left hover:bg-accent/60 transition-colors">
                        {open ? <ChevronDown size={13} className="text-muted-foreground shrink-0" /> : <ChevronRight size={13} className="text-muted-foreground shrink-0" />}
                        <Icon size={14} className="text-rose-500 shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">{group.label}</span>
                        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">{total}</span>
                      </button>
                      {open && (
                        <div className="mt-0.5 ml-3 pl-2 border-l border-border space-y-0.5">
                          {group.cats.map(catKey => (
                            <button key={catKey} onClick={() => setSelectedCat(catKey)}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-all ${selectedCat === catKey ? 'bg-rose-50 text-rose-700 font-semibold' : 'text-foreground hover:bg-accent'}`}>
                              <span className="truncate">{categoryLabel(catKey)}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${countByCat[catKey] ? 'bg-rose-100 text-rose-700' : 'bg-accent text-muted-foreground'}`}>{countByCat[catKey] ?? 0}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Formats for category */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">{categoryLabel(selectedCat)}</h2>
                  <p className="text-xs text-muted-foreground">{catTemplates.length} format{catTemplates.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setEditor({ category: selectedCat })} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-medium shadow-md">
                  <Plus size={16} /> New Format
                </button>
              </div>

              {catTemplates.length === 0 ? (
                <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                  <FileText size={28} className="text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground">No formats yet for {categoryLabel(selectedCat)}</p>
                  <button onClick={() => setEditor({ category: selectedCat })} className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-medium">
                    <Plus size={15} /> Create the first format
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catTemplates.map(t => (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm truncate">{t.name}</h3>
                            {t.isDefault && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Star size={8} /> Default</span>}
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${t.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                            {t.language && t.language !== 'English' && <span className="text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">{t.language}</span>}
                          </div>
                          {t.subject && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.subject}</p>}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-3">{t.useLetterhead ? 'On letterhead' : 'Plain (no letterhead)'}</p>
                      <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-border">
                        <button onClick={() => setGenerateFor(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"><FileSignature size={12} /> Generate</button>
                        <button onClick={() => setEditor(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"><Pencil size={12} /> Edit</button>
                        <button onClick={() => duplicate(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors"><Copy size={12} /> Duplicate</button>
                        {!t.isDefault && <button onClick={() => setDefault(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"><Star size={12} /> Default</button>}
                        <button onClick={() => toggleActive(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors"><Power size={12} /></button>
                        <button onClick={() => removeTemplate(t)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors ml-auto"><Trash2 size={12} /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-8 py-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <Info size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700">Letters generated and sent to employees appear here. Employees view, print/download, and acknowledge them with Aadhaar eSign in the Self-Service portal.</p>
            </div>
            {issued.length === 0 ? (
              <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                <FileSignature size={28} className="text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-muted-foreground">No letters issued yet</p>
                <p className="text-xs text-muted-foreground mt-1">Generate a letter from a template to get started.</p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Letter</th>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">Category</th>
                        <th className="px-4 py-3 font-semibold">Ref</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {issued.map(g => (
                        <tr key={g.id} className="hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium max-w-[260px] truncate">{g.title || '—'}</td>
                          <td className="px-4 py-3 text-sm">{g.employeeName} <span className="text-[10px] font-mono text-muted-foreground">{g.employeeCode}</span></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{categoryLabel(g.category)}</td>
                          <td className="px-4 py-3 text-[11px] font-mono text-muted-foreground">{g.refNo}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[g.status] ?? STATUS_STYLE.Draft}`}>
                              {g.status === 'Acknowledged' && <CheckCircle2 size={10} />}{g.status}
                            </span>
                            {g.acknowledgedAt && <p className="text-[9px] text-muted-foreground mt-0.5">eSigned</p>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => viewIssued(g)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="View / Print / PDF"><Eye size={14} /></button>
                              <button onClick={() => removeIssued(g)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <AnimatePresence>
        {editor && <TemplateEditor initial={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); loadTemplates(); }} />}
        {generateFor && <GenerateLetterModal template={generateFor} employees={employees} onClose={() => setGenerateFor(null)} onSaved={() => { setGenerateFor(null); loadIssued(); setTab('issued'); }} />}
        {viewer && <DocViewerModal html={viewer.html} title={viewer.title} onClose={() => setViewer(null)} />}
      </AnimatePresence>
    </div>
  );
}
