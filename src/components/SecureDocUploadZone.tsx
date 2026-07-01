import { formatDate } from '../utils/date';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Paperclip, Eye, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import DocumentSignControl from './DocumentSignControl';
import DocumentViewerModal, { type ViewerDoc } from './DocumentViewerModal';
import {
  listDocuments, uploadDocument, deleteDocument, documentSignedUrl, signDocument,
  type StoredDocument,
} from '../lib/documents';

interface SecureDocUploadZoneProps {
  /** 'employee' | 'work_location' | 'establishment' — buckets documents by entity kind. */
  entityType: string;
  /** Stable reference for the owning entity (employee code, location id, …). */
  entityRef: string;
  /** Upload label / document category (also used to filter this zone's list). */
  label: string;
  /** Signer identity for the Aadhaar eSign flow. */
  signerName: string;
  signerId: string;
  compact?: boolean;
}

function fileIcon(type: string): string {
  if (type.includes('pdf')) return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('word') || type.includes('document')) return '📝';
  return '📎';
}
function fmtSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Document upload zone backed by Supabase Storage + the `documents` table.
 * Files go to the PRIVATE `documents` bucket; the list is loaded from the DB;
 * viewing uses short-lived signed URLs; each row can be Aadhaar-eSigned.
 */
export default function SecureDocUploadZone({
  entityType, entityRef, label, signerName, signerId, compact,
}: SecureDocUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [docs, setDocs] = useState<StoredDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<ViewerDoc | null>(null);

  const view = async (doc: StoredDocument) => {
    setViewer({ name: doc.file_name, url: null, mimeType: doc.mime_type, loading: true });
    const url = await documentSignedUrl(doc);
    setViewer({ name: doc.file_name, url, mimeType: doc.mime_type, loading: false, error: url ? null : 'Could not load this document.' });
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setDocs(await listDocuments(entityType, entityRef, label));
    setLoading(false);
  }, [entityType, entityRef, label]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleFiles = async (files: FileList) => {
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} exceeds 10 MB limit.`); continue; }
      const { error } = await uploadDocument(entityType, entityRef, label, file);
      if (error) toast.error(`Upload failed for ${file.name}: ${error}`); else ok++;
    }
    setBusy(false);
    if (ok > 0) { toast.success(`${ok} document(s) uploaded securely.`); void refresh(); }
  };

  const handleRemove = async (doc: StoredDocument) => {
    const err = await deleteDocument(doc);
    if (err) { toast.error(err); return; }
    toast.info('Document removed.');
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const handleSigned = async (doc: StoredDocument, signature: Parameters<typeof signDocument>[1]) => {
    const err = await signDocument(doc.id, signature);
    if (err) { toast.error(`Could not save signature: ${err}`); return; }
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, signed: true, signature } : d));
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-3 px-4 ${compact ? 'py-2.5' : 'py-3'} rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40 hover:bg-accent/40'
        }`}
      >
        {busy ? <Loader2 size={15} className="text-primary shrink-0 animate-spin" /> : <Upload size={15} className="text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Upload {label}</p>
          {!compact && <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><ShieldCheck size={10} /> Stored privately · signed URLs only · PDF/JPG/PNG/DOC, max 10 MB</p>}
        </div>
        <Paperclip size={13} className="text-muted-foreground/50 shrink-0" />
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          className="hidden"
          onChange={e => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {loading && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Loading documents…</p>}

      <AnimatePresence>
        {docs.map(doc => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-3 py-2.5 bg-accent/50 rounded-lg border border-border group"
          >
            <span className="text-base shrink-0">{fileIcon(doc.mime_type ?? '')}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{doc.file_name}</p>
              <p className="text-[10px] text-muted-foreground">{fmtSize(doc.size_bytes)} · {formatDate(doc.created_at)}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => void view(doc)} title="View document" className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                <Eye size={13} />
              </button>
              <button onClick={() => void handleRemove(doc)} title="Remove" className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
            <DocumentSignControl
              doc={{ id: doc.id, name: doc.file_name, category: doc.category ?? label }}
              signerName={signerName}
              signerId={signerId}
              signature={doc.signature ?? undefined}
              source={entityType}
              onSigned={(sig) => void handleSigned(doc, sig)}
              compact={compact}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <DocumentViewerModal doc={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
