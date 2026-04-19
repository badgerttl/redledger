import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagement } from '../context/EngagementContext';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';
import TagBadge from '../components/TagBadge';
import api from '../api/client';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Plus, Trash2, Calendar, User, Shield, Clock,
  Server, Globe, Search, KeyRound, FileSearch, Target,
} from 'lucide-react';

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { engagements, current, refresh, selectEngagement, setCurrent } = useEngagement();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', client_name: '', client_contact: '', start_date: '', end_date: '', rules_of_engagement: '' });
  const [editing, setEditing] = useState(false);
  const [scopeForm, setScopeForm] = useState({ in_scope: '', out_scope: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Engagement-level data
  const [scope, setScope] = useState(null);
  const [assets, setAssets] = useState([]);
  const [findings, setFindings] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreate(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (id) {
      selectEngagement(parseInt(id));
    }
  }, [id, selectEngagement]);

  useEffect(() => {
    if (!current) return;
    const controller = new AbortController();
    const sig = { signal: controller.signal };
    setLoading(true);
    Promise.all([
      api.get(`/engagements/${current.id}/scope`, sig),
      api.get(`/engagements/${current.id}/assets`, sig),
      api.get(`/engagements/${current.id}/findings`, sig),
      api.get(`/engagements/${current.id}/credentials`, sig),
      api.get(`/engagements/${current.id}/activity-log?limit=10`, sig),
    ]).then(([s, a, f, c, act]) => {
      setScope(s.data);
      setAssets(a.data);
      setFindings(f.data);
      setCredentials(c.data);
      setActivity(act.data.items ?? []);
    }).catch((err) => {
      if (err.name !== 'CanceledError') toast.error(err.message);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [current]);

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      const { data } = await api.post('/engagements', form);
      toast.success('Engagement created');
      await refresh();
      setShowCreate(false);
      setForm({ name: '', description: '', client_name: '', client_contact: '', start_date: '', end_date: '', rules_of_engagement: '' });
      navigate(`/e/${data.id}`);
    } catch (err) { toast.error(err.message); }
  };

  const handleUpdate = async () => {
    try {
      const [engData] = await Promise.all([
        api.patch(`/engagements/${current.id}`, form).then(r => r.data),
        api.put(`/engagements/${current.id}/scope`, { in_scope: scopeForm.in_scope, out_scope: scopeForm.out_scope }),
      ]);
      setScope({ in_scope: scopeForm.in_scope, out_scope: scopeForm.out_scope });
      toast.success('Engagement updated');
      setCurrent(engData);
      setEditing(false);
      refresh();
    } catch (err) { toast.error(err.message); }
  };

  const confirmDelete = async (eid) => {
    try {
      await api.delete(`/engagements/${eid}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      setCurrent(null);
      refresh();
      navigate('/');
    } catch (err) { toast.error(err.message); }
  };

  const q = searchQuery.trim().toLowerCase();

  const filteredAssets = useMemo(() => {
    if (!q) return assets;
    return assets.filter((a) =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.target || '').toLowerCase().includes(q) ||
      (a.os || '').toLowerCase().includes(q)
    );
  }, [assets, q]);

  const filteredFindings = useMemo(() => {
    if (!q) return findings;
    return findings.filter((f) =>
      (f.title || '').toLowerCase().includes(q) ||
      (f.severity || '').toLowerCase().includes(q) ||
      (f.status || '').toLowerCase().includes(q) ||
      f.affected_assets?.some((a) => (a.name || '').toLowerCase().includes(q))
    );
  }, [findings, q]);

  const filteredCredentials = useMemo(() => {
    if (!q) return credentials;
    return credentials.filter((c) =>
      (c.username || '').toLowerCase().includes(q) ||
      (c.source || '').toLowerCase().includes(q) ||
      (c.access_level || '').toLowerCase().includes(q) ||
      (c.secret_type || '').toLowerCase().includes(q) ||
      c.assets?.some((a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.target || '').toLowerCase().includes(q)
      )
    );
  }, [credentials, q]);

  // ── Engagement list view ───────────────────────────────────────────────────
  if (!id) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Engagements</h1>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Engagement
          </button>
        </div>

        {showCreate && (
          <div className="card mb-6">
            <h2 className="text-base font-medium mb-4">Create Engagement</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Client Name</label><input className="input" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
              <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="mb-4"><label className="label">Description</label><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex gap-3">
              <button onClick={handleCreate} className="btn-primary">Create</button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        <div className="grid gap-3">
          {engagements.map((e) => (
            <div key={e.id} className="card flex items-center justify-between cursor-pointer hover:border-accent/30 transition-colors" onClick={() => navigate(`/e/${e.id}`)}>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-medium text-text-primary">{e.name}</span>
                  <StatusBadge status={e.status} />
                </div>
                <p className="text-xs text-text-muted">
                  {e.client_name && <span>{e.client_name} · </span>}
                  {e.start_date && <span>{e.start_date} — {e.end_date || '?'} · </span>}
                  Created {new Date(e.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={(ev) => { ev.stopPropagation(); setDeleteTarget(e.id); }}
                className="text-text-muted hover:text-red-400 transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {engagements.length === 0 && !showCreate && (
            <div className="text-center py-12 text-text-muted">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No engagements yet. Create one to get started.</p>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Engagement"
          message="Delete this engagement and all its data? This cannot be undone."
          onConfirm={() => confirmDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    );
  }

  if (!current) return <div className="text-text-muted">Loading...</div>;

  // ── Engagement dashboard ───────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{current.name}</h1>
          <p className="text-sm text-text-muted mt-0.5">Engagement Dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(true); setForm(current); setScopeForm({ in_scope: scope?.in_scope || '', out_scope: scope?.out_scope || '' }); }} className="btn-secondary">Edit</button>
          <button onClick={() => setDeleteTarget(current.id)} className="btn-danger">Delete</button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Edit Engagement</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Client Name</label><input className="input" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
            <div><label className="label">Client Contact</label><input className="input" value={form.client_contact} onChange={(e) => setForm({ ...form, client_contact: e.target.value })} /></div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="mb-4"><label className="label">Description</label><textarea className="textarea" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="mb-4"><label className="label">Rules of Engagement</label><textarea className="textarea min-h-[120px]" value={form.rules_of_engagement || ''} onChange={(e) => setForm({ ...form, rules_of_engagement: e.target.value })} /></div>
          <div className="border-t border-border pt-4 mb-4">
            <p className="text-sm font-medium text-text-primary mb-3">Scope</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">In Scope</label>
                <textarea className="textarea min-h-[120px]" placeholder="Targets, ranges, domains in scope…" value={scopeForm.in_scope} onChange={(e) => setScopeForm({ ...scopeForm, in_scope: e.target.value })} />
              </div>
              <div>
                <label className="label">Out of Scope</label>
                <textarea className="textarea min-h-[120px]" placeholder="Explicitly excluded targets…" value={scopeForm.out_scope} onChange={(e) => setScopeForm({ ...scopeForm, out_scope: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleUpdate} className="btn-primary">Save</button>
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Info panels */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Client Info</h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <p><span className="text-text-muted">Name:</span> {current.client_name || '—'}</p>
            <p><span className="text-text-muted">Contact:</span> {current.client_contact || '—'}</p>
          </div>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Timeline</h3>
          <div className="space-y-2 text-sm text-text-secondary">
            <p><span className="text-text-muted">Start:</span> {current.start_date || '—'}</p>
            <p><span className="text-text-muted">End:</span> {current.end_date || '—'}</p>
            <p><span className="text-text-muted">Status:</span> <StatusBadge status={current.status} /></p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> In Scope</h3>
          {scope?.in_scope?.trim()
            ? <p className="text-sm text-text-secondary whitespace-pre-wrap">{scope.in_scope}</p>
            : <p className="text-sm text-text-muted italic">Not defined</p>}
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2"><Target className="w-4 h-4" /> Out of Scope</h3>
          {scope?.out_scope?.trim()
            ? <p className="text-sm text-text-secondary whitespace-pre-wrap">{scope.out_scope}</p>
            : <p className="text-sm text-text-muted italic">Not defined</p>}
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="search"
            className="input pl-9 text-sm"
            placeholder="Search assets, findings, credentials…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {/* ── Assets ────────────────────────────────────────────────────────────── */}
      <SectionHeader
        title="Assets"
        icon={<Server className="w-4 h-4" />}
        count={assets.length}
        filteredCount={q ? filteredAssets.length : null}
      />
      <div className="card p-0 overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Target</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">OS</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Tags</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((a) => (
              <tr key={a.id} className="table-row cursor-pointer" onClick={() => navigate(`/e/${id}/assets/${a.id}`, { state: { from: `/e/${id}`, fromLabel: 'Dashboard' } })}>
                <td className="px-4 py-2.5 text-sm font-medium text-text-primary flex items-center gap-2">
                  {a.asset_type === 'host' ? <Server className="w-3.5 h-3.5 text-text-muted shrink-0" /> : <Globe className="w-3.5 h-3.5 text-text-muted shrink-0" />}
                  {a.name}
                </td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">{a.asset_type === 'host' ? 'Host' : 'Web Page'}</td>
                <td className="px-4 py-2.5 text-sm text-text-secondary font-mono">{a.target || '—'}</td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">{a.os || '—'}</td>
                <td className="px-4 py-2.5"><div className="flex gap-1 flex-wrap">{a.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}</div></td>
              </tr>
            ))}
            {assets.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-text-muted">No assets yet</td></tr>
            )}
            {assets.length > 0 && filteredAssets.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-text-muted">No assets match "{searchQuery}"</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Findings ──────────────────────────────────────────────────────────── */}
      <SectionHeader
        title="Findings"
        icon={<FileSearch className="w-4 h-4" />}
        count={findings.length}
        filteredCount={q ? filteredFindings.length : null}
      />
      <div className="card p-0 overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Severity</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">CVSS</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Phase</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Assets</th>
            </tr>
          </thead>
          <tbody>
            {filteredFindings.map((f) => (
              <tr key={f.id} className="table-row cursor-pointer" onClick={() => navigate(`/e/${id}/findings/${f.id}`, { state: { from: `/e/${id}`, fromLabel: 'Dashboard' } })}>
                <td className="px-4 py-2.5 text-sm font-medium text-text-primary">{f.title}</td>
                <td className="px-4 py-2.5"><SeverityBadge severity={f.severity} /></td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">{f.cvss_score ?? '—'}</td>
                <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">{f.phase || '—'}</td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">
                  {f.affected_assets?.length
                    ? <div className="flex flex-col gap-0.5">{f.affected_assets.map((a) => <span key={a.id} className="block">{a.name}{a.target ? <span className="text-text-muted font-mono text-xs"> ({a.target})</span> : ''}</span>)}</div>
                    : '—'}
                </td>
              </tr>
            ))}
            {findings.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-text-muted">No findings yet</td></tr>
            )}
            {findings.length > 0 && filteredFindings.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-text-muted">No findings match "{searchQuery}"</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Credentials ───────────────────────────────────────────────────────── */}
      <SectionHeader
        title="Credentials"
        icon={<KeyRound className="w-4 h-4" />}
        count={credentials.length}
        filteredCount={q ? filteredCredentials.length : null}
      />
      <div className="card p-0 overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Username</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Access Level</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Assets</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Source</th>
            </tr>
          </thead>
          <tbody>
            {filteredCredentials.map((c) => (
              <tr key={c.id} className="table-row cursor-pointer" onClick={() => navigate(`/e/${id}/credentials/${c.id}`, { state: { from: `/e/${id}`, fromLabel: 'Dashboard' } })}>
                <td className="px-4 py-2.5 text-sm font-mono text-text-primary">{c.username || '—'}</td>
                <td className="px-4 py-2.5 text-sm">
                  <span className="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">{c.secret_type}</span>
                </td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">{c.access_level || '—'}</td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">
                  {c.assets?.length > 0
                    ? <div className="flex gap-1 flex-wrap">{c.assets.map((a) => <span key={a.id} className="px-1.5 py-0.5 rounded text-xs bg-white/5 border border-border">{a.name}</span>)}</div>
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">{c.source || '—'}</td>
              </tr>
            ))}
            {credentials.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-text-muted">No credentials yet</td></tr>
            )}
            {credentials.length > 0 && filteredCredentials.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-text-muted">No credentials match "{searchQuery}"</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Recent Activity ────────────────────────────────────────────────────── */}
      {activity.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Recent Activity
          </h3>
          <div className="space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <span className="text-xs text-text-muted whitespace-nowrap mt-0.5">{new Date(a.timestamp).toLocaleString()}</span>
                <span className="text-text-secondary">{a.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Engagement"
        message="Delete this engagement and all its data? This cannot be undone."
        onConfirm={() => confirmDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function SectionHeader({ title, icon, count, filteredCount }) {
  return (
    <div className="flex items-center mb-2">
      <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <span className="text-text-muted">{icon}</span>
        {title}
        {count != null && (
          <span className="text-xs font-normal text-text-muted">
            {filteredCount != null ? `${filteredCount} of ${count}` : count}
          </span>
        )}
      </h2>
    </div>
  );
}
