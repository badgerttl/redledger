import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import TagBadge from '../components/TagBadge';
import { Plus, Trash2, ChevronDown, ChevronUp, X, Upload, FileJson, FileText } from 'lucide-react';
import { formatStructuredContent } from '../utils/formatContent';

const PHASES = ['', 'Reconnaissance', 'Scanning and Enumeration', 'Exploitation', 'Post-Exploitation', 'Reporting'];

const TOOLS = [
  { id: 'nmap',         label: 'NMAP',         desc: 'XML scan results → Assets',              ext: '.xml',  format: 'xml' },
  { id: 'burp',         label: 'Burp Suite',    desc: 'XML issues export → Findings',           ext: '.xml',  format: 'xml' },
  { id: 'noseyparker',  label: 'Noseyparker',   desc: 'JSON secrets → Code Review tab',         ext: '.json', format: 'json' },
  { id: 'trufflehog',   label: 'Trufflehog',    desc: 'JSON secrets → Code Review tab',         ext: '.json', format: 'json' },
  { id: 'semgrep',      label: 'Semgrep',        desc: 'JSON SAST results → Code Review tab',   ext: '.json', format: 'json' },
  { id: 'manual',       label: 'Manual',         desc: 'Paste raw tool output text',             ext: null,    format: 'text' },
];

function prettyJson(text, isNdjson = false) {
  try {
    if (isNdjson) {
      const lines = text.split('\n').filter((l) => l.trim());
      return JSON.stringify(lines.map((l) => JSON.parse(l)), null, 2);
    }
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text; // fallback: keep raw
  }
}

function parseSemgrep(text) {
  const data = JSON.parse(text);
  const results = data.results ?? data;
  return results.map((r) => {
    const meta = r.extra?.metadata || {};
    const arrStr = (v) => Array.isArray(v) ? v.join(', ') : (v || '');
    return {
      check_id: r.check_id || '',
      path: r.path || '',
      line: r.start?.line ?? 0,
      col: r.start?.col ?? 0,
      message: r.extra?.message || r.message || '',
      severity: (r.extra?.severity || r.severity || '').toUpperCase(),
      lines: r.extra?.lines || '',
      technology: arrStr(meta.technology),
      vulnerability_class: arrStr(meta.vulnerability_class),
      likelihood: meta.likelihood || '',
      impact: meta.impact || '',
      confidence: meta.confidence || '',
      cwe: arrStr(meta.cwe),
      owasp: arrStr(meta.owasp),
    };
  });
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

function AddOutputModal({ engagementId, onClose, onSuccess }) {
  const [step, setStep] = useState('pick'); // 'pick' | 'input'
  const [tool, setTool] = useState(null);
  const [fileText, setFileText] = useState('');
  const [manualForm, setManualForm] = useState({ tool_name: '', phase: '', content: '' });
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readFileText(file);
      setFileText(text);
    } catch {
      toast.error('Could not read file');
    }
  };

  const handleImport = async () => {
    if (!tool) return;
    setImporting(true);
    try {
      if (tool.id === 'nmap') {
        if (!fileText) return toast.error('Upload an Nmap XML file first');
        const blob = new Blob([fileText], { type: 'text/xml' });
        const form = new FormData();
        form.append('file', blob, 'nmap.xml');
        const { data } = await api.post(`/engagements/${engagementId}/import/nmap`, form);
        toast.success(`Imported ${data.hosts_found} host(s)`);
        onSuccess('nmap');

      } else if (tool.id === 'burp') {
        if (!fileText) return toast.error('Upload a Burp XML file first');
        const blob = new Blob([fileText], { type: 'text/xml' });
        const form = new FormData();
        form.append('file', blob, 'burp.xml');
        const { data } = await api.post(`/engagements/${engagementId}/import/burp`, form);
        toast.success(`Imported ${data.findings_created} finding(s) from Burp Suite`);
        onSuccess('burp');

      } else if (tool.id === 'noseyparker' || tool.id === 'trufflehog') {
        if (!fileText) return toast.error('Upload or paste JSON output first');
        const isNdjson = tool.id === 'trufflehog';
        const content = prettyJson(fileText, isNdjson);
        await api.post(`/engagements/${engagementId}/tool-output`, {
          tool_name: tool.id,
          phase: '',
          content,
        });
        toast.success(`${tool.label} output saved to Code Review`);
        onSuccess('manual');

      } else if (tool.id === 'semgrep') {
        if (!fileText) return toast.error('Upload or paste Semgrep JSON first');
        const findings = parseSemgrep(fileText);
        if (findings.length === 0) return toast.error('No findings in Semgrep output');
        await api.post(`/engagements/${engagementId}/semgrep/bulk`, findings);
        toast.success(`Imported ${findings.length} Semgrep finding(s)`);
        onSuccess('semgrep');

      } else if (tool.id === 'manual') {
        if (!manualForm.content.trim()) return toast.error('Content is required');
        await api.post(`/engagements/${engagementId}/tool-output`, manualForm);
        toast.success('Tool output added');
        onSuccess('manual');
      }
      onClose();
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">
            {step === 'pick' ? 'Add Output' : `Import — ${tool?.label}`}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {step === 'pick' ? (
            <div className="grid grid-cols-2 gap-2.5">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTool(t); setStep('input'); setFileText(''); }}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-input/30 px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  <span className="text-sm font-medium text-text-primary">{t.label}</span>
                  <span className="text-xs text-text-muted">{t.desc}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {tool.format !== 'text' ? (
                <>
                  <div>
                    <input ref={fileRef} type="file" accept={tool.ext} className="hidden" onChange={handleFileChange} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="btn-secondary flex items-center gap-2 text-sm"
                    >
                      <Upload className="h-4 w-4" />
                      Upload {tool.ext} file
                    </button>
                    {fileText && (
                      <p className="mt-1.5 text-xs text-green-400">
                        File loaded — {fileText.length.toLocaleString()} chars
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">— or paste content below —</p>
                  <textarea
                    className="textarea min-h-[140px] font-mono text-xs"
                    placeholder={`Paste ${tool.label} ${tool.format.toUpperCase()} output here…`}
                    value={fileText}
                    onChange={(e) => setFileText(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Tool Name</label>
                      <input
                        className="input"
                        placeholder="e.g. nmap, gobuster…"
                        value={manualForm.tool_name}
                        onChange={(e) => setManualForm({ ...manualForm, tool_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Phase</label>
                      <select
                        className="input"
                        value={manualForm.phase}
                        onChange={(e) => setManualForm({ ...manualForm, phase: e.target.value })}
                      >
                        {PHASES.map((p) => <option key={p} value={p}>{p || 'Select phase…'}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Content</label>
                    <textarea
                      className="textarea min-h-[160px] font-mono text-xs"
                      placeholder="Paste tool output here…"
                      value={manualForm.content}
                      onChange={(e) => setManualForm({ ...manualForm, content: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-border px-5 py-4">
          {step === 'input' ? (
            <button onClick={() => setStep('pick')} className="btn-ghost text-sm">← Back</button>
          ) : (
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          )}
          {step === 'input' && (
            <button onClick={handleImport} disabled={importing} className="btn-primary text-sm">
              {importing ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ToolOutput() {
  const { id } = useParams();
  const [outputs, setOutputs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filterPhase, setFilterPhase] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh((r) => r + 1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = {};
        if (filterPhase) params.phase = filterPhase;
        const { data } = await api.get(`/engagements/${id}/tool-output`, { params, signal: controller.signal });
        setOutputs(data);
      } catch (err) {
        if (err.name !== 'CanceledError') toast.error(err.message);
      }
    };
    load();
    return () => controller.abort();
  }, [id, filterPhase, refresh]);

  const handleDelete = async (outputId) => {
    try {
      await api.delete(`/tool-output/${outputId}`);
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const handleSuccess = (type) => {
    if (type === 'manual') reload();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tool Output</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Output
        </button>
      </div>

      {/* Phase filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setFilterPhase(p)}
            className={`btn-ghost text-xs ${filterPhase === p ? 'bg-accent/10 text-accent' : ''}`}
          >
            {p || 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {outputs.map((o) => (
          <div key={o.id} className="card">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-text-primary">{o.tool_name || 'Unnamed'}</span>
                {o.phase && <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">{o.phase}</span>}
                <div className="flex gap-1">{o.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">{new Date(o.created_at).toLocaleString()}</span>
                {expandedId === o.id
                  ? <ChevronUp className="w-4 h-4 text-text-muted" />
                  : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </div>
            </div>
            {expandedId === o.id && (
              <div className="mt-3 pt-3 border-t border-border">
                <pre className="bg-input p-4 rounded-lg overflow-x-auto text-xs font-mono text-text-secondary max-h-96 overflow-y-auto whitespace-pre-wrap">
                  {formatStructuredContent(o.content)}
                </pre>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => handleDelete(o.id)}
                    className="btn-danger text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {outputs.length === 0 && (
          <div className="text-center py-12 text-text-muted">No tool output yet</div>
        )}
      </div>

      {showModal && (
        <AddOutputModal
          engagementId={id}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
