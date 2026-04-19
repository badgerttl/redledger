import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Settings as SettingsIcon, Sun, Moon, Download, Upload, Loader2 } from 'lucide-react';
import api from '../api/client';
import { getAssistantContextLimitTokens } from '../assistant/contextUsage';
import {
  ASSISTANT_SYSTEM_STORAGE_KEY,
  ASSISTANT_CONTEXT_LIMIT_KEY,
  DEFAULT_ASSISTANT_CONTEXT_TOKENS,
} from '../assistant/storageKeys';
import { COLOR_THEMES, applyColorTheme, applyDarkMode } from '../theme/documentTheme';
import { useEngagement } from '../context/EngagementContext';

export default function Settings() {
  const navigate = useNavigate();
  const { engagements, refresh } = useEngagement();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem('colorTheme') || 'crimson');
  const [systemPrompt, setSystemPrompt] = useState(() => localStorage.getItem(ASSISTANT_SYSTEM_STORAGE_KEY) || '');
  const [contextLimit, setContextLimit] = useState(() => String(getAssistantContextLimitTokens()));

  // Export / import state (engagement list comes from EngagementContext so Sidebar / Dashboard stay in sync)
  const [exportEngagementId, setExportEngagementId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setColorTheme(localStorage.getItem('colorTheme') || 'crimson');
    setSystemPrompt(localStorage.getItem(ASSISTANT_SYSTEM_STORAGE_KEY) || '');
    setContextLimit(String(getAssistantContextLimitTokens()));
  }, []);

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

  const saveAssistantSettings = () => {
    const v = systemPrompt.trim();
    if (v) localStorage.setItem(ASSISTANT_SYSTEM_STORAGE_KEY, systemPrompt);
    else localStorage.removeItem(ASSISTANT_SYSTEM_STORAGE_KEY);

    const n = parseInt(String(contextLimit).replace(/[\s_,]/g, ''), 10);
    if (Number.isFinite(n) && n >= 1024 && n <= 2_000_000) {
      localStorage.setItem(ASSISTANT_CONTEXT_LIMIT_KEY, String(n));
    } else {
      localStorage.removeItem(ASSISTANT_CONTEXT_LIMIT_KEY);
    }

    toast.success('Assistant settings saved');
    setContextLimit(String(getAssistantContextLimitTokens()));
  };

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
