import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import MarkdownViewer from '../components/MarkdownViewer';
import MarkdownEditor from '../components/MarkdownEditor';
import AttachmentGallery from '../components/AttachmentGallery';
import { ArrowLeft, Trash2, Edit2, Save } from 'lucide-react';

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

  const uploadFile = async (files) => {
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

  const deleteFile = async (scId) => {
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
            <div className="mb-4">
              <label className="label block mb-1">Description (Markdown)</label>
              <MarkdownEditor value={form.description ?? ''} onChange={(v) => setForm({ ...form, description: v })} minHeight="150px" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label block mb-1">Impact</label>
                <MarkdownEditor value={form.impact ?? ''} onChange={(v) => setForm({ ...form, impact: v })} minHeight="100px" />
              </div>
              <div>
                <label className="label block mb-1">Remediation</label>
                <MarkdownEditor value={form.remediation ?? ''} onChange={(v) => setForm({ ...form, remediation: v })} minHeight="100px" />
              </div>
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

      {/* Evidence */}
      <div className="mt-6">
        <AttachmentGallery
          attachments={screenshots}
          onUpload={uploadFile}
          onDelete={deleteFile}
          title="Evidence"
        />
      </div>
    </div>
  );
}
