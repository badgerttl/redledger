import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import TagBadge from '../components/TagBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownViewer from '../components/MarkdownViewer';
import { parseSseLines } from '../assistant/sseUtils';
import { ASSISTANT_MODEL_STORAGE_KEY } from '../assistant/storageKeys';
import { useSettings } from '../context/SettingsContext';
import { Plus, Trash2, X, FileText, Paperclip, Sparkles, Edit2, Square, RefreshCw } from 'lucide-react';

const SEVERITIES = ['', 'Critical', 'High', 'Medium', 'Low', 'Info'];
const STATUSES = ['', 'draft', 'confirmed', 'reported', 'remediated'];
const PHASES = ['', 'Reconnaissance', 'Scanning and Enumeration', 'Exploitation', 'Post-Exploitation', 'Reporting'];

const DEFAULT_FINDINGS_GEN_INSTRUCTIONS =
`You are a professional penetration tester writing a formal security finding report.
Given the finding details, respond with ONLY the following markdown structure — no preamble, no extra text:

## Description
[Technical explanation of the vulnerability, how it was identified, and proof of concept. Use bullets, code blocks, and bold as appropriate.]

## Impact
[Business and technical impact if exploited.]

## Remediation
[Specific, actionable remediation steps.]`;

/**
 * Parse LLM markdown output into { description, impact, remediation }.
 * Splits on ## Description / ## Impact / ## Remediation headers (case-insensitive).
 */
function parseFindingSections(markdown) {
  const norm = markdown.replace(/\r\n/g, '\n');
  const pick = (pattern) => {
    const m = norm.match(pattern);
    return m ? m[1].trim() : '';
  };
  return {
    description: pick(/##\s*Description\s*\n([\s\S]*?)(?=##\s*Impact|##\s*Remediation|$)/i),
    impact:      pick(/##\s*Impact\s*\n([\s\S]*?)(?=##\s*Description|##\s*Remediation|$)/i),
    remediation: pick(/##\s*Remediation\s*\n([\s\S]*?)(?=##\s*Description|##\s*Impact|$)/i),
  };
}

const EMPTY_MANUAL_FORM = {
  title: '', severity: 'Info', status: 'draft', phase: '',
  description: '', impact: '', remediation: '',
  cvss_score: '', cvss_vector: '',
};

const EMPTY_AI_FORM = {
  title: '', severity: 'Info', status: 'draft', phase: '',
  cvss_score: '', cvss_vector: '', asset_ids: [], references: '', details: '',
};

function AssetPicker({ allAssets, selected, onChange }) {
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  if (allAssets.length === 0)
    return <span className="text-xs text-text-muted">No assets in this engagement</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {allAssets.map((a) => {
        const sel = selected.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
              sel
                ? 'bg-accent/20 border-accent text-accent'
                : 'bg-transparent border-border text-text-muted hover:border-accent/50 hover:text-text-secondary'
            }`}
          >
            {sel && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
            {a.name}{a.target ? ` (${a.target})` : ''}
          </button>
        );
      })}
    </div>
  );
}

export default function Findings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [findings, setFindings] = useState([]);
  const [assets, setAssets] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState(null); // null | 'manual' | 'ai'

  // Manual form state
  const [form, setForm] = useState(EMPTY_MANUAL_FORM);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [queuedFiles, setQueuedFiles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // AI form state
  const [aiForm, setAiForm] = useState(EMPTY_AI_FORM);
  const [aiGenerated, setAiGenerated] = useState(null); // { description, impact, remediation } | null
  const [aiStreaming, setAiStreaming] = useState(false);
  const [aiStreamRaw, setAiStreamRaw] = useState('');
  const aiAbortRef = useRef(null);
  const streamScrollRef = useRef(null);
  const streamStickRef = useRef(true);

  const syncStreamStick = useCallback(() => {
    const el = streamScrollRef.current;
    if (!el) return;
    streamStickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
  }, []);

  useLayoutEffect(() => {
    if (!streamStickRef.current) return;
    const el = streamScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [aiStreamRaw]);

  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh((r) => r + 1);

  useEffect(() => {
    api.get('/finding-templates').then(({ data }) => setTemplates(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = {};
        if (filterSeverity) params.severity = filterSeverity;
        if (filterStatus) params.status = filterStatus;
        const [findingsRes, assetsRes] = await Promise.all([
          api.get(`/engagements/${id}/findings`, { params, signal: controller.signal }),
          api.get(`/engagements/${id}/assets`, { signal: controller.signal }),
        ]);
        setFindings(findingsRes.data);
        setAssets(assetsRes.data);
      } catch (err) {
        if (err.name !== 'CanceledError') toast.error(err.message);
      }
    };
    load();
    return () => controller.abort();
  }, [id, filterSeverity, filterStatus, refresh]);

  // ── Manual create ──────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    if (form.cvss_score !== '') {
      const score = parseFloat(form.cvss_score);
      if (isNaN(score) || score < 0 || score > 10)
        return toast.error('CVSS score must be between 0.0 and 10.0');
    }
    const payload = { ...form, cvss_score: form.cvss_score !== '' ? parseFloat(form.cvss_score) : null };
    try {
      const { data } = await api.post(`/engagements/${id}/findings`, payload);
      for (const file of queuedFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('caption', '');
        await api.post(`/findings/${data.id}/screenshots`, fd);
      }
      toast.success('Finding created');
      closeCreate();
      navigate(`/e/${id}/findings/${data.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── AI generate ────────────────────────────────────────────────────────────

  const handleAiGenerate = async () => {
    const model = localStorage.getItem(ASSISTANT_MODEL_STORAGE_KEY);
    if (!model) return toast.error('No LLM model selected — open Assistant and pick one first');

    const sys = settings.findings_gen_instructions?.trim() || DEFAULT_FINDINGS_GEN_INSTRUCTIONS;

    const assetNames = assets
      .filter((a) => aiForm.asset_ids.includes(a.id))
      .map((a) => a.name)
      .join(', ') || 'None';

    const userMsg = [
      `Finding Title: ${aiForm.title || 'Untitled'}`,
      `Severity: ${aiForm.severity} | Status: ${aiForm.status} | Phase: ${aiForm.phase || 'N/A'}`,
      `CVSS: ${aiForm.cvss_score || 'N/A'} | Vector: ${aiForm.cvss_vector || 'N/A'}`,
      `Affected Assets: ${assetNames}`,
      `References: ${aiForm.references || 'None'}`,
      `\nTester Notes / Details:\n${aiForm.details}`,
    ].join('\n');

    setAiStreaming(true);
    setAiStreamRaw('');
    setAiGenerated(null);
    streamStickRef.current = true;

    const ac = new AbortController();
    aiAbortRef.current = ac;

    const decoder = new TextDecoder();
    let carry = '';
    let accumulated = '';

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: userMsg },
          ],
          stream: true,
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const { rest, deltas, hadError } = parseSseLines(carry);
        carry = rest;
        if (hadError) throw new Error(hadError);
        if (deltas.length) {
          accumulated += deltas.join('');
          setAiStreamRaw(accumulated);
        }
      }

      const { deltas: tail, hadError: tailErr } = parseSseLines(carry + '\n');
      if (tailErr) throw new Error(tailErr);
      if (tail.length) {
        accumulated += tail.join('');
        setAiStreamRaw(accumulated);
      }

      // Parse markdown sections from accumulated response
      const sections = parseFindingSections(accumulated);
      if (!sections.description && !sections.impact && !sections.remediation) {
        // No headers found — put everything in description
        toast('Could not find expected sections — content placed in description field', { icon: '⚠️' });
        setAiGenerated({ description: accumulated, impact: '', remediation: '' });
      } else {
        setAiGenerated(sections);
      }
    } catch (e) {
      const aborted =
        (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError');
      if (!aborted) toast.error(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      aiAbortRef.current = null;
      setAiStreaming(false);
    }
  };

  const handleAiSave = async () => {
    if (!aiForm.title.trim()) return toast.error('Title is required');
    if (aiForm.cvss_score !== '') {
      const score = parseFloat(aiForm.cvss_score);
      if (isNaN(score) || score < 0 || score > 10)
        return toast.error('CVSS score must be between 0.0 and 10.0');
    }
    const payload = {
      title: aiForm.title,
      severity: aiForm.severity,
      status: aiForm.status,
      phase: aiForm.phase,
      cvss_score: aiForm.cvss_score !== '' ? parseFloat(aiForm.cvss_score) : null,
      cvss_vector: aiForm.cvss_vector,
      asset_ids: aiForm.asset_ids,
      references: aiForm.references,
      description: aiGenerated?.description || '',
      impact: aiGenerated?.impact || '',
      remediation: aiGenerated?.remediation || '',
    };
    try {
      const { data } = await api.post(`/engagements/${id}/findings`, payload);
      toast.success('Finding created');
      closeCreate();
      navigate(`/e/${id}/findings/${data.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Shared helpers ─────────────────────────────────────────────────────────

  const closeCreate = () => {
    aiAbortRef.current?.abort();
    setShowCreate(false);
    setCreateMode(null);
    setForm(EMPTY_MANUAL_FORM);
    setAiForm(EMPTY_AI_FORM);
    setAiGenerated(null);
    setAiStreamRaw('');
    setAiStreaming(false);
    setQueuedFiles([]);
    setShowTemplates(false);
  };

  const confirmDelete = async (findingId) => {
    try {
      await api.delete(`/findings/${findingId}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Findings</h1>
        <button onClick={() => { setShowCreate(true); setCreateMode(null); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Finding
        </button>
      </div>

      {/* ── Mode picker ─────────────────────────────────────────────────────── */}
      {showCreate && createMode === null && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-1">Create Finding</h2>
          <p className="text-sm text-text-muted mb-4">How do you want to create this finding?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCreateMode('manual')}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3"
            >
              <Edit2 className="w-4 h-4" />
              <span>
                <span className="block font-medium">Manual</span>
                <span className="block text-xs text-text-muted mt-0.5">Fill all fields yourself</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('ai')}
              className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                <span className="block font-medium">AI-Assisted</span>
                <span className="block text-xs text-white/60 mt-0.5">Generate description, impact & remediation</span>
              </span>
            </button>
          </div>
          <button onClick={closeCreate} className="btn-ghost text-xs mt-3 text-text-muted">Cancel</button>
        </div>
      )}

      {/* ── Manual form ─────────────────────────────────────────────────────── */}
      {showCreate && createMode === 'manual' && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium">Create Finding</h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> Load Template
              </button>
              {showTemplates && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2"
                      onClick={() => {
                        setForm({
                          title: t.title,
                          severity: t.severity,
                          status: 'draft',
                          phase: t.phase || '',
                          description: t.description || '',
                          impact: t.impact || '',
                          remediation: t.remediation || '',
                          cvss_score: t.cvss_score != null ? String(t.cvss_score) : '',
                          cvss_vector: t.cvss_vector || '',
                        });
                        setShowTemplates(false);
                      }}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        t.severity === 'Critical' ? 'bg-sev-critical' :
                        t.severity === 'High' ? 'bg-sev-high' :
                        t.severity === 'Medium' ? 'bg-sev-medium' :
                        t.severity === 'Low' ? 'bg-sev-low' : 'bg-sev-info'
                      }`} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2"><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label className="label">Severity</label>
              <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Phase</label>
              <select className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                {PHASES.map((p) => <option key={p} value={p}>{p || 'Select...'}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">CVSS Score</label><input type="number" step="0.1" min="0" max="10" className="input" value={form.cvss_score} onChange={(e) => setForm({ ...form, cvss_score: e.target.value })} /></div>
              <div><label className="label">CVSS Vector</label><input className="input" placeholder="CVSS:3.1/AV:N/..." value={form.cvss_vector} onChange={(e) => setForm({ ...form, cvss_vector: e.target.value })} /></div>
            </div>
          </div>
          <div className="mb-4">
            <label className="label block mb-1">Description (Markdown)</label>
            <MarkdownEditor value={form.description} onChange={(v) => setForm((prev) => ({ ...prev, description: v }))} minHeight="120px" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label block mb-1">Impact</label>
              <MarkdownEditor value={form.impact} onChange={(v) => setForm((prev) => ({ ...prev, impact: v }))} minHeight="100px" />
            </div>
            <div>
              <label className="label block mb-1">Remediation</label>
              <MarkdownEditor value={form.remediation} onChange={(v) => setForm((prev) => ({ ...prev, remediation: v }))} minHeight="100px" />
            </div>
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
                  if (files.length) setQueuedFiles((prev) => [...prev, ...files]);
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
                    <button onClick={() => setQueuedFiles((prev) => prev.filter((_, i) => i !== idx))} className="text-text-muted hover:text-red-400 transition-colors shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary">Create</button>
            <button onClick={closeCreate} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* ── AI-Assisted form ─────────────────────────────────────────────────── */}
      {showCreate && createMode === 'ai' && (
        <div className="card mb-6 space-y-4">
          <div className="flex items-center">
            <h2 className="text-base font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> AI-Assisted Finding
            </h2>
          </div>

          {/* Core metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Title *</label>
              <input className="input" value={aiForm.title} onChange={(e) => setAiForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Severity</label>
              <select className="input" value={aiForm.severity} onChange={(e) => setAiForm((prev) => ({ ...prev, severity: e.target.value }))}>
                {SEVERITIES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={aiForm.status} onChange={(e) => setAiForm((prev) => ({ ...prev, status: e.target.value }))}>
                {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Phase</label>
              <select className="input" value={aiForm.phase} onChange={(e) => setAiForm((prev) => ({ ...prev, phase: e.target.value }))}>
                {PHASES.map((p) => <option key={p} value={p}>{p || 'Select...'}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">CVSS Score</label>
                <input type="number" step="0.1" min="0" max="10" className="input" value={aiForm.cvss_score} onChange={(e) => setAiForm((prev) => ({ ...prev, cvss_score: e.target.value }))} />
              </div>
              <div>
                <label className="label">CVSS Vector</label>
                <input className="input" placeholder="CVSS:3.1/AV:N/..." value={aiForm.cvss_vector} onChange={(e) => setAiForm((prev) => ({ ...prev, cvss_vector: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Affected assets */}
          <div>
            <label className="label mb-2 block">Affected Assets</label>
            <AssetPicker
              allAssets={assets}
              selected={aiForm.asset_ids}
              onChange={(ids) => setAiForm((prev) => ({ ...prev, asset_ids: ids }))}
            />
          </div>

          {/* References */}
          <div>
            <label className="label">References (one URL per line)</label>
            <textarea
              className="textarea text-xs font-mono"
              rows={2}
              placeholder="https://nvd.nist.gov/vuln/detail/CVE-..."
              value={aiForm.references}
              onChange={(e) => setAiForm((prev) => ({ ...prev, references: e.target.value }))}
            />
          </div>

          {/* Details input */}
          <div>
            <label className="label">Details</label>
            <p className="text-xs text-text-muted mb-1">Describe what you found, how you found it, any PoC steps or relevant technical context. The LLM will use this to generate the formal finding.</p>
            <textarea
              className="textarea min-h-[120px]"
              placeholder="e.g. Found SQL injection on /api/search?q= parameter. Payload: ' OR 1=1--  returned all user records. Confirmed on unauthenticated endpoint."
              value={aiForm.details}
              onChange={(e) => setAiForm((prev) => ({ ...prev, details: e.target.value }))}
            />
          </div>

          {/* Generate button */}
          {!aiStreaming && !aiGenerated && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={!aiForm.details.trim()}
                className="btn-primary flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Generate
              </button>
              <button type="button" onClick={closeCreate} className="btn-secondary">Cancel</button>
            </div>
          )}

          {/* Streaming output — rendered as markdown */}
          {(aiStreaming || (aiStreamRaw && !aiGenerated)) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label flex items-center gap-2">
                  Generating
                  {aiStreaming && <span className="inline-flex gap-1"><span className="assistant-thinking-dot" /><span className="assistant-thinking-dot" /><span className="assistant-thinking-dot" /></span>}
                </label>
                {aiStreaming && (
                  <button
                    type="button"
                    onClick={() => aiAbortRef.current?.abort()}
                    className="btn-secondary flex items-center gap-1.5 text-xs"
                  >
                    <Square className="w-3 h-3 fill-current" /> Stop
                  </button>
                )}
              </div>
              <div
                ref={streamScrollRef}
                onScroll={syncStreamStick}
                className="rounded-lg border border-border bg-input/50 p-4 overflow-auto max-h-96 [&_.markdown-body]:text-sm [&_.markdown-body]:leading-relaxed"
              >
                <MarkdownViewer content={aiStreamRaw} />
              </div>
            </div>
          )}

          {/* Generated fields — editable */}
          {aiGenerated && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary">Generated content — edit as needed</p>
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={aiStreaming}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
              </div>
              <div>
                <label className="label block mb-1">Description</label>
                <MarkdownEditor
                  value={aiGenerated.description}
                  onChange={(v) => setAiGenerated((prev) => ({ ...prev, description: v }))}
                  minHeight="120px"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label block mb-1">Impact</label>
                  <MarkdownEditor
                    value={aiGenerated.impact}
                    onChange={(v) => setAiGenerated((prev) => ({ ...prev, impact: v }))}
                    minHeight="100px"
                  />
                </div>
                <div>
                  <label className="label block mb-1">Remediation</label>
                  <MarkdownEditor
                    value={aiGenerated.remediation}
                    onChange={(v) => setAiGenerated((prev) => ({ ...prev, remediation: v }))}
                    minHeight="100px"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-border">
                <button onClick={handleAiSave} className="btn-primary">Save Finding</button>
                <button onClick={closeCreate} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 mb-4">
        <div className="flex gap-1 items-center">
          <span className="text-xs text-text-muted mr-1">Severity:</span>
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => setFilterSeverity(s)} className={`btn-ghost text-xs ${filterSeverity === s ? 'bg-accent/10 text-accent' : ''}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-xs text-text-muted mr-1">Status:</span>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`btn-ghost text-xs ${filterStatus === s ? 'bg-accent/10 text-accent' : ''}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
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
                <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{f.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}</div></td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(f.id); }}
                    className="text-text-muted hover:text-red-400 transition-colors"
                  >
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
