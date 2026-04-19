import { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { StickyNote, X } from 'lucide-react';

export default function AssistantAddNoteToAssetModal({
  open,
  engagementId,
  initialBody,
  onClose,
}) {
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !engagementId) return;
    setBody(initialBody || '');
    setAssetId('');
    setAssetsLoading(true);
    api
      .get(`/engagements/${engagementId}/assets`)
      .then(({ data }) => {
        setAssets(Array.isArray(data) ? data : []);
        if (data?.length === 1) setAssetId(String(data[0].id));
      })
      .catch(() => {
        setAssets([]);
        toast.error('Could not load assets');
      })
      .finally(() => setAssetsLoading(false));
  }, [open, engagementId, initialBody]);

  const submit = useCallback(async () => {
    const id = parseInt(assetId, 10);
    const trimmed = body.trim();
    if (!id || !trimmed) {
      toast.error('Choose an asset and enter note text');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/assets/${id}/notes`, { body: trimmed });
      toast.success('Note added to asset');
      onClose();
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  }, [assetId, body, onClose]);

  useEffect(() => {
    if (!open) return;
    const esc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border/80 bg-card/95 p-6 shadow-card-hover backdrop-blur-md"
        role="dialog"
        aria-labelledby="assistant-note-modal-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id="assistant-note-modal-title" className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <StickyNote className="h-5 w-5 shrink-0 text-accent" />
            Add selection as asset note
          </h3>
          <button type="button" onClick={onClose} className="btn-ghost rounded-lg p-1 text-text-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div>
            <label className="label" htmlFor="assistant-note-asset">
              Asset
            </label>
            <select
              id="assistant-note-asset"
              className="input"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              disabled={assetsLoading || assets.length === 0}
            >
              <option value="">{assetsLoading ? 'Loading…' : assets.length === 0 ? 'No assets in engagement' : 'Select asset…'}</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.target ? ` — ${a.target}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="assistant-note-body">
              Note
            </label>
            <textarea
              id="assistant-note-body"
              className="textarea min-h-[140px] font-mono text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          {assetId ? (
            <NavLink
              to={`/e/${engagementId}/assets/${assetId}`}
              className="btn-ghost text-sm text-text-muted"
              onClick={onClose}
            >
              Open asset
            </NavLink>
          ) : null}
          <button type="button" className="btn-primary" onClick={submit} disabled={saving || !assetId || !body.trim()}>
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </div>
    </div>
  );
}
