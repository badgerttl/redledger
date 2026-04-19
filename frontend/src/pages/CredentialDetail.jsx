import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import MarkdownViewer from '../components/MarkdownViewer';
import MarkdownEditor from '../components/MarkdownEditor';
import ConfirmDialog from '../components/ConfirmDialog';
import { ArrowLeft, Edit2, Save, Eye, EyeOff, X, Trash2 } from 'lucide-react';

const SECRET_TYPES = ['plaintext', 'ntlm', 'sha256', 'other'];

export default function CredentialDetail() {
  const { id, credentialId } = useParams();
  const navigate = useNavigate();
  const [cred, setCred] = useState(null);
  const [allAssets, setAllAssets] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const load = async () => {
    try {
      const [c, a] = await Promise.all([
        api.get(`/credentials/${credentialId}`),
        api.get(`/engagements/${id}/assets`),
      ]);
      setCred(c.data);
      setAllAssets(a.data);
    } catch (err) {
      if (err.name !== 'CanceledError') toast.error(err.message);
    }
  };

  useEffect(() => { load(); }, [credentialId]);

  const startEdit = () => {
    setForm({
      username: cred.username || '',
      secret: cred.secret || '',
      secret_type: cred.secret_type || 'plaintext',
      source: cred.source || '',
      access_level: cred.access_level || '',
      notes: cred.notes || '',
      asset_ids: cred.asset_ids || [],
    });
    setEditing(true);
  };

  const toggleAsset = (assetId) => {
    setForm(f => ({
      ...f,
      asset_ids: f.asset_ids.includes(assetId)
        ? f.asset_ids.filter(a => a !== assetId)
        : [...f.asset_ids, assetId],
    }));
  };

  const handleSave = async () => {
    try {
      await api.patch(`/credentials/${credentialId}`, form);
      toast.success('Credential updated');
      setEditing(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/credentials/${credentialId}`);
      toast.success('Deleted');
      navigate(`/e/${id}/credentials`);
    } catch (err) { toast.error(err.message); }
  };

  if (!cred) return <div className="text-text-muted">Loading...</div>;

  return (
    <div>
      <button onClick={() => navigate(`/e/${id}/credentials`)} className="btn-ghost mb-4 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Credentials
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title font-mono">{cred.username || '(no username)'}</h1>
          <p className="text-sm text-text-muted mt-0.5">
            <span className="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent mr-2">{cred.secret_type}</span>
            {cred.access_level && <span className="text-text-secondary">{cred.access_level}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={editing ? handleSave : startEdit}
            className="btn-primary flex items-center gap-2"
          >
            {editing ? <><Save className="w-4 h-4" /> Save</> : <><Edit2 className="w-4 h-4" /> Edit</>}
          </button>
          {!editing && (
            <button onClick={() => setShowDeleteConfirm(true)} className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {editing && (
            <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Username</label>
                <input className="input font-mono" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className="label">Secret</label>
                <input className="input font-mono" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
              </div>
              <div>
                <label className="label">Secret Type</label>
                <select className="input" value={form.secret_type} onChange={(e) => setForm({ ...form, secret_type: e.target.value })}>
                  {SECRET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Access Level</label>
                <input className="input" placeholder="e.g. Admin, User..." value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Source</label>
                <input className="input" placeholder="Where was this found?" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card">
            <label className="label mb-3 block">Linked Assets</label>
            <div className="flex flex-wrap gap-2">
              {allAssets.length === 0 && <span className="text-xs text-text-muted">No assets in this engagement</span>}
              {allAssets.map(a => {
                const selected = form.asset_ids.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAsset(a.id)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
                      selected
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'bg-transparent border-border text-text-muted hover:border-accent/50 hover:text-text-secondary'
                    }`}
                  >
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                    {a.name}{a.target ? ` (${a.target})` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <label className="label block mb-2">Notes</label>
            <MarkdownEditor value={form.notes} onChange={(v) => setForm(prev => ({ ...prev, notes: v }))} placeholder="Additional notes..." minHeight="120px" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Secret */}
          <div className="card">
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <span className="label block mb-1">Secret</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-text-primary">{revealed ? cred.secret || '—' : '••••••••'}</span>
                  {cred.secret && (
                    <button
                      onClick={() => setRevealed(r => !r)}
                      className="text-text-muted hover:text-text-primary transition-colors"
                      title={revealed ? 'Hide' : 'Reveal'}
                    >
                      {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span className="label block mb-1">Source</span>
                <span className="text-text-secondary">{cred.source || '—'}</span>
              </div>
              <div>
                <span className="label block mb-1">Created</span>
                <span className="text-text-secondary">{cred.created_at ? new Date(cred.created_at).toLocaleString() : '—'}</span>
              </div>
            </div>
          </div>

          {/* Linked assets */}
          {cred.assets?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-medium mb-2">Linked Assets</h3>
              <div className="flex gap-2 flex-wrap">
                {cred.assets.map(a => (
                  <span
                    key={a.id}
                    className="inline-flex items-center px-2 py-1 rounded bg-accent/10 text-accent text-xs cursor-pointer hover:bg-accent/20 transition-colors"
                    onClick={() => navigate(`/e/${id}/assets/${a.id}`)}
                  >
                    {a.name}{a.target ? ` (${a.target})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {cred.notes && (
            <div className="card">
              <h3 className="text-sm font-medium mb-3">Notes</h3>
              <MarkdownViewer content={cred.notes} />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Credential"
        message="Delete this credential? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
