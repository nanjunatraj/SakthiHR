// Per-employee document-format assignments (Appointment Letter, Payslip). Each
// employee can be assigned a specific letter_templates format per document type;
// generation uses the assigned format, else the category default. Stored in the
// generic `lookup_values` table (category 'employee_doc_format', code
// `${employeeId}|${docCategory}`, metadata { templateId }) — no dedicated table.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const edb = supabase as unknown as SupabaseClient;
const LV_CATEGORY = 'employee_doc_format';

export type DocFormatCategory = 'appointment' | 'payslip';

export const DOC_FORMAT_CATEGORIES: { key: DocFormatCategory; label: string }[] = [
  { key: 'appointment', label: 'Appointment Letter' },
  { key: 'payslip', label: 'Payslip' },
];

export interface FormatTemplateOpt { id: string; name: string; isDefault: boolean }

/** Active templates of a letter category (for the assignment dropdowns). */
export async function loadTemplatesByCategory(category: string): Promise<FormatTemplateOpt[]> {
  const { data } = await edb.from('letter_templates')
    .select('id, name, is_default, is_active')
    .eq('category', category).eq('is_active', true).order('is_default', { ascending: false }).order('name');
  return ((data ?? []) as Record<string, any>[]).map(r => ({ id: r.id, name: r.name ?? '', isDefault: !!r.is_default }));
}

const codeOf = (empId: string, doc: DocFormatCategory) => `${empId}|${doc}`;

/** The employee's explicit format assignments (docCategory → templateId). */
export async function loadEmployeeFormats(empId: string): Promise<Partial<Record<DocFormatCategory, string>>> {
  if (!empId) return {};
  const { data } = await edb.from('lookup_values').select('code, metadata').eq('category', LV_CATEGORY);
  const out: Partial<Record<DocFormatCategory, string>> = {};
  ((data ?? []) as Record<string, any>[]).forEach(r => {
    const [eid, doc] = String(r.code ?? '').split('|');
    const tid = r.metadata?.templateId;
    if (eid === empId && tid) out[doc as DocFormatCategory] = tid;
  });
  return out;
}

/** Assign (templateId) or clear (null → use default) a format for an employee + doc type. */
export async function setEmployeeFormat(empId: string, doc: DocFormatCategory, templateId: string | null): Promise<{ error: string | null }> {
  if (!empId) return { error: 'No employee.' };
  const code = codeOf(empId, doc);
  const del = await edb.from('lookup_values').delete().eq('category', LV_CATEGORY).eq('code', code);
  if (del.error) return { error: del.error.message };
  if (templateId) {
    const { error } = await edb.from('lookup_values').insert({
      category: LV_CATEGORY, code, label: doc, metadata: { templateId }, is_active: true,
    } as never);
    if (error) return { error: error.message };
  }
  return { error: null };
}

/** Resolve the effective template id for an employee + doc category:
 *  explicit assignment → category default → first active → null. */
export async function resolveTemplateId(empId: string, doc: DocFormatCategory): Promise<string | null> {
  const [assigned, tpls] = await Promise.all([loadEmployeeFormats(empId), loadTemplatesByCategory(doc)]);
  if (assigned[doc] && tpls.some(t => t.id === assigned[doc])) return assigned[doc]!;
  return (tpls.find(t => t.isDefault) ?? tpls[0])?.id ?? null;
}
