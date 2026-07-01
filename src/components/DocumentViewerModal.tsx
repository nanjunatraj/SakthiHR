import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';

export interface ViewerDoc {
  name: string;
  url: string | null;         // short-lived signed URL
  mimeType?: string | null;
  loading?: boolean;
  error?: string | null;
}

function kind(name: string, mime?: string | null): 'image' | 'pdf' | 'other' {
  const m = (mime ?? '').toLowerCase();
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (m.includes('pdf') || ext === 'pdf') return 'pdf';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  return 'other';
}

/**
 * In-app document viewer. Renders images and PDFs inline from a signed URL, with
 * download / open-in-new-tab actions. Non-previewable types offer a download.
 */
export default function DocumentViewerModal({ doc, onClose }: { doc: ViewerDoc | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {doc && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            className="bg-card w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95">
              <FileText size={18} className="text-primary shrink-0" />
              <span className="font-semibold text-sm truncate flex-1" title={doc.name}>{doc.name}</span>
              {doc.url && (
                <>
                  <a href={doc.url} download={doc.name} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Download"><Download size={16} /></a>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Open in new tab"><ExternalLink size={16} /></a>
                </>
              )}
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Close (Esc)"><X size={16} /></button>
            </div>

            <div className="flex-1 min-h-0 bg-accent/20 flex items-center justify-center">
              {doc.loading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground"><Loader2 size={26} className="animate-spin" /><span className="text-sm">Loading document…</span></div>
              ) : doc.error || !doc.url ? (
                <div className="flex flex-col items-center gap-2 text-red-600"><AlertCircle size={26} /><span className="text-sm">{doc.error ?? 'Could not load this document.'}</span></div>
              ) : kind(doc.name, doc.mimeType) === 'image' ? (
                <img src={doc.url} alt={doc.name} className="max-w-full max-h-full object-contain" />
              ) : kind(doc.name, doc.mimeType) === 'pdf' ? (
                <iframe title={doc.name} src={doc.url} className="w-full h-full bg-white" />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <FileText size={40} />
                  <p className="text-sm">Preview isn't available for this file type.</p>
                  <a href={doc.url} download={doc.name} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"><Download size={15} /> Download</a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
