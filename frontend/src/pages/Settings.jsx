import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Settings as SettingsIcon, Sun, Moon, Download, Upload, Loader2, Pencil, Trash2, Check, X, Plus, Tag } from 'lucide-react';
import api from '../api/client';
import { DEFAULT_ASSISTANT_CONTEXT_TOKENS } from '../assistant/storageKeys';
import { COLOR_THEMES, applyColorTheme, applyDarkMode, applyFontSize } from '../theme/documentTheme';
import { useEngagement } from '../context/EngagementContext';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
  const navigate = useNavigate();
  const { engagements, refresh } = useEngagement();
  const { settings, loaded, updateSettings } = useSettings();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem('colorTheme') || 'crimson');
  const [fontSizeStep, setFontSizeStep] = useState(() => Number(localStorage.getItem('fontSizeStep') || 0));
  const [systemPrompt, setSystemPrompt] = useState('');
  const [contextLimit, setContextLimit] = useState('');
  const [findingsGenInstructions, setFindingsGenInstructions] = useState('');
  const [codeReviewInstructions, setCodeReviewInstructions] = useState('');

  // Export / import state (engagement list comes from EngagementContext so Sidebar / Dashboard stay in sync)
  const [exportEngagementId, setExportEngagementId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);

  // Sync local form state from DB settings once loaded
  useEffect(() => {
    if (!loaded) return;
    setSystemPrompt(settings.assistant_system_prompt || '');
    setContextLimit(settings.assistant_context_limit || '');
    setFindingsGenInstructions(settings.findings_gen_instructions || '');
    setCodeReviewInstructions(settings.code_review_system_prompt || '');
  }, [loaded, settings]);

  useEffect(() => {
    if (engagements.length === 0) {
      if (exportEngagementId) setExportEngagementId('');
      return;
    }
    const ids = new Set(engagements.map((e) => String(e.id)));
    if (!exportEngagementId || !ids.has(exportEngagementId)) {
      setExportEngagementId(String(engagements[0].id));
    }
  }, [engagements, exportEngagementId]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    applyDarkMode(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const pickAccent = (id) => {
    setColorTheme(id);
    applyColorTheme(id);
    localStorage.setItem('colorTheme', id);
  };

  const changeFontSize = (delta) => {
    const next = Math.max(0, Math.min(5, fontSizeStep + delta));
    setFontSizeStep(next);
    applyFontSize(next);
    localStorage.setItem('fontSizeStep', String(next));
  };

  const handleExport = async () => {
    if (!exportEngagementId) return;
    setExporting(true);
    try {
      const res = await api.get(`/engagements/${exportEngagementId}/export`, {
        responseType: 'blob',
      });
      const eng = engagements.find((e) => String(e.id) === String(exportEngagementId));
      const safeName = (eng?.name || 'engagement').replace(/[^a-z0-9_-]/gi, '_').slice(0, 50);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redledger_${safeName}_${exportEngagementId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.endsWith('.zip')) {
      toast.error('Please select a .zip export file');
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/engagements/import', fd);
      toast.success(data.message || 'Engagement imported');
      await refresh();
      setExportEngagementId(String(data.id));
      navigate(`/e/${data.id}`);
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const saveAssistantSettings = async () => {
    const n = parseInt(String(contextLimit).replace(/[\s_,]/g, ''), 10);
    const validLimit = Number.isFinite(n) && n >= 1024 && n <= 2_000_000 ? String(n) : '';
    try {
      await updateSettings({
        assistant_system_prompt: systemPrompt.trim(),
        assistant_context_limit: validLimit,
      });
      setContextLimit(validLimit);
      toast.success('Assistant settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const TAG_COLORS = ['#6366f1', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  const [tags, setTags] = useState([]);
  const [editingTagId, setEditingTagId] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showNewTag, setShowNewTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState(null);

  useEffect(() => {
    api.get('/tags').then(({ data }) => setTags(data)).catch(() => {});
  }, []);

  const startEditTag = (t) => {
    setEditingTagId(t.id);
    setEditTagName(t.name);
    setEditTagColor(t.color);
  };

  const saveEditTag = async (tagId) => {
    if (!editTagName.trim()) return;
    try {
      const { data } = await api.patch(`/tags/${tagId}`, { name: editTagName.trim(), color: editTagColor });
      setTags((prev) => prev.map((t) => t.id === tagId ? data : t));
      setEditingTagId(null);
    } catch (err) { toast.error(err.message); }
  };

  const deleteTag = async (tagId) => {
    try {
      await api.delete(`/tags/${tagId}`);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setDeletingTagId(null);
    } catch (err) { toast.error(err.message); }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const { data } = await api.post('/tags', { name: newTagName.trim(), color: newTagColor });
      setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
      setShowNewTag(false);
    } catch (err) { toast.error(err.message); }
  };

  const CODE_REVIEW_DEFAULT = `You are an offensive security researcher conducting an authorized penetration test. Analyze the provided code for security vulnerabilities from an attacker's perspective.

For each vulnerability found, provide:
1. Vulnerability type and severity (Critical / High / Medium / Low)
2. Exact location — file line number and character position (e.g. Line 42, Col 8), plus the function or method name
3. Vulnerable code block — include a fenced code block containing the specific function, method, or section where the issue was identified
4. Attack vector — how an attacker would discover and trigger this vulnerability
5. Exploitation steps — a concrete, step-by-step exploitation path including example payloads, proof-of-concept code, or curl commands where applicable
6. Impact — what an attacker achieves (RCE, auth bypass, data exfiltration, privilege escalation, etc.)
7. Chaining opportunities — how this vulnerability could be combined with others to escalate impact

Prioritize: injection flaws (SQLi, CMDi, SSTI, XXE), authentication bypasses, broken access control, insecure deserialization, SSRF, path traversal, hardcoded secrets/credentials, dangerous function calls, race conditions, and logic flaws.

Be specific and technical. Include actual exploit payloads where possible. Do not suggest remediation — focus exclusively on attack surface and exploitation.`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-accent" />
            Settings
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">Appearance, Assistant, and engagement backup.</p>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Appearance</h2>
          <div className="card space-y-6">
            <div>
              <p className="label mb-2">Color mode</p>
              <button
                type="button"
                onClick={toggleTheme}
                className="btn-secondary inline-flex items-center gap-2 text-sm"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {dark ? 'Switch to light mode' : 'Switch to dark mode'}
              </button>
            </div>
            <div>
              <p className="label mb-2">Accent color</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickAccent(t.id)}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                      colorTheme === t.id
                        ? 'border-accent bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.25)]'
                        : 'border-border bg-input/50 text-text-secondary hover:border-text-muted hover:text-text-primary',
                    )}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="label mb-2">Font size</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => changeFontSize(-1)}
                  disabled={fontSizeStep === 0}
                  className="btn-secondary h-8 w-8 p-0 text-base font-medium disabled:opacity-40"
                  title="Decrease font size"
                >−</button>
                <span className="min-w-[4rem] text-center text-sm tabular-nums text-text-secondary">
                  {fontSizeStep === 0 ? 'Default' : `+${fontSizeStep}`}
                  {fontSizeStep > 0 && <span className="ml-1 text-xs text-text-muted">({100 + fontSizeStep * 10}%)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => changeFontSize(1)}
                  disabled={fontSizeStep === 5}
                  className="btn-secondary h-8 w-8 p-0 text-base font-medium disabled:opacity-40"
                  title="Increase font size"
                >+</button>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Assistant</h2>
          <div className="card space-y-3">
            <div>
              <label htmlFor="assistant-context-limit" className="label">
                Context window (tokens)
              </label>
              <p className="mb-2 text-xs text-text-muted">
                Optional manual cap for the Assistant usage ring. Save with the field cleared to remove the override;
                then the ring uses the per-model context from your local runtime when the app can read it, otherwise{' '}
                {DEFAULT_ASSISTANT_CONTEXT_TOKENS.toLocaleString()}. Allowed range 1,024–2,000,000.
              </p>
              <input
                id="assistant-context-limit"
                type="text"
                inputMode="numeric"
                className="input max-w-xs font-mono text-sm"
                value={contextLimit}
                onChange={(e) => setContextLimit(e.target.value)}
                placeholder={String(DEFAULT_ASSISTANT_CONTEXT_TOKENS)}
              />
            </div>
            <div>
              <label htmlFor="system-prompt" className="label">
                System instructions
              </label>
              <p className="mb-2 text-xs text-text-muted">
                Sent as a <span className="font-mono">system</span> message on every chat request (not shown in the
                transcript). Leave empty for none.
              </p>
              <textarea
                id="system-prompt"
                className="textarea min-h-[160px] font-mono text-sm"
                placeholder="e.g. You are a helpful pentest note assistant. Prefer concise markdown…"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={saveAssistantSettings} className="btn-primary text-sm">
                Save assistant settings
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Finding Generation</h2>
          <div className="card space-y-3">
            <div>
              <label htmlFor="findings-gen-instructions" className="label">
                Findings Generation Instructions
              </label>
              <p className="mb-2 text-xs text-text-muted">
                System prompt sent to the local LLM when using AI-Assisted finding creation. Leave empty to use the built-in default. The LLM should respond with three markdown sections headed{' '}
                <span className="font-mono text-2xs">## Description</span>,{' '}
                <span className="font-mono text-2xs">## Impact</span>, and{' '}
                <span className="font-mono text-2xs">## Remediation</span>.
              </p>
              <textarea
                id="findings-gen-instructions"
                className="textarea min-h-[160px] font-mono text-sm"
                placeholder={`You are a professional penetration tester writing a formal security finding report.\nGiven the finding details, respond with ONLY the following markdown structure:\n\n## Description\n[Technical explanation, proof of concept]\n\n## Impact\n[Business and technical impact]\n\n## Remediation\n[Actionable remediation steps]`}
                value={findingsGenInstructions}
                onChange={(e) => setFindingsGenInstructions(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateSettings({ findings_gen_instructions: findingsGenInstructions.trim() });
                    toast.success('Finding generation settings saved');
                  } catch {
                    toast.error('Failed to save settings');
                  }
                }}
                className="btn-primary text-sm"
              >
                Save finding generation settings
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Code Review</h2>
          <div className="card space-y-3">
            <div>
              <label htmlFor="code-review-instructions" className="label">
                System Instructions
              </label>
              <p className="mb-2 text-xs text-text-muted">
                Sent as a <span className="font-mono">system</span> message on every Code Review request. Leave empty to use the built-in offensive security default.
              </p>
              <textarea
                id="code-review-instructions"
                className="textarea min-h-[200px] font-mono text-sm"
                value={codeReviewInstructions}
                onChange={(e) => setCodeReviewInstructions(e.target.value)}
                placeholder={CODE_REVIEW_DEFAULT}
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCodeReviewInstructions(CODE_REVIEW_DEFAULT)}
                className="btn-ghost text-xs text-text-muted"
              >
                Reset to default
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateSettings({ code_review_system_prompt: codeReviewInstructions.trim() });
                    toast.success('Code review settings saved');
                  } catch {
                    toast.error('Failed to save settings');
                  }
                }}
                className="btn-primary text-sm"
              >
                Save code review settings
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Tags</h2>
          <div className="card">
            {tags.length === 0 && !showNewTag && (
              <p className="text-sm text-text-muted mb-3">No tags yet.</p>
            )}

            {tags.length > 0 && (
              <div className="divide-y divide-border mb-3">
                {tags.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    {editingTagId === t.id ? (
                      <>
                        {/* Color swatches */}
                        <div className="flex gap-1.5 shrink-0">
                          {TAG_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditTagColor(c)}
                              className="w-4 h-4 rounded-full transition-transform hover:scale-110 shrink-0"
                              style={{
                                backgroundColor: c,
                                outline: editTagColor === c ? `2px solid ${c}` : 'none',
                                outlineOffset: '2px',
                              }}
                            />
                          ))}
                        </div>
                        <input
                          className="input text-sm flex-1"
                          value={editTagName}
                          autoFocus
                          onChange={(e) => setEditTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditTag(t.id);
                            if (e.key === 'Escape') setEditingTagId(null);
                          }}
                        />
                        <button onClick={() => saveEditTag(t.id)} className="text-green-500 hover:text-green-400 transition-colors" title="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingTagId(null)} className="text-text-muted hover:text-text-primary transition-colors" title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : deletingTagId === t.id ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="text-sm text-text-primary flex-1">Delete <strong>{t.name}</strong>? Removes from all assets and findings.</span>
                        <button onClick={() => deleteTag(t.id)} className="btn-ghost text-xs text-red-400 hover:text-red-300">Delete</button>
                        <button onClick={() => setDeletingTagId(null)} className="btn-ghost text-xs text-text-muted">Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="text-sm text-text-primary flex-1">{t.name}</span>
                        <button onClick={() => startEditTag(t)} className="text-text-muted hover:text-accent transition-colors p-1" title="Rename">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeletingTagId(t.id)} className="text-text-muted hover:text-red-400 transition-colors p-1" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showNewTag ? (
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-input border border-border">
                <div className="flex gap-1.5 flex-wrap">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110 shrink-0"
                      style={{
                        backgroundColor: c,
                        outline: newTagColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
                <input
                  className="input text-sm"
                  placeholder="Tag name…"
                  value={newTagName}
                  autoFocus
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createTag();
                    if (e.key === 'Escape') { setShowNewTag(false); setNewTagName(''); }
                  }}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={createTag} disabled={!newTagName.trim()} className="btn-primary text-xs flex-1">
                    Create tag
                  </button>
                  <button type="button" onClick={() => { setShowNewTag(false); setNewTagName(''); }} className="btn-ghost text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewTag(true)}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New tag
              </button>
            )}
          </div>
        </section>

        {/* Export / import — bottom of page */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Engagement backup</h2>
          <div className="card space-y-6">
            <div>
              <p className="label mb-1">Export engagement</p>
              <p className="mb-3 text-xs text-text-muted">
                Downloads a <span className="font-mono">.zip</span> containing all engagement data — scope, assets, notes, findings, credentials, tool output, checklists, activity log, evidence attachments, saved report files under <span className="font-mono">data/reports/</span>, and a JSON manifest.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label className="label mb-1" htmlFor="export-engagement">Engagement</label>
                  <select
                    id="export-engagement"
                    className="input"
                    value={exportEngagementId}
                    onChange={(e) => setExportEngagementId(e.target.value)}
                    disabled={engagements.length === 0}
                  >
                    {engagements.length === 0
                      ? <option value="">No engagements</option>
                      : engagements.map((e) => (
                        <option key={e.id} value={String(e.id)}>{e.name}</option>
                      ))
                    }
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting || !exportEngagementId}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {exporting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Download className="w-4 h-4" />
                  }
                  {exporting ? 'Exporting…' : 'Export'}
                </button>
              </div>
            </div>

            <div className="border-t border-border" />

            <div>
              <p className="label mb-1">Import engagement</p>
              <p className="mb-3 text-xs text-text-muted">
                Restores an engagement from a previously exported <span className="font-mono">.zip</span>. All data is imported as a new engagement — existing engagements are not modified. Tags are merged by name.
              </p>
              <input
                ref={importInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {importing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />
                }
                {importing ? 'Importing…' : 'Select .zip to import'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
