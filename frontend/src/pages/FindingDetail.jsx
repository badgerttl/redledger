import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import MarkdownViewer from '../components/MarkdownViewer';
import FileUpload from '../components/FileUpload';
import { ArrowLeft, Trash2, Image, Edit2, Save } from 'lucide-react';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const STATUSES = ['draft', 'confirmed', 'reported', 'remediated'];
const PHASES = ['', 'Reconnaissance', 'Scanning and Enumeration', 'Exploitation', 'Post-Exploitation', 'Reporting'];

export default function FindingDetail() {
  const { id, findingId } = useParams();
  const navigate = useNavigate();
  const [finding, setFinding] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [screenshots, setScreenshots] = useState([]);

  const load = async () => {
    try {
      const [f, s] = await Promise.all([
        api.get(`/findings/${findingId}`),
        api.get(`/findings/${findingId}/screenshots`),
      ]);
      setFinding(f.data);
      setScreenshots(s.data);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, [findingId]);

  const startEdit = () => {
    setForm({
      title: finding.title,
      description: finding.description,
      impact: finding.impact,
      remediation: finding.remediation,
      severity: finding.severity,
      cvss_score: finding.cvss_score ?? '',
      cvss_vector: finding.cvss_vector,
      status: finding.status,
      phase: finding.phase,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const payload = { ...form, cvss_score: form.cvss_score !== '' ? parseFloat(form.cvss_score) : null };
      await api.patch(`/findings/${findingId}`, payload);
      toast.success('Finding updated');
      setEditing(false);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const uploadScreenshot = async (files) => {
    const file = files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caption', '');
    try {
      await api.post(`/findings/${findingId}/screenshots`, formData);
      load();
      toast.success('Evidence uploaded');
    } catch { toast.error('Upload failed'); }
  };

  const deleteScreenshot = async (scId) => {
    try {
      await api.delete(`/screenshots/${scId}`);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  if (!finding) return <div className="text-text-muted">Loading...</div>;

  return (
    <div>
      <button onClick={() => navigate(`/e/${id}/findings`)} className="btn-ghost mb-4 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Findings
      </button>

      <div className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">{finding.title}</h1>
          <SeverityBadge severity={finding.severity} />
          <StatusBadge status={finding.status} />
        </div>
        <button onClick={editing ? handleSave : startEdit} className="btn-primary flex items-center gap-2">
          {editing ? <><Save className="w-4 h-4" /> Save</> : <><Edit2 className="w-4 h-4" /> Edit</>}
        </button>
      </div>

      {editing ? (
        <div className="space-y-4 mb-6">
          <div className="card">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2"><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <label className="label">Severity</label>
                <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
                <div><label className="label">CVSS Vector</label><input className="input" value={form.cvss_vector} onChange={(e) => setForm({ ...form, cvss_vector: e.target.value })} /></div>
              </div>
            </div>
            <div className="mb-4"><label className="label">Description (Markdown)</label><textarea className="textarea min-h-[150px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Impact</label><textarea className="textarea" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} /></div>
              <div><label className="label">Remediation</label><textarea className="textarea" value={form.remediation} onChange={(e) => setForm({ ...form, remediation: e.target.value })} /></div>
            </div>
          </div>
          <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Meta */}
          <div className="card">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div><span className="text-text-muted">CVSS:</span> <span className="text-text-primary font-medium">{finding.cvss_score ?? '—'}</span></div>
              <div><span className="text-text-muted">Vector:</span> <span className="text-text-secondary font-mono text-xs">{finding.cvss_vector || '—'}</span></div>
              <div><span className="text-text-muted">Phase:</span> <span className="text-text-secondary">{finding.phase || '—'}</span></div>
              <div><span className="text-text-muted">Updated:</span> <span className="text-text-secondary">{new Date(finding.updated_at).toLocaleDateString()}</span></div>
            </div>
          </div>

          {/* Affected assets */}
          {finding.affected_assets?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-medium mb-2">Affected Assets</h3>
              <div className="flex gap-2 flex-wrap">
                {finding.affected_assets.map(a => (
                  <span key={a.id} className="inline-flex items-center px-2 py-1 rounded bg-accent/10 text-accent text-xs cursor-pointer" onClick={() => navigate(`/e/${id}/assets/${a.id}`)}>
                    {a.name} ({a.target})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description, Impact, Remediation */}
          <div className="card">
            <h3 className="text-sm font-medium mb-3">Description</h3>
            <MarkdownViewer content={finding.description} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-medium mb-3">Impact</h3>
              <MarkdownViewer content={finding.impact} />
            </div>
            <div className="card">
              <h3 className="text-sm font-medium mb-3">Remediation</h3>
              <MarkdownViewer content={finding.remediation} />
            </div>
          </div>
        </div>
      )}

      {/* Evidence Screenshots */}
      <div className="mt-6">
        <h2 className="text-base font-medium mb-3 flex items-center gap-2"><Image className="w-4 h-4" /> Evidence</h2>
        <FileUpload
          onDrop={uploadScreenshot}
          accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }}
          label="Drop evidence screenshot here or click to upload"
        />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {screenshots.map((s) => (
            <div key={s.id} className="card p-2 group relative">
              <img src={`/api/screenshots/${s.id}/file`} alt={s.caption || s.filename} className="w-full rounded object-cover max-h-48" />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-2xs text-text-muted truncate">{s.filename}</span>
                <button onClick={() => deleteScreenshot(s.id)} className="text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
