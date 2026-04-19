import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import TagBadge from '../components/TagBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Server, Globe, Trash2, ChevronDown, ChevronRight, Network, Copy } from 'lucide-react';

function PortGroup({ group, engagementId, navigate, onCopyTarget }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-white/5 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-accent shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />}
        <Network className="w-4 h-4 text-text-muted shrink-0" />
        <span className="font-mono text-xs text-accent">{group.port}/{group.protocol}</span>
        {group.service && <span className="text-text-secondary">— {group.service}</span>}
        <span className="ml-auto text-2xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{group.assets.length} host{group.assets.length !== 1 ? 's' : ''}</span>
      </button>
      {expanded && (
        <div className="border-t border-border">
          {group.assets.map(a => (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/e/${engagementId}/assets/${a.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/e/${engagementId}/assets/${a.id}`)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-white/5 transition-colors text-left border-b border-border last:border-b-0 cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-text-muted shrink-0 ml-6" />
              <span className="text-text-primary">{a.name}</span>
              <span className="font-mono text-xs text-text-muted">{a.target}</span>
              {a.target && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCopyTarget(e, a.target); }}
                  className="text-text-muted hover:text-accent transition-colors p-0.5 rounded hover:bg-accent/10 shrink-0"
                  title={`Copy ${a.asset_type === 'host' ? 'IP address' : 'URL'}`}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
              {a.os && <span className="text-2xs text-text-muted ml-auto">{a.os}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortsView({ portGroups, engagementId, navigate, onCopyTarget }) {
  if (portGroups.length === 0) {
    return <div className="card py-8 text-center text-sm text-text-muted">No ports discovered yet. Add ports to host assets or import an Nmap scan.</div>;
  }
  return (
    <div className="space-y-2">
      {portGroups.map(g => (
        <PortGroup key={`${g.port}-${g.protocol}`} group={g} engagementId={engagementId} navigate={navigate} onCopyTarget={onCopyTarget} />
      ))}
    </div>
  );
}

export default function Assets() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', asset_type: 'host', target: '', os: '' });
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh(r => r + 1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data } = await api.get(`/engagements/${id}/assets`, { signal: controller.signal });
        setAssets(data);
      } catch (err) {
        if (err.name !== 'CanceledError') toast.error(err.message);
      }
    };
    load();
    return () => controller.abort();
  }, [id, refresh]);

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      await api.post(`/engagements/${id}/assets`, form);
      toast.success('Asset created');
      setShowCreate(false);
      setForm({ name: '', asset_type: 'host', target: '', os: '' });
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const confirmDelete = async (assetId) => {
    try {
      await api.delete(`/assets/${assetId}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const copyTarget = async (e, target) => {
    e.stopPropagation();
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      toast.success('Copied to clipboard');
    } catch { toast.error('Failed to copy'); }
  };

  const filtered = filter === 'all' ? assets : assets.filter(a => a.asset_type === filter);

  const portGroups = useMemo(() => {
    const map = {};
    for (const a of assets) {
      if (a.asset_type !== 'host' || !a.ports_summary) continue;
      const entries = a.ports_summary.split(',').map(s => s.trim()).filter(Boolean);
      for (const entry of entries) {
        const m = entry.match(/^(\d+)\s*\/\s*(tcp|udp)\s*(?:\(([^)]*)\))?/i);
        if (!m) continue;
        const key = `${m[1]}/${m[2]}`;
        const service = (m[3] || '').trim();
        if (!map[key]) map[key] = { port: parseInt(m[1], 10), protocol: m[2], service, assets: [] };
        if (!map[key].service && service) map[key].service = service;
        map[key].assets.push(a);
      }
    }
    return Object.values(map).sort((a, b) => a.port - b.port);
  }, [assets]);

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
        {['all', 'host', 'web_page', 'ports'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn-ghost ${filter === f ? 'bg-accent/10 text-accent' : ''}`}
          >
            {f === 'all' ? 'All' : f === 'host' ? 'Hosts' : f === 'web_page' ? 'Web Pages' : 'Ports'}
          </button>
        ))}
        <span className="text-xs text-text-muted self-center ml-2">
          {filter === 'ports' ? `${portGroups.length} port(s)` : `${filtered.length} asset(s)`}
        </span>
      </div>

      {filter === 'ports' ? (
        <PortsView portGroups={portGroups} engagementId={id} navigate={navigate} onCopyTarget={copyTarget} />
      ) : (
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
                    {a.target && (
                      <button
                        onClick={(e) => copyTarget(e, a.target)}
                        className="text-text-muted hover:text-accent transition-colors p-0.5 rounded hover:bg-accent/10"
                        title={`Copy ${a.asset_type === 'host' ? 'IP address' : 'URL'}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
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
      )}

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
