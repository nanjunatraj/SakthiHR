import React, { useState } from 'react';
import { Fingerprint, BadgeCheck } from 'lucide-react';
import AadhaarOTPSigning, { type SignatureData } from './AadhaarOTPSigning';
import { recordSignature } from '../lib/digitalSignature';

interface DocumentSignControlProps {
  /** The document being signed (id + name; category optional). */
  doc: { id: string; name: string; category?: string };
  /** Display name of the person whose Aadhaar will sign. */
  signerName: string;
  /** Employee/operator id shown on the signature certificate. */
  signerId: string;
  /** Existing signature, if the document has already been signed. */
  signature?: SignatureData;
  /** Where the document lives — recorded on the audit trail. */
  source?: string;
  /** Called with the signature once signing completes. */
  onSigned: (sig: SignatureData) => void;
  compact?: boolean;
}

/**
 * Drop-in control for any document row: shows a "Signed" badge (with the eSign
 * transaction details on hover) when signed, otherwise a "Sign" button that
 * launches the Aadhaar-OTP signing flow and records the result to the audit log.
 */
export default function DocumentSignControl({
  doc, signerName, signerId, signature, source, onSigned, compact,
}: DocumentSignControlProps) {
  const [open, setOpen] = useState(false);

  if (signature) {
    const title = `Aadhaar eSigned\nBy: ${signature.signerName}${signature.signerEmployeeId ? ` (${signature.signerEmployeeId})` : ''}\nOn: ${signature.signedAt}\nAadhaar: XXXX XXXX ${signature.aadhaarLast4}\nTxn: ${signature.transactionId}`;
    return (
      <span
        title={title}
        className={`inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 text-green-700 font-semibold ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
      >
        <BadgeCheck size={compact ? 11 : 12} /> eSigned
      </span>
    );
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Digitally sign with Aadhaar OTP"
        className={`inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-colors ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'}`}
      >
        <Fingerprint size={compact ? 11 : 12} /> Sign
      </button>
      {open && (
        <AadhaarOTPSigning
          document={{ id: doc.id, name: doc.name, category: doc.category ?? 'Document' }}
          employeeName={signerName || 'Authorised Signatory'}
          employeeId={signerId || '—'}
          onClose={() => setOpen(false)}
          onSigned={(sig) => {
            void recordSignature(sig, { documentName: doc.name, documentCategory: doc.category, source });
            onSigned(sig);
          }}
        />
      )}
    </>
  );
}
