import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import MarkdownViewer from '../components/MarkdownViewer';
import MarkdownEditor from '../components/MarkdownEditor';
import AttachmentGallery from '../components/AttachmentGallery';
import { ArrowLeft, Trash2, Edit2, Save, Search, Loader2 } from 'lucide-react';

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
  const [cveInput, setCveInput] = useState('');
  const [cveLookupLoading, setCveLookupLoading] = useState(false);
  const [allAssets, setAllAssets] = useState([]);

  const load = async () => {
    try {
      const [f, s, a] = await Promise.all([
        api.get(`/findings/${findingId}`),
        api.get(`/findings/${findingId}/screenshots`),
        api.get(`/engagements/${id}/assets`),
      ]);
      setFinding(f.data);
      setScreenshots(s.data);
      setAllAssets(a.data);
    } catch (err) {
      if (err.name !== 'CanceledError') toast.error(err.message);
    }
  };

  useEffect(() => { load(); }, [findingId]);

  const startEdit = () => {
    setForm({
      title: finding.title,
      description: finding.description,
      impact: finding.impact,
      remediation: finding.remediation,
      references: finding.references || '',
      severity: finding.severity,
      cvss_score: finding.cvss_score ?? '',
      cvss_vector: finding.cvss_vector,
      status: finding.status,
      phase: finding.phase,
      asset_ids: finding.affected_assets?.map(a => a.id) ?? [],
    });
    setEditing(true);
  };

  const toggleAsset = (assetId) => {
    setForm(f => ({
      ...f,
      asset_ids: f.asset_ids.includes(assetId)
        ? f.asset_ids.filter(id => id !== assetId)
        : [...f.asset_ids, assetId],
    }));
  };

  const lookupCve = async () => {
    const cve = cveInput.trim().toUpperCase();
    if (!/^CVE-\d{4}-\d{4,}$/.test(cve)) {
      toast.error('Enter a valid CVE ID (e.g. CVE-2021-44228)');
      return;
    }
    const cached = sessionStorage.getItem(`cve:${cve}`);
    if (cached) {
      applyCveData(cve, JSON.parse(cached));
      return;
    }
    setCveLookupLoading(true);
    try {
      const res = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cve}`);
      if (!res.ok) throw new Error(`NVD API returned ${res.status}`);
      const json = await res.json();
      const vuln = json.vulnerabilities?.[0]?.cve;
      if (!vuln) { toast.error('CVE not found in NVD'); return; }
      const metric = vuln.metrics?.cvssMetricV31?.[0] || vuln.metrics?.cvssMetricV30?.[0] || vuln.metrics?.cvssMetricV2?.[0];
      const data = {
        score: metric?.cvssData?.baseScore ?? null,
        vector: metric?.cvssData?.vectorString ?? '',
        description: vuln.descriptions?.find(d => d.lang === 'en')?.value ?? '',
      };
      sessionStorage.setItem(`cve:${cve}`, JSON.stringify(data));
      applyCveData(cve, data);
    } catch (err) {
      toast.error(`CVE lookup failed: ${err.message}`);
    } finally {
      setCveLookupLoading(false);
    }
  };

  const applyCveData = (cve, data) => {
    setForm(prev => ({
      ...prev,
      cvss_score: data.score != null ? String(data.score) : prev.cvss_score,
      cvss_vector: data.vector || prev.cvss_vector,
      description: prev.description
        ? `${prev.description}\n\n**NVD:** ${data.description}`
        : data.description,
      references: prev.references
        ? `${prev.references}\nhttps://nvd.nist.gov/vuln/detail/${cve}`
        : `https://nvd.nist.gov/vuln/detail/${cve}`,
    }));
    toast.success(`${cve} data applied`);
  };

  const handleSave = async () => {
    if (form.cvss_score !== '') {
      const score = parseFloat(form.cvss_score);
      if (isNaN(score) || score < 0 || score > 10) { toast.error('CVSS score must be between 0.0 and 10.0'); return; }
    }
    try {
      const payload = { ...form, cvss_score: form.cvss_score !== '' ? parseFloat(form.cvss_score) : null };
      await api.patch(`/findings/${findingId}`, payload);
      toast.success('Finding updated');
      setEditing(false);
      load();
    } catch (err) { toast.error(err.message); }
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
    } catch (err) { toast.error(err.message); }
  };

  const deleteFile = async (scId) => {
    try {
      await api.delete(`/screenshots/${scId}`);
      load();
    } catch (err) { toast.error(err.message); }
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
            <label className="label mb-2 block">Affected Assets</label>
            <div className="flex flex-wrap gap-2">
              {allAssets.length === 0 && <span className="text-xs text-text-muted">No assets in this engagement</span>}
              {allAssets.map(a => {
                const selected = form.asset_ids?.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAsset(a.id)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${selected ? 'bg-accent/20 border-accent text-accent' : 'bg-transparent border-border text-text-muted hover:border-accent/50 hover:text-text-secondary'}`}
                  >
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                    {a.name}{a.target ? ` (${a.target})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
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

            {/* CVE Lookup */}
            <div className="mb-4 p-3 rounded-lg bg-input border border-border">
              <label className="label mb-2 flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> CVE Lookup (NVD)</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1 font-mono text-xs"
                  placeholder="CVE-2021-44228"
                  value={cveInput}
                  onChange={(e) => setCveInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookupCve()}
                />
                <button
                  type="button"
                  onClick={lookupCve}
                  disabled={cveLookupLoading}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                >
                  {cveLookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Lookup
                </button>
              </div>
              <p className="text-2xs text-text-muted mt-1.5">Auto-fills CVSS score, vector, description, and adds NVD reference link.</p>
            </div>

            <div className="mb-4">
              <label className="label block mb-1">Description (Markdown)</label>
              <MarkdownEditor value={form.description ?? ''} onChange={(v) => setForm(prev => ({ ...prev, description: v }))} minHeight="150px" />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label block mb-1">Impact</label>
                <MarkdownEditor value={form.impact ?? ''} onChange={(v) => setForm(prev => ({ ...prev, impact: v }))} minHeight="100px" />
              </div>
              <div>
                <label className="label block mb-1">Remediation</label>
                <MarkdownEditor value={form.remediation ?? ''} onChange={(v) => setForm(prev => ({ ...prev, remediation: v }))} minHeight="100px" />
              </div>
            </div>
            <div>
              <label className="label">References (one URL per line)</label>
              <textarea className="textarea text-xs font-mono" rows={3} placeholder="https://nvd.nist.gov/vuln/detail/CVE-..." value={form.references ?? ''} onChange={(e) => setForm({ ...form, references: e.target.value })} />
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
          {finding.references && (
            <div className="card">
              <h3 className="text-sm font-medium mb-3">References</h3>
              <div className="space-y-1">
                {finding.references.split('\n').filter(Boolean).map((ref, i) => (
                  <a key={i} href={ref.trim()} target="_blank" rel="noopener noreferrer" className="block text-xs text-accent hover:underline font-mono truncate">
                    {ref.trim()}
                  </a>
                ))}
              </div>
            </div>
          )}
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
