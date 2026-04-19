import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEngagement } from '../context/EngagementContext';
import StatusBadge from '../components/StatusBadge';
import api from '../api/client';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Trash2, Calendar, User, Shield, Clock } from 'lucide-react';

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { engagements, current, refresh, selectEngagement, setCurrent } = useEngagement();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', client_name: '', client_contact: '', start_date: '', end_date: '', rules_of_engagement: '' });
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreate(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (id) {
      setStats(null);
      selectEngagement(parseInt(id));
    }
  }, [id, selectEngagement]);

  useEffect(() => {
    if (!current) return;
    const controller = new AbortController();
    const sig = { signal: controller.signal };
    Promise.all([
      api.get(`/engagements/${current.id}/assets`, sig),
      api.get(`/engagements/${current.id}/findings`, sig),
      api.get(`/engagements/${current.id}/credentials`, sig),
      api.get(`/engagements/${current.id}/activity-log?limit=5`, sig),
    ]).then(([assets, findings, creds, activity]) => {
      setStats({ assets: assets.data.length, findings: findings.data.length, credentials: creds.data.length, recentActivity: activity.data.items });
    }).catch((err) => {
      if (err.name !== 'CanceledError') toast.error(err.message);
    });
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
      const { data } = await api.patch(`/engagements/${current.id}`, form);
      toast.success('Engagement updated');
      setCurrent(data);
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

  // Engagement list view
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

  // Engagement detail / dashboard
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{current.name}</h1>
          <p className="text-sm text-text-muted mt-0.5">Engagement Dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(true); setForm(current); }} className="btn-secondary">Edit</button>
          <button onClick={() => setDeleteTarget(current.id)} className="btn-danger">Delete</button>
        </div>
      </div>

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
          <div className="flex gap-3">
            <button onClick={handleUpdate} className="btn-primary">Save</button>
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => navigate(`/e/${id}/assets`)}
          className="card text-center hover:border-accent/30 transition-colors cursor-pointer"
        >
          <div className="text-2xl font-semibold text-accent">{stats?.assets ?? '—'}</div>
          <div className="text-xs text-text-muted mt-1">Assets</div>
        </button>
        <button
          onClick={() => navigate(`/e/${id}/findings`)}
          className="card text-center hover:border-accent/30 transition-colors cursor-pointer"
        >
          <div className="text-2xl font-semibold text-sev-high">{stats?.findings ?? '—'}</div>
          <div className="text-xs text-text-muted mt-1">Findings</div>
        </button>
        <button
          onClick={() => navigate(`/e/${id}/credentials`)}
          className="card text-center hover:border-accent/30 transition-colors cursor-pointer"
        >
          <div className="text-2xl font-semibold text-sev-medium">{stats?.credentials ?? '—'}</div>
          <div className="text-xs text-text-muted mt-1">Credentials</div>
        </button>
      </div>

      {/* Info panels */}
      <div className="grid grid-cols-2 gap-4 mb-6">
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

      {current.rules_of_engagement && (
        <div className="card mb-6">
          <h3 className="text-sm font-medium text-text-primary mb-3">Rules of Engagement</h3>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{current.rules_of_engagement}</p>
        </div>
      )}

      {/* Recent Activity */}
      {stats?.recentActivity?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Activity</h3>
          <div className="space-y-2">
            {stats.recentActivity.map((a) => (
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
