import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Briefcase, UserSquare2, Upload, Eye, Loader2, Clock, CheckCircle2, XCircle, ShieldCheck, BadgeCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import AadhaarOTPSigning, { type SignatureData } from '../AadhaarOTPSigning';
import { listPortalDocuments, uploadPersonalDoc, openPortalDocument, type PortalDocument, type PortalCreds } from '../../lib/employeePortalDocs';
import { PERSONAL_TYPES, docTypeMeta } from '../../lib/employeeDocuments';

const STATUS: Record<PortalDocument['approval_status'], { cls: string; icon: React.ElementType; label: string }> = {
  approved: { cls: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, label: 'Approved' },
  pending: { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, label: 'Pending approval' },
  rejected: { cls: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Rejected' },
};

interface Props {
  loginId: string;
  password: string;
  employeeName: string;
  employeeCode: string;
}

/**
 * ESS "My Documents": Employment documents are view/download only (HR-signed);
 * Personal Details can be uploaded by the employee — each upload must be digitally
 * self-signed (Aadhaar eSign) and is submitted for HR approval.
 */
export default function MyDocumentsPanel({ loginId, password, employeeName, employeeCode }: Props) {
  const creds: PortalCreds = { loginId, password };
  const [employment, setEmployment] = useState<PortalDocument[]>([]);
  const [personal, setPersonal] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(PERSONAL_TYPES[0].type);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [signing, setSigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { employment, personal, error } = await listPortalDocuments(creds);
    if (error) toast.error(error);
    setEmployment(employment); setPersonal(personal); setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginId, password]);

  useEffect(() => { void load(); }, [load]);

  // Upload flow: pick file → mandatory Aadhaar self-eSign → upload as Pending.
  const onPickFile = (f: File | undefined) => {
    if (!f) return;
    setPendingFile(f);
    setSigning(true);
  };

  const onSigned = async (sig: SignatureData) => {
    setSigning(false);
    if (!pendingFile) return;
    setUploading(true);
    const { error } = await uploadPersonalDoc(creds, pendingFile, docType, sig);
    setUploading(false);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = '';
    if (error) { toast.error(error); return; }
    toast.success('Document uploaded and submitted for approval.');
    void load();
  };

  const view = async (id: string) => { await openPortalDocument(creds, id); };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <FileText size={20} className="text-indigo-600" />
        <h3 className="font-bold text-gray-900">My Documents</h3>
      </div>
      <p className="text-xs text-gray-500 mb-5">View your employment documents and upload personal documents (self-signed, sent to HR for approval).</p>

      {loading && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>}

      {/* Employment — read only */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2"><Briefcase size={16} className="text-indigo-600" /><h4 className="font-semibold text-sm text-gray-800">Employment</h4></div>
        {employment.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No employment documents yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {employment.map((d) => (
              <li key={d.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <div className="text-sm font-medium text-gray-900">{d.file_name}</div>
                  <div className="text-[11px] text-gray-500">{docTypeMeta(d.doc_type).label}</div>
                </div>
                {d.signed ? (
                  <span title={d.signature ? `Signed by ${d.signature.signerName}` : 'Signed'} className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 text-green-700 font-semibold px-2 py-0.5 text-[10px]"><BadgeCheck size={11} /> HR eSigned</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 text-gray-500 font-semibold px-2 py-0.5 text-[10px]"><Clock size={11} /> Awaiting HR signature</span>
                )}
                <button onClick={() => void view(d.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"><Eye size={13} /> View</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Personal — employee upload */}
      <section>
        <div className="flex items-center gap-2 mb-2"><UserSquare2 size={16} className="text-emerald-600" /><h4 className="font-semibold text-sm text-gray-800">Personal Details</h4></div>

        <div className="flex flex-wrap items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              {PERSONAL_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading || signing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload &amp; Sign
          </button>
          <span className="text-[11px] text-gray-400 inline-flex items-center gap-1"><ShieldCheck size={12} /> Requires your digital signature</span>
        </div>

        {personal.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No personal documents yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {personal.map((d) => {
              const st = STATUS[d.approval_status];
              return (
                <li key={d.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <div className="text-sm font-medium text-gray-900">{d.file_name}</div>
                    <div className="text-[11px] text-gray-500">{docTypeMeta(d.doc_type).label}</div>
                    {d.approval_status === 'rejected' && d.rejection_reason && <div className="text-[11px] text-red-600 mt-0.5">Reason: {d.rejection_reason}</div>}
                  </div>
                  {d.signed && <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 text-green-700 font-semibold px-2 py-0.5 text-[10px]"><ShieldCheck size={11} /> Self-signed</span>}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}><st.icon size={11} /> {st.label}</span>
                  <button onClick={() => void view(d.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"><Eye size={13} /> View</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {signing && pendingFile && (
        <AadhaarOTPSigning
          document={{ id: `new-${Date.now()}`, name: pendingFile.name, category: docTypeMeta(docType).label }}
          employeeName={employeeName}
          employeeId={employeeCode}
          onClose={() => { setSigning(false); setPendingFile(null); if (fileRef.current) fileRef.current.value = ''; }}
          onSigned={(sig) => void onSigned(sig)}
        />
      )}
    </div>
  );
}
