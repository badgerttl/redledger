import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import TagBadge from '../components/TagBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Server, Globe, Trash2 } from 'lucide-react';

export default function Assets() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', asset_type: 'host', target: '', os: '' });
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/engagements/${id}/assets`);
      setAssets(data);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, [id]);

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      await api.post(`/engagements/${id}/assets`, form);
      toast.success('Asset created');
      setShowCreate(false);
      setForm({ name: '', asset_type: 'host', target: '', os: '' });
      load();
    } catch { toast.error('Failed to create asset'); }
  };

  const confirmDelete = async (assetId) => {
    try {
      await api.delete(`/assets/${assetId}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = filter === 'all' ? assets : assets.filter(a => a.asset_type === filter);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Assets</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Asset
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Add Asset</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}>
                <option value="host">Host</option>
                <option value="web_page">Web Page</option>
              </select>
            </div>
            <div><label className="label">Target (IP/URL)</label><input className="input" placeholder="10.10.10.1 or https://..." value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
            <div><label className="label">OS</label><input className="input" placeholder="e.g. Linux, Windows..." value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['all', 'host', 'web_page'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn-ghost ${filter === f ? 'bg-accent/10 text-accent' : ''}`}
          >
            {f === 'all' ? 'All' : f === 'host' ? 'Hosts' : 'Web Pages'}
          </button>
        ))}
        <span className="text-xs text-text-muted self-center ml-2">{filtered.length} asset(s)</span>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Target</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">OS</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Tags</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="table-row cursor-pointer" onClick={() => navigate(`/e/${id}/assets/${a.id}`)}>
                <td className="px-4 py-3 text-sm font-medium text-text-primary flex items-center gap-2">
                  {a.asset_type === 'host' ? <Server className="w-4 h-4 text-text-muted" /> : <Globe className="w-4 h-4 text-text-muted" />}
                  {a.name}
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{a.asset_type === 'host' ? 'Host' : 'Web Page'}</td>
                <td className="px-4 py-3 text-sm text-text-secondary font-mono">{a.target}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{a.os || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">{a.tags?.map(t => <TagBadge key={t.id} tag={t} />)}</div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(a.id); }} className="text-text-muted hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">No assets yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Asset"
        message="Delete this asset and all associated data? This cannot be undone."
        onConfirm={() => confirmDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
