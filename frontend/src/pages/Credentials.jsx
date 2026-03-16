import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Trash2, Eye, EyeOff, ShieldAlert } from 'lucide-react';

const SECRET_TYPES = ['plaintext', 'ntlm', 'sha256', 'other'];

export default function Credentials() {
  const { id } = useParams();
  const [credentials, setCredentials] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', secret: '', secret_type: 'plaintext', source: '', access_level: '', notes: '' });
  const [revealed, setRevealed] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/engagements/${id}/credentials`);
      setCredentials(data);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, [id]);

  const handleCreate = async () => {
    try {
      await api.post(`/engagements/${id}/credentials`, form);
      toast.success('Credential added');
      setShowCreate(false);
      setForm({ username: '', secret: '', secret_type: 'plaintext', source: '', access_level: '', notes: '' });
      load();
    } catch { toast.error('Failed to add credential'); }
  };

  const confirmDelete = async (credId) => {
    try {
      await api.delete(`/credentials/${credId}`);
      setDeleteTarget(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const toggleReveal = (credId) => {
    setRevealed(prev => ({ ...prev, [credId]: !prev[credId] }));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Credentials</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Credential
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Add Credential</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Username</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="label">Secret (password/hash)</label><input className="input" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} /></div>
            <div>
              <label className="label">Secret Type</label>
              <select className="input" value={form.secret_type} onChange={(e) => setForm({ ...form, secret_type: e.target.value })}>
                {SECRET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Access Level</label><input className="input" placeholder="e.g. Admin, User..." value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Source</label><input className="input" placeholder="Where was this found?" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Notes</label><textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary">Add</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-md border border-border bg-card text-xs text-text-secondary">
        <ShieldAlert className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
        <span>Credentials are stored unencrypted in the local database. For extra-sensitive secrets (domain admin, production keys, etc.), use a dedicated password vault and reference it here instead.</span>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Username</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Secret</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Access</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Source</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((c) => (
              <tr key={c.id} className="table-row">
                <td className="px-4 py-3 text-sm font-mono text-text-primary">{c.username}</td>
                <td className="px-4 py-3 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">{revealed[c.id] ? c.secret : '••••••••'}</span>
                    <button onClick={() => toggleReveal(c.id)} className="text-text-muted hover:text-text-primary transition-colors">
                      {revealed[c.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">{c.secret_type}</span>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{c.access_level || '—'}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{c.source || '—'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setDeleteTarget(c.id)} className="text-text-muted hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {credentials.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">No credentials yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Credential"
        message="Delete this credential? This cannot be undone."
        onConfirm={() => confirmDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
