import React, { useEffect, useState } from 'react';
import { FileSignature, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  DOC_FORMAT_CATEGORIES, loadTemplatesByCategory, loadEmployeeFormats, setEmployeeFormat,
  type DocFormatCategory, type FormatTemplateOpt,
} from '../../lib/employeeFormats';

/**
 * Per-employee document-format assignment (Appointment Letter, Payslip). Lets HR
 * pick a specific format per document type; "Default" falls back to the category
 * default at generation time. Self-contained — persists immediately on change.
 */
export default function EmployeeDocumentFormats({ employeeId }: { employeeId?: string }) {
  const [opts, setOpts] = useState<Record<DocFormatCategory, FormatTemplateOpt[]>>({ appointment: [], payslip: [] });
  const [assigned, setAssigned] = useState<Partial<Record<DocFormatCategory, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<DocFormatCategory | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const [appt, pay, asg] = await Promise.all([
        loadTemplatesByCategory('appointment'),
        loadTemplatesByCategory('payslip'),
        employeeId ? loadEmployeeFormats(employeeId) : Promise.resolve({}),
      ]);
      if (!active) return;
      setOpts({ appointment: appt, payslip: pay });
      setAssigned(asg);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [employeeId]);

  const change = async (doc: DocFormatCategory, templateId: string) => {
    if (!employeeId) return;
    const value = templateId || null;
    setSaving(doc);
    const { error } = await setEmployeeFormat(employeeId, doc, value);
    setSaving(null);
    if (error) { toast.error(error); return; }
    setAssigned(a => { const n = { ...a }; if (value) n[doc] = value; else delete n[doc]; return n; });
    toast.success(value
      ? `${DOC_FORMAT_CATEGORIES.find(c => c.key === doc)?.label} format assigned.`
      : `${DOC_FORMAT_CATEGORIES.find(c => c.key === doc)?.label} format reset to default.`);
  };

  if (!employeeId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-accent/20 p-4 text-xs text-muted-foreground">
        Save the employee first to assign Appointment Letter / Payslip formats.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-indigo-100 rounded-lg"><FileSignature size={15} className="text-indigo-600" /></div>
        <div>
          <h4 className="text-sm font-bold">Document Formats</h4>
          <p className="text-[11px] text-muted-foreground">Assign the format used when generating this employee's documents. “Default” uses the category default.</p>
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-muted-foreground ml-auto" />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DOC_FORMAT_CATEGORIES.map(cat => {
          const list = opts[cat.key];
          const defName = list.find(t => t.isDefault)?.name;
          return (
            <div key={cat.key}>
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">{cat.label}</label>
              <select
                className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50"
                value={assigned[cat.key] ?? ''}
                disabled={loading || saving === cat.key}
                onChange={e => change(cat.key, e.target.value)}
              >
                <option value="">Default{defName ? ` (${defName})` : ''}</option>
                {list.map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' — default' : ''}</option>)}
              </select>
              {list.length === 0 && <p className="text-[10px] text-amber-600 mt-1">No {cat.label} formats yet — create one in Configuration → Template Master.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
