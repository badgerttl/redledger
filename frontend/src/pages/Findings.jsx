import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import TagBadge from '../components/TagBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Trash2, X, FileText, Paperclip } from 'lucide-react';

const SEVERITIES = ['', 'Critical', 'High', 'Medium', 'Low', 'Info'];
const STATUSES = ['', 'draft', 'confirmed', 'reported', 'remediated'];
const PHASES = ['', 'Reconnaissance', 'Scanning and Enumeration', 'Exploitation', 'Post-Exploitation', 'Reporting'];

export default function Findings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [findings, setFindings] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', severity: 'Info', status: 'draft', phase: '', description: '', impact: '', remediation: '', cvss_score: '', cvss_vector: '' });
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [queuedFiles, setQueuedFiles] = useState([]);

  const load = async () => {
    try {
      const params = {};
      if (filterSeverity) params.severity = filterSeverity;
      if (filterStatus) params.status = filterStatus;
      const { data } = await api.get(`/engagements/${id}/findings`, { params });
      setFindings(data);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, [id, filterSeverity, filterStatus]);

  const handleCreate = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    const payload = { ...form, cvss_score: form.cvss_score ? parseFloat(form.cvss_score) : null };
    try {
      const { data } = await api.post(`/engagements/${id}/findings`, payload);
      for (const file of queuedFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('caption', '');
        await api.post(`/findings/${data.id}/screenshots`, fd);
      }
      toast.success('Finding created');
      setShowCreate(false);
      setForm({ title: '', severity: 'Info', status: 'draft', phase: '', description: '', impact: '', remediation: '', cvss_score: '', cvss_vector: '' });
      setQueuedFiles([]);
      navigate(`/e/${id}/findings/${data.id}`);
    } catch { toast.error('Failed to create finding'); }
  };

  const confirmDelete = async (findingId) => {
    try {
      await api.delete(`/findings/${findingId}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Findings</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Finding
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Create Finding</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2"><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label className="label">Severity</label>
              <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Phase</label>
              <select className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                {PHASES.map(p => <option key={p} value={p}>{p || 'Select...'}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">CVSS Score</label><input type="number" step="0.1" min="0" max="10" className="input" value={form.cvss_score} onChange={(e) => setForm({ ...form, cvss_score: e.target.value })} /></div>
              <div><label className="label">CVSS Vector</label><input className="input" placeholder="CVSS:3.1/AV:N/..." value={form.cvss_vector} onChange={(e) => setForm({ ...form, cvss_vector: e.target.value })} /></div>
            </div>
          </div>
          <div className="mb-4"><label className="label">Description</label><textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Impact</label><textarea className="textarea" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} /></div>
            <div><label className="label">Remediation</label><textarea className="textarea" value={form.remediation} onChange={(e) => setForm({ ...form, remediation: e.target.value })} /></div>
          </div>
          <div className="mb-4">
            <label className="label flex items-center gap-2">
              <Paperclip className="w-3.5 h-3.5" /> Attachments
              <button
                type="button"
                onClick={() => document.getElementById('finding-file-input').click()}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-accent hover:bg-accent/10 transition-colors ml-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
              <input
                id="finding-file-input"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (files.length) setQueuedFiles(prev => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
            </label>
            {queuedFiles.length > 0 && (
              <div className="space-y-1 mt-2">
                {queuedFiles.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-input rounded px-2.5 py-1.5">
                    <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-xs text-text-secondary truncate flex-1">{f.name}</span>
                    <span className="text-2xs text-text-muted">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => setQueuedFiles(prev => prev.filter((_, i) => i !== idx))} className="text-text-muted hover:text-red-400 transition-colors shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary">Create</button>
            <button onClick={() => { setShowCreate(false); setQueuedFiles([]); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex gap-1 items-center">
          <span className="text-xs text-text-muted mr-1">Severity:</span>
          {SEVERITIES.map(s => (
            <button key={s} onClick={() => setFilterSeverity(s)} className={`btn-ghost text-xs ${filterSeverity === s ? 'bg-accent/10 text-accent' : ''}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-xs text-text-muted mr-1">Status:</span>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`btn-ghost text-xs ${filterStatus === s ? 'bg-accent/10 text-accent' : ''}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Severity</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">CVSS</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Phase</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Tags</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f) => (
              <tr key={f.id} className="table-row cursor-pointer" onClick={() => navigate(`/e/${id}/findings/${f.id}`)}>
                <td className="px-4 py-3 text-sm font-medium text-text-primary">{f.title}</td>
                <td className="px-4 py-3"><SeverityBadge severity={f.severity} /></td>
                <td className="px-4 py-3 text-sm text-text-secondary">{f.cvss_score ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                <td className="px-4 py-3 text-sm text-text-secondary">{f.phase || '—'}</td>
                <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{f.tags?.map(t => <TagBadge key={t.id} tag={t} />)}</div></td>
                <td className="px-4 py-3">
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(f.id); }} className="text-text-muted hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {findings.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">No findings yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Finding"
        message="Delete this finding? This cannot be undone."
        onConfirm={() => confirmDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
