import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Trash2, Eye, EyeOff, ShieldAlert, Pencil, CheckCircle2 } from 'lucide-react';
import MarkdownEditor from '../components/MarkdownEditor';

const SECRET_TYPES = ['plaintext', 'ntlm', 'sha256', 'other'];
const EMPTY_FORM = { username: '', secret: '', secret_type: 'plaintext', source: '', access_level: '', notes: '', asset_ids: [] };

function FormFields({ values, onChange, assets }) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div><label className="label">Username</label><input className="input" value={values.username} onChange={(e) => onChange({ ...values, username: e.target.value })} /></div>
      <div><label className="label">Secret (password/hash)</label><input className="input" value={values.secret} onChange={(e) => onChange({ ...values, secret: e.target.value })} /></div>
      <div>
        <label className="label">Secret Type</label>
        <select className="input" value={values.secret_type} onChange={(e) => onChange({ ...values, secret_type: e.target.value })}>
          {SECRET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div><label className="label">Access Level</label><input className="input" placeholder="e.g. Admin, User..." value={values.access_level} onChange={(e) => onChange({ ...values, access_level: e.target.value })} /></div>
      <div><label className="label">Source</label><input className="input" placeholder="Where was this found?" value={values.source} onChange={(e) => onChange({ ...values, source: e.target.value })} /></div>
      <div />
      <div className="col-span-2">
        <label className="label mb-2 block">Linked Assets</label>
        <AssetPicker allAssets={assets} selected={values.asset_ids} onChange={(ids) => onChange({ ...values, asset_ids: ids })} />
      </div>
      <div className="col-span-2"><label className="label mb-2 block">Notes</label><MarkdownEditor value={values.notes} onChange={(v) => onChange({ ...values, notes: v })} placeholder="Additional notes..." minHeight="80px" /></div>
    </div>
  );
}

function AssetPicker({ allAssets, selected, onChange }) {
  const toggle = (assetId) => {
    onChange(selected.includes(assetId) ? selected.filter((id) => id !== assetId) : [...selected, assetId]);
  };
  if (allAssets.length === 0) return <span className="text-xs text-text-muted">No assets in this engagement</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {allAssets.map((a) => {
        const sel = selected.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${sel ? 'bg-accent/20 border-accent text-accent' : 'bg-transparent border-border text-text-muted hover:border-accent/50 hover:text-text-secondary'}`}
          >
            {sel && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
            {a.name}{a.target ? ` (${a.target})` : ''}
          </button>
        );
      })}
    </div>
  );
}

function CredTable({ creds, assets, engagementId, editingId, editForm, setEditForm, onStartEdit, onUpdate, onCancelEdit, onDelete, onConfirm, showConfirm, revealed, onToggleReveal }) {
  const navigate = useNavigate();
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Username</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Secret</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Access</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Source</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Assets</th>
            <th className="w-20"></th>
          </tr>
        </thead>
        <tbody>
          {creds.map((c) =>
            editingId === c.id ? (
              <tr key={c.id} className="border-b border-border bg-white/[0.02]">
                <td colSpan={7} className="px-4 py-4">
                  <FormFields values={editForm} onChange={setEditForm} assets={assets} />
                  <div className="flex gap-2">
                    <button onClick={onUpdate} className="btn-primary text-xs">Save</button>
                    <button onClick={onCancelEdit} className="btn-secondary text-xs">Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={c.id}
                className="table-row cursor-pointer group"
                onClick={() => navigate(`/e/${engagementId}/credentials/${c.id}`, { state: { from: `/e/${engagementId}/credentials`, fromLabel: 'Credentials' } })}
              >
                <td className="px-4 py-3 text-sm font-mono text-text-primary">{c.username || '—'}</td>
                <td className="px-4 py-3 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">{revealed[c.id] ? c.secret : '••••••••'}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleReveal(c.id); }}
                      className="text-text-muted hover:text-text-primary transition-colors"
                    >
                      {revealed[c.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">{c.secret_type}</span>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{c.access_level || '—'}</td>
                <td className="px-4 py-3 text-sm text-text-secondary max-w-[180px] truncate">{c.source || '—'}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">
                  {c.assets?.length
                    ? (
                      <div className="flex flex-col gap-0.5">
                        {c.assets.map((a) => (
                          <span key={a.id} className="block">
                            {a.name}{a.target ? <span className="text-text-muted font-mono text-xs"> ({a.target})</span> : ''}
                          </span>
                        ))}
                      </div>
                    )
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {showConfirm && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onConfirm(c.id); }}
                        className="text-text-muted hover:text-green-400 transition-colors"
                        title="Confirm credential"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onStartEdit(c); }}
                      className="text-text-muted hover:text-accent transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                      className="text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
          {creds.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">None</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Credentials() {
  const { id } = useParams();
  const [credentials, setCredentials] = useState([]);
  const [assets, setAssets] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [revealed, setRevealed] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh((r) => r + 1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [creds, assetList] = await Promise.all([
          api.get(`/engagements/${id}/credentials`, { signal: controller.signal }),
          api.get(`/engagements/${id}/assets`, { signal: controller.signal }),
        ]);
        setCredentials(creds.data);
        setAssets(assetList.data);
      } catch (err) {
        if (err.name !== 'CanceledError') toast.error(err.message);
      }
    };
    load();
    return () => controller.abort();
  }, [id, refresh]);

  const handleCreate = async () => {
    try {
      await api.post(`/engagements/${id}/credentials`, form);
      toast.success('Credential added');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({
      username: c.username || '',
      secret: c.secret || '',
      secret_type: c.secret_type || 'plaintext',
      source: c.source || '',
      access_level: c.access_level || '',
      notes: c.notes || '',
      asset_ids: c.asset_ids || [],
    });
  };

  const handleUpdate = async () => {
    try {
      await api.patch(`/credentials/${editingId}`, editForm);
      toast.success('Updated');
      setEditingId(null);
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const handleConfirm = async (credId) => {
    try {
      await api.post(`/credentials/${credId}/confirm`);
      toast.success('Confirmed');
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const confirmDelete = async (credId) => {
    try {
      await api.delete(`/credentials/${credId}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const toggleReveal = (credId) => {
    setRevealed((prev) => ({ ...prev, [credId]: !prev[credId] }));
  };

  const confirmed = credentials.filter((c) => c.status !== 'review');
  const review = credentials.filter((c) => c.status === 'review');

  const tableProps = {
    assets,
    engagementId: id,
    editingId,
    editForm,
    setEditForm,
    onStartEdit: startEdit,
    onUpdate: handleUpdate,
    onCancelEdit: () => setEditingId(null),
    onDelete: (credId) => setDeleteTarget(credId),
    revealed,
    onToggleReveal: toggleReveal,
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Credentials</h1>
        <button onClick={() => { setShowCreate(true); setEditingId(null); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Credential
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Add Credential</h2>
          <FormFields values={form} onChange={setForm} assets={assets} />
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary">Add</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-md border border-border bg-card text-xs text-text-secondary">
        <ShieldAlert className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
        <span>Credentials are stored unencrypted in the local database. For extra-sensitive secrets, use a dedicated password vault and reference it here instead.</span>
      </div>

      {/* Review section */}
      {review.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Review ({review.length})</h2>
            <span className="text-xs text-text-muted">— imported from tool output, pending confirmation</span>
          </div>
          <CredTable
            creds={review}
            showConfirm={true}
            onConfirm={handleConfirm}
            {...tableProps}
          />
        </div>
      )}

      {/* Confirmed section */}
      <div>
        {review.length > 0 && (
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Confirmed ({confirmed.length})
          </h2>
        )}
        <CredTable
          creds={confirmed}
          showConfirm={false}
          onConfirm={null}
          {...tableProps}
        />
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
