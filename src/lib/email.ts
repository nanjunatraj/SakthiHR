// Email Communication client. Sends go through the `email` Edge Function (which holds
// SMTP config server-side and tracks opens/attachment-views/receipt confirmations).
// One email_deliveries row is logged per recipient per document; its status advances
// Sent → Opened → Viewed → Confirmed as the employee interacts with the mail.
//
// When email isn't configured (or disabled), sends fall back to a "Simulated" log row
// so the UX works without SMTP credentials.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { uploadFile, DOCUMENTS_BUCKET } from './storage';

const edb = supabase as unknown as SupabaseClient;

export type EmailCategory = 'payslip' | 'letter' | 'report' | 'notification' | 'general';
export type EmailStatus =
  | 'Queued' | 'Sent' | 'Opened' | 'Viewed' | 'Confirmed'
  | 'Failed' | 'Bounced' | 'Simulated' | 'No Email';

/**
 * Maps the `category` slug stored on each email delivery to the originating module —
 * the friendly label + chip colour shown in the Email Communications log. Send sites
 * pass a module slug (e.g. a letter category like `offer`, a deduction category like
 * `fines`, or `payslip`) so the log reads "Offer Letter", "Fines", "Payslip" etc.
 * Unknown / legacy slugs fall back to a Title-Cased version of the slug.
 */
export interface EmailCategoryMeta { label: string; color: string }

const EMAIL_CATEGORY_META: Record<string, EmailCategoryMeta> = {
  // Payroll
  payslip:                  { label: 'Payslip',                color: 'bg-emerald-100 text-emerald-700' },
  // HR letters / documents (slugs mirror lib/letters LETTER_CATEGORIES)
  letter:                   { label: 'Letter',                 color: 'bg-blue-100 text-blue-700' },
  offer:                    { label: 'Offer Letter',           color: 'bg-blue-100 text-blue-700' },
  appointment:              { label: 'Appointment Letter',     color: 'bg-blue-100 text-blue-700' },
  experience:               { label: 'Experience Certificate', color: 'bg-blue-100 text-blue-700' },
  relieving:                { label: 'Relieving Letter',       color: 'bg-blue-100 text-blue-700' },
  service:                  { label: 'Service Certificate',    color: 'bg-blue-100 text-blue-700' },
  income:                   { label: 'Income Proof',           color: 'bg-blue-100 text-blue-700' },
  address:                  { label: 'Address Proof',          color: 'bg-blue-100 text-blue-700' },
  resignation_acceptance:   { label: 'Resignation Acceptance', color: 'bg-blue-100 text-blue-700' },
  fnf:                      { label: 'Full & Final Letter',    color: 'bg-blue-100 text-blue-700' },
  exit_interview:           { label: 'Exit Interview Letter',  color: 'bg-blue-100 text-blue-700' },
  show_cause:               { label: 'Show-Cause Notice',      color: 'bg-amber-100 text-amber-700' },
  termination:              { label: 'Termination Letter',     color: 'bg-red-100 text-red-700' },
  retirement_notice:        { label: 'Retirement Notice',      color: 'bg-blue-100 text-blue-700' },
  condolence:               { label: 'Condolence Letter',      color: 'bg-blue-100 text-blue-700' },
  leave_application:        { label: 'Leave Application',      color: 'bg-teal-100 text-teal-700' },
  loan_application:         { label: 'Loan Application',       color: 'bg-indigo-100 text-indigo-700' },
  disciplinary:             { label: 'Disciplinary Action',    color: 'bg-amber-100 text-amber-700' },
  memo:                     { label: 'Memo',                   color: 'bg-slate-100 text-slate-700' },
  late_warning:             { label: 'Late-Coming Warning',    color: 'bg-amber-100 text-amber-700' },
  lop_absence:              { label: 'Unauthorized Absence',   color: 'bg-amber-100 text-amber-700' },
  // Leave
  'leave-approval':         { label: 'Leave Approval',         color: 'bg-teal-100 text-teal-700' },
  // Deductions (slugs mirror DeductionEntry DeductionCategory)
  'loan-advances':          { label: 'Loan & Advances',        color: 'bg-indigo-100 text-indigo-700' },
  'damages-loss':           { label: 'Damages & Loss',         color: 'bg-orange-100 text-orange-700' },
  fines:                    { label: 'Fines',                  color: 'bg-orange-100 text-orange-700' },
  canteen:                  { label: 'Canteen',                color: 'bg-orange-100 text-orange-700' },
  society:                  { label: 'Society',                color: 'bg-orange-100 text-orange-700' },
  'other-deductions':       { label: 'Other Deductions',       color: 'bg-orange-100 text-orange-700' },
  donations:                { label: 'Donations / Campaign',   color: 'bg-orange-100 text-orange-700' },
  deduction:                { label: 'Deductions Letter',      color: 'bg-orange-100 text-orange-700' },
  // Reports & system
  report:                   { label: 'Report',                 color: 'bg-violet-100 text-violet-700' },
  credentials:              { label: 'Credentials',            color: 'bg-rose-100 text-rose-700' },
  test:                     { label: 'SMTP Test',              color: 'bg-gray-100 text-gray-600' },
  notification:             { label: 'Notification',           color: 'bg-gray-100 text-gray-600' },
  general:                  { label: 'General',                color: 'bg-gray-100 text-gray-600' },
};

const titleCaseSlug = (s: string) =>
  (s || 'general').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Friendly module label + chip colour for an email delivery's category slug. */
export function emailCategoryMeta(slug: string | null | undefined): EmailCategoryMeta {
  const key = (slug ?? '').trim();
  return EMAIL_CATEGORY_META[key] ?? { label: titleCaseSlug(key), color: 'bg-gray-100 text-gray-600' };
}

export interface EmailDelivery {
  id: string;
  employeeId: string | null;
  toEmail: string | null;
  category: string;
  documentTitle: string | null;
  subject: string | null;
  status: EmailStatus;
  provider: string;
  sentAt: string | null;
  openedAt: string | null;
  docOpenedAt: string | null;
  confirmedAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface EmailConfig {
  enabled: boolean;
  provider: 'smtp' | 'off';
  host: string; port: number | null; secure: boolean;
  username: string; fromName: string; fromAddress: string; replyTo: string;
}

const token = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

export async function loadEmailConfig(): Promise<EmailConfig> {
  const { data } = await edb.from('establishment')
    .select('email_enabled, email_provider, email_host, email_port, email_secure, email_username, email_from_name, email_from_address, email_reply_to')
    .limit(1).maybeSingle();
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    enabled: Boolean(r.email_enabled),
    provider: ((r.email_provider as 'smtp' | 'off') ?? 'smtp'),
    host: (r.email_host as string) ?? '',
    port: (r.email_port as number) ?? null,
    secure: r.email_secure === undefined ? true : Boolean(r.email_secure),
    username: (r.email_username as string) ?? '',
    fromName: (r.email_from_name as string) ?? '',
    fromAddress: (r.email_from_address as string) ?? '',
    replyTo: (r.email_reply_to as string) ?? '',
  };
}

export interface SendEmailOpts {
  employeeId?: string | null;
  toEmail?: string | null;
  /** Originating-module slug (payslip, offer, fines, report…) — see emailCategoryMeta. */
  category?: EmailCategory | string;
  documentTitle: string;
  subject?: string;
  /** HTML message body shown in the email (above the action links). */
  message?: string;
  /** Full printable HTML document to attach + serve via the tracked link. */
  documentHtml?: string | null;
}

/**
 * Send one employee document by email (with attachment + open/attachment/receipt tracking),
 * or log a Simulated/No-Email row when SMTP isn't configured. Returns the delivery id + error.
 */
export async function sendEmployeeEmail(opts: SendEmailOpts): Promise<{ id: string | null; status: EmailStatus; error: string | null }> {
  const to = (opts.toEmail ?? '').trim();
  const subject = opts.subject?.trim() || opts.documentTitle;
  const message = opts.message ?? `<p>Please find your <strong>${opts.documentTitle}</strong> attached.</p>`;

  // No recipient — log and skip.
  if (!to) {
    const { data } = await edb.from('email_deliveries').insert({
      employee_id: opts.employeeId ?? null, to_email: null, category: opts.category ?? 'general',
      document_title: opts.documentTitle, subject, body_html: message, token: token(),
      status: 'No Email', provider: 'sim',
    } as never).select('id').single();
    return { id: (data as { id: string } | null)?.id ?? null, status: 'No Email', error: null };
  }

  // Stash the document in the (private) documents bucket for the tracked link + attachment.
  let docPath: string | null = null;
  if (opts.documentHtml) {
    const safe = opts.documentTitle.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'document';
    const file = new File([opts.documentHtml], `${safe}.html`, { type: 'text/html' });
    const { path } = await uploadFile(DOCUMENTS_BUCKET, 'email', file);
    docPath = path;
  }

  const { data: ins, error: insErr } = await edb.from('email_deliveries').insert({
    employee_id: opts.employeeId ?? null, to_email: to, category: opts.category ?? 'general',
    document_title: opts.documentTitle, subject, body_html: message, doc_path: docPath,
    token: token(), status: 'Queued', provider: 'sim',
  } as never).select('id').single();
  if (insErr || !ins) return { id: null, status: 'Failed', error: insErr?.message ?? 'insert failed' };
  const id = (ins as { id: string }).id;

  const cfg = await loadEmailConfig();
  if (cfg.enabled && cfg.provider === 'smtp') {
    const { data, error } = await edb.functions.invoke('email', { body: { action: 'send', id } });
    if (error) {
      // The function already recorded the precise SMTP error on the row before returning
      // non-2xx; read it back rather than masking it with the generic invoke message.
      const { data: row } = await edb.from('email_deliveries').select('status, error').eq('id', id).maybeSingle();
      const realErr = (row as { error?: string } | null)?.error || error.message;
      return { id, status: ((row as { status?: EmailStatus } | null)?.status ?? 'Failed'), error: realErr };
    }
    const st = ((data as { status?: EmailStatus; error?: string } | null)?.status ?? 'Sent');
    return { id, status: st, error: (data as { error?: string } | null)?.error ?? null };
  }

  // Simulated send (no SMTP configured).
  await edb.from('email_deliveries').update({ status: 'Simulated', sent_at: new Date().toISOString() } as never).eq('id', id);
  return { id, status: 'Simulated', error: null };
}

/** No-attachment notification email (approval alerts, etc.). */
export async function sendNotificationEmail(opts: {
  employeeId?: string | null; toEmail?: string | null; category?: EmailCategory | string; subject: string; message: string;
}): Promise<{ error: string | null }> {
  const res = await sendEmployeeEmail({
    employeeId: opts.employeeId, toEmail: opts.toEmail, category: opts.category ?? 'notification',
    documentTitle: opts.subject, subject: opts.subject, message: opts.message, documentHtml: null,
  });
  return { error: res.error };
}

export async function sendEmailBulk(items: SendEmailOpts[]): Promise<void> {
  for (const it of items) { await sendEmployeeEmail(it); }
}

const rowToDelivery = (r: Record<string, unknown>): EmailDelivery => ({
  id: r.id as string,
  employeeId: (r.employee_id as string) ?? null,
  toEmail: (r.to_email as string) ?? null,
  category: (r.category as string) ?? 'general',
  documentTitle: (r.document_title as string) ?? null,
  subject: (r.subject as string) ?? null,
  status: (r.status as EmailStatus) ?? 'Queued',
  provider: (r.provider as string) ?? 'sim',
  sentAt: (r.sent_at as string) ?? null,
  openedAt: (r.opened_at as string) ?? null,
  docOpenedAt: (r.doc_opened_at as string) ?? null,
  confirmedAt: (r.confirmed_at as string) ?? null,
  error: (r.error as string) ?? null,
  createdAt: r.created_at as string,
});

export async function loadEmailDeliveries(filter: { employeeId?: string; category?: string; limit?: number } = {}): Promise<EmailDelivery[]> {
  let q = edb.from('email_deliveries').select('*').order('created_at', { ascending: false }).limit(filter.limit ?? 500);
  if (filter.employeeId) q = q.eq('employee_id', filter.employeeId);
  if (filter.category) q = q.eq('category', filter.category);
  const { data } = await q;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToDelivery);
}

/** Subscribe to live status changes; returns an unsubscribe fn. */
export function subscribeEmailDeliveries(onChange: () => void): () => void {
  const ch = edb.channel(`email-deliveries-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'email_deliveries' }, () => onChange())
    .subscribe();
  return () => { void edb.removeChannel(ch); };
}
