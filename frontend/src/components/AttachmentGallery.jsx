import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, FileText, Download, X } from 'lucide-react';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

function isImage(filename) {
  if (!filename) return false;
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10">
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function AttachmentGallery({ attachments, onUpload, onDelete, title = 'Attachments' }) {
  const [lightbox, setLightbox] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && onUpload) onUpload(files);
    e.target.value = '';
  };

  return (
    <div>
      <h2 className="text-base font-medium mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        {title}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-accent hover:bg-accent/10 transition-colors ml-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </h2>

      {attachments.length === 0 && (
        <p className="text-sm text-text-muted">No attachments yet</p>
      )}

      <div className="space-y-3">
        {attachments.map((a) => {
          const imgFile = isImage(a.filename);
          const fileUrl = `/api/screenshots/${a.id}/file`;

          if (imgFile) {
            return (
              <div key={a.id} className="card p-3 group relative">
                <img
                  src={fileUrl}
                  alt={a.caption || a.filename}
                  className="w-full rounded object-contain max-h-[500px] cursor-pointer"
                  onClick={() => setLightbox({ src: fileUrl, alt: a.caption || a.filename })}
                />
                <div className="mt-2 flex items-center justify-between">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-text-muted hover:text-accent transition-colors truncate"
                  >
                    {a.filename}
                  </a>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={a.id} className="card p-3 group flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-primary hover:text-accent transition-colors truncate block"
                >
                  {a.filename}
                </a>
                <span className="text-2xs text-text-muted">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-accent transition-colors shrink-0"
                title="Open in new tab"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={() => onDelete(a.id)}
                className="text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
