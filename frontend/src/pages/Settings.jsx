import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { ASSISTANT_SYSTEM_STORAGE_KEY } from '../assistant/storageKeys';
import { COLOR_THEMES, applyColorTheme, applyDarkMode } from '../theme/documentTheme';

export default function Settings() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem('colorTheme') || 'crimson');
  const [systemPrompt, setSystemPrompt] = useState(() => localStorage.getItem(ASSISTANT_SYSTEM_STORAGE_KEY) || '');

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setColorTheme(localStorage.getItem('colorTheme') || 'crimson');
    setSystemPrompt(localStorage.getItem(ASSISTANT_SYSTEM_STORAGE_KEY) || '');
  }, []);

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

  const saveSystemPrompt = () => {
    const v = systemPrompt.trim();
    if (v) localStorage.setItem(ASSISTANT_SYSTEM_STORAGE_KEY, systemPrompt);
    else localStorage.removeItem(ASSISTANT_SYSTEM_STORAGE_KEY);
    toast.success(v ? 'System instructions saved' : 'System instructions cleared');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-accent" />
            Settings
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">Appearance and Assistant behavior.</p>
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
              <button type="button" onClick={saveSystemPrompt} className="btn-primary text-sm">
                Save instructions
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
