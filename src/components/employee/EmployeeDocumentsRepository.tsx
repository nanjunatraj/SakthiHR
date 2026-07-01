import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Briefcase, UserSquare2, Upload, Eye, Trash2, Loader2, Clock, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { supabase } from '../../supabase/client';
import DocumentSignControl from '../DocumentSignControl';
import type { SignatureData } from '../AadhaarOTPSigning';
import DocumentViewerModal, { type ViewerDoc } from '../DocumentViewerModal';
import {
  listByGroup, uploadDocument, deleteDocument, documentSignedUrl, signDocument, approveDocument, rejectDocument,
  type StoredDocument,
} from '../../lib/documents';
import {
  EMPLOYMENT_TYPES, PERSONAL_TYPES, docTypeMeta, GROUP_LABEL, type DocGroup, type DocTypeMeta,
} from '../../lib/employeeDocuments';

const db = supabase as unknown as SupabaseClient;

const STATUS_CHIP: Record<StoredDocument['approval_status'], { cls: string; icon: React.ElementType; label: string }> = {
  approved: { cls: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, label: 'Approved' },
  pending: { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, label: 'Pending approval' },
  rejected: { cls: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Rejected' },
};

function fmtSize(b: number | null): string {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

interface Props {
  /** Employee code (entity_ref). */
  entityRef: string;
  employeeName: string;
}

/**
 * Categorised Employee Documents Repository (admin side).
 *   • Employment    — HR Manager+ upload; each must be HR-eSigned (upload now, sign later).
 *   • Personal      — HR upload auto-approved; employee-portal uploads arrive Pending
 *                     (self-signed) for HR to Approve / Reject.
 */
export default function EmployeeDocumentsRepository({ entityRef, employeeName }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [hrSigner, setHrSigner] = useState<{ name: string; id: string }>({ name: 'Authorised Signatory', id: '—' });
  const [employment, setEmployment] = useState<StoredDocument[]>([]);
  const [personal, setPersonal] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerDoc | null>(null);

  const openViewer = async (doc: StoredDocument) => {
    setViewer({ name: doc.file_name, url: null, mimeType: doc.mime_type, loading: true });
    const url = await documentSignedUrl(doc);
    setViewer({ name: doc.file_name, url, mimeType: doc.mime_type, loading: false, error: url ? null : 'Could not load this document.' });
  };

  const load = useCallback(async () => {
    if (!entityRef || entityRef === 'unsaved') { setLoading(false); return; }
    setLoading(true);
    const [emp, per] = await Promise.all([
      listByGroup('employee', entityRef, 'employment'),
      listByGroup('employee', entityRef, 'personal'),
    ]);
    setEmployment(emp); setPersonal(per); setLoading(false);
  }, [entityRef]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: adm } = await db.rpc('is_doc_admin');
      if (!active) return;
      setIsAdmin(adm === true);
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user?.id) {
        const { data: su } = await db.from('system_users').select('name, login_id').eq('auth_user_id', auth.user.id).maybeSingle();
        const row = su as { name?: string; login_id?: string } | null;
        if (active && row) setHrSigner({ name: row.name || 'HR Manager', id: row.login_id || '—' });
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!entityRef || entityRef === 'unsaved') {
    return <p className="text-sm text-muted-foreground">Save the employee first to manage their document repository.</p>;
  }

  return (
    <div className="space-y-6">
      {loading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading repository…</p>}

      <RepoSection
        group="employment" icon={Briefcase} accent="text-indigo-600"
        types={EMPLOYMENT_TYPES} docs={employment} isAdmin={isAdmin} entityRef={entityRef}
        busyId={busyId} setBusyId={setBusyId} onChanged={load} onView={openViewer} hrSigner={hrSigner} employeeName={employeeName}
        note="Only HR Manager and above can upload. Each document must be digitally signed by HR."
      />

      <RepoSection
        group="personal" icon={UserSquare2} accent="text-emerald-600"
        types={PERSONAL_TYPES} docs={personal} isAdmin={isAdmin} entityRef={entityRef}
        busyId={busyId} setBusyId={setBusyId} onChanged={load} onView={openViewer} hrSigner={hrSigner} employeeName={employeeName}
        note="HR uploads are auto-approved. Documents uploaded by the employee via the portal arrive Pending (self-signed) for approval."
      />

      <DocumentViewerModal doc={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

interface SectionProps {
  group: DocGroup;
  icon: React.ElementType;
  accent: string;
  types: DocTypeMeta[];
  docs: StoredDocument[];
  isAdmin: boolean;
  entityRef: string;
  busyId: string | null;
  setBusyId: (v: string | null) => void;
  onChanged: () => void;
  onView: (doc: StoredDocument) => void;
  hrSigner: { name: string; id: string };
  employeeName: string;
  note: string;
}

function RepoSection(props: SectionProps) {
  const { group, icon: Icon, accent, types, docs, isAdmin, entityRef, busyId, setBusyId, onChanged, onView, hrSigner, note } = props;
  const [docType, setDocType] = useState(types[0]?.type ?? '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doUpload = async (file: File) => {
    const meta = docTypeMeta(docType);
    setUploading(true);
    const { error } = await uploadDocument('employee', entityRef, meta.label, file, { group, type: docType, category: meta.label });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (error) { toast.error(error); return; }
    toast.success(`${meta.label} uploaded${group === 'employment' ? ' — pending signature.' : '.'}`);
    onChanged();
  };

  const onSigned = async (doc: StoredDocument, sig: SignatureData) => {
    const err = await signDocument(doc.id, sig);
    if (err) { toast.error(err); return; }
    onChanged();
  };

  const remove = async (doc: StoredDocument) => {
    if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    setBusyId(doc.id);
    const err = await deleteDocument(doc);
    setBusyId(null);
    if (err) { toast.error(err); return; }
    toast.info('Document deleted.'); onChanged();
  };

  const approve = async (doc: StoredDocument) => {
    setBusyId(doc.id);
    const err = await approveDocument(doc.id);
    setBusyId(null);
    if (err) { toast.error(err); return; }
    toast.success('Document approved.'); onChanged();
  };

  const reject = async (doc: StoredDocument) => {
    const reason = window.prompt('Reason for rejection (shown to the employee):', '');
    if (reason === null) return;
    setBusyId(doc.id);
    const err = await rejectDocument(doc.id, reason.trim() || 'Rejected');
    setBusyId(null);
    if (err) { toast.error(err); return; }
    toast.info('Document rejected.'); onChanged();
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={18} className={accent} />
        <h3 className="font-bold text-sm">{GROUP_LABEL[group]}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{note}</p>

      {isAdmin && (
        <div className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-accent/20 rounded-lg border border-border">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-background">
              {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void doUpload(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload
          </button>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center bg-accent/10 rounded-lg border border-dashed border-border">No {GROUP_LABEL[group].toLowerCase()} documents yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((doc) => {
            const meta = docTypeMeta(doc.doc_type);
            const st = STATUS_CHIP[doc.approval_status];
            const busy = busyId === doc.id;
            return (
              <li key={doc.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {doc.file_name}
                    {doc.uploaded_via === 'portal' && <span className="text-[9px] font-bold bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full">EMPLOYEE UPLOAD</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{meta.label}{doc.size_bytes ? ` · ${fmtSize(doc.size_bytes)}` : ''}</div>
                  {doc.approval_status === 'rejected' && doc.rejection_reason && (
                    <div className="text-[11px] text-red-600 mt-0.5">Reason: {doc.rejection_reason}</div>
                  )}
                </div>

                {group === 'personal' && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>
                    <st.icon size={11} /> {st.label}
                  </span>
                )}

                {/* Signing: employment → HR signs; personal-portal → shows employee self-signature. */}
                {group === 'employment' ? (
                  <DocumentSignControl
                    doc={{ id: doc.id, name: doc.file_name, category: meta.label }}
                    signerName={hrSigner.name} signerId={hrSigner.id}
                    signature={doc.signature ?? undefined} source="Employee Documents · Employment"
                    onSigned={(sig) => void onSigned(doc, sig)} compact
                  />
                ) : doc.signed && doc.signature ? (
                  <span title={`Self-signed by ${doc.signature.signerName}`} className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 text-green-700 font-semibold px-2 py-0.5 text-[10px]">
                    <ShieldCheck size={11} /> Self-signed
                  </span>
                ) : null}

                <div className="flex items-center gap-1.5">
                  <button onClick={() => onView(doc)} title="View document" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><Eye size={15} /></button>
                  {group === 'personal' && doc.approval_status === 'pending' && isAdmin && (
                    <>
                      <button disabled={busy} onClick={() => void approve(doc)} className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50">Approve</button>
                      <button disabled={busy} onClick={() => void reject(doc)} className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">Reject</button>
                    </>
                  )}
                  {isAdmin && <button disabled={busy} onClick={() => void remove(doc)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>}
                  {busy && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
