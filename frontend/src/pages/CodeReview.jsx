import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { Highlight, themes as prismThemes } from 'prism-react-renderer';
import { useParams } from 'react-router-dom';
import clsx from 'clsx';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useSettings } from '../context/SettingsContext';
import { useCodeReviewScan } from '../context/CodeReviewScanContext';
import MarkdownViewer from '../components/MarkdownViewer';
import {
  ScanLine, ChevronDown, ChevronRight, FolderOpen, FileCode2,
  RefreshCw, Square, Save, CheckCircle2, XCircle, Loader2, Upload,
  Trash2, StickyNote, X, FolderUp, Code, SunMoon, Ban,
} from 'lucide-react';

const SEMGREP_SEV = {
  ERROR:   { label: 'Error',   cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  WARNING: { label: 'Warning', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  INFO:    { label: 'Info',    cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

function semgrepSevCls(sev) {
  return SEMGREP_SEV[sev?.toUpperCase()]?.cls ?? SEMGREP_SEV.INFO.cls;
}

function SecretScanTab({ engagementId, toolName }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const isDark = document.documentElement.classList.contains('dark');
  const theme = isDark ? prismThemes.nightOwl : prismThemes.github;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/engagements/${engagementId}/tool-output`);
      setEntries(data.filter((o) => o.tool_name === toolName));
    } catch { toast.error('Could not load results'); }
    finally { setLoading(false); }
  }, [engagementId, toolName]);

  useEffect(() => { load(); }, [load]);

  const deleteEntry = async (id) => {
    try {
      await api.delete(`/tool-output/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch { toast.error('Delete failed'); }
  };

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) return (
    <div className="flex items-center gap-2 py-8 text-text-muted text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );

  if (entries.length === 0) return (
    <div className="text-center py-12 text-text-muted text-sm">
      No {toolName} results yet — import from Tool Output → Add Output → {toolName}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">{entries.length} upload{entries.length !== 1 ? 's' : ''}</span>
        <button onClick={load} className="btn-ghost flex items-center gap-1.5 text-xs text-text-muted">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>
      {entries.map((e) => (
        <div key={e.id} className="card overflow-hidden p-0">
          <div
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-input/40 transition-colors"
            onClick={() => toggle(e.id)}
          >
            {expanded[e.id]
              ? <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
              : <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />}
            <span className="flex-1 text-sm text-text-secondary">
              {new Date(e.created_at).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={(ev) => { ev.stopPropagation(); deleteEntry(e.id); }}
              className="shrink-0 rounded-lg p-1 text-text-muted hover:bg-input hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {expanded[e.id] && (
            <div className="border-t border-border overflow-auto max-h-[70vh]">
              <Highlight theme={theme} code={e.content || ''} language="json">
                {({ style, tokens, getLineProps, getTokenProps }) => {
                  const lineNumWidth = String(tokens.length).length;
                  const lineNumColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)';
                  const gutterBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
                  return (
                    <pre
                      className="min-h-full font-mono text-xs leading-relaxed"
                      style={{ ...style, margin: 0, background: 'transparent', padding: 0 }}
                    >
                      {tokens.map((line, i) => {
                        const lineProps = getLineProps({ line });
                        return (
                          <div key={i} {...lineProps} style={{ ...lineProps.style, display: 'flex' }}>
                            <span style={{
                              minWidth: `${lineNumWidth + 1}ch`,
                              paddingRight: '1rem', paddingLeft: '1rem',
                              textAlign: 'right', color: lineNumColor,
                              borderRight: `1px solid ${gutterBorder}`,
                              userSelect: 'none', flexShrink: 0,
                            }}>
                              {i + 1}
                            </span>
                            <span style={{ paddingLeft: '1rem', paddingRight: '1rem', flex: 1 }}>
                              {line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}
                            </span>
                          </div>
                        );
                      })}
                    </pre>
                  );
                }}
              </Highlight>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const SGFILTER_KEYS = ['vulnerability_class', 'likelihood', 'impact', 'confidence'];

function SemgrepTab({ engagementId }) {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('vuln_class'); // 'file' | 'vuln_class'
  const [expanded, setExpanded] = useState({}); // empty = all collapsed
  const [filters, setFilters] = useState({ vulnerability_class: '', likelihood: '', impact: '', confidence: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/engagements/${engagementId}/semgrep`);
      setFindings(data);
    } catch { toast.error('Could not load Semgrep results'); }
    finally { setLoading(false); }
  }, [engagementId]);

  useEffect(() => { load(); }, [load]);

  const deleteFinding = async (id) => {
    try {
      await api.delete(`/semgrep/${id}`);
      setFindings((prev) => prev.filter((f) => f.id !== id));
    } catch { toast.error('Delete failed'); }
  };

  const clearAll = async () => {
    try {
      await api.delete(`/engagements/${engagementId}/semgrep`);
      setFindings([]);
    } catch { toast.error('Clear failed'); }
  };

  const toggleGroup = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const setFilter = (key, val) => setFilters((prev) => ({ ...prev, [key]: val }));

  // Unique option values per filter key
  const filterOptions = useMemo(() => {
    const opts = {};
    for (const key of SGFILTER_KEYS) {
      const vals = new Set();
      for (const f of findings) {
        if (f[key]) vals.add(f[key]);
      }
      opts[key] = [...vals].sort();
    }
    return opts;
  }, [findings]);

  // Apply AND filters
  const filtered = useMemo(() => findings.filter((f) =>
    SGFILTER_KEYS.every((key) => !filters[key] || f[key] === filters[key])
  ), [findings, filters]);

  const SEV_RANK = { ERROR: 0, WARNING: 1, INFO: 2 };
  const groupSevRank = (items) =>
    Math.min(...items.map((f) => SEV_RANK[(f.severity || '').toUpperCase()] ?? 99));

  // Group filtered findings
  const grouped = useMemo(() => {
    const map = new Map();
    for (const f of filtered) {
      const key = groupBy === 'file'
        ? (f.path || '(unknown)')
        : (f.vulnerability_class || '(unclassified)');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return [...map.entries()].sort(([, aItems], [, bItems]) => {
      const rankDiff = groupSevRank(aItems) - groupSevRank(bItems);
      if (rankDiff !== 0) return rankDiff; // highest sev first
      return bItems.length - aItems.length; // more findings first
    });
  }, [filtered, groupBy]);

  const activeFilterCount = SGFILTER_KEYS.filter((k) => filters[k]).length;

  if (loading) return (
    <div className="flex items-center gap-2 py-8 text-text-muted text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading Semgrep results…
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-muted">
            {filtered.length}{filtered.length !== findings.length ? ` of ${findings.length}` : ''} finding{findings.length !== 1 ? 's' : ''}
          </span>
          <div className="flex rounded-xl border border-border overflow-hidden">
            {[['file', 'File'], ['vuln_class', 'Vuln Class']].map(([g, label]) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  groupBy === g ? 'bg-accent text-white' : 'text-text-muted hover:bg-input',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost flex items-center gap-1.5 text-xs text-text-muted">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          {findings.length > 0 && (
            <button onClick={clearAll} className="btn-ghost text-xs text-red-400 hover:text-red-300">
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap gap-2 items-center">
        {SGFILTER_KEYS.map((key) => (
          <div key={key} className="flex flex-col gap-0.5">
            <label className="text-2xs text-text-muted uppercase tracking-wide px-0.5">
              {key.replace('_', ' ')}
            </label>
            <select
              className="input py-1 text-xs pr-7 min-w-[140px]"
              value={filters[key]}
              onChange={(e) => setFilter(key, e.target.value)}
            >
              <option value="">All</option>
              {filterOptions[key].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        ))}
        {activeFilterCount > 0 && (
          <button
            onClick={() => setFilters({ vulnerability_class: '', likelihood: '', impact: '', confidence: '' })}
            className="btn-ghost text-xs text-text-muted self-end mb-0.5"
          >
            Clear filters
          </button>
        )}
      </div>

      {grouped.length === 0 && (
        <div className="text-center py-12 text-text-muted text-sm">
          {findings.length === 0
            ? 'No Semgrep results yet — import from Tool Output → Add Output → Semgrep'
            : 'No results match current filters'}
        </div>
      )}

      {grouped.map(([groupKey, items]) => {
        const isExpanded = !!expanded[groupKey];
        const sevCounts = items.reduce((acc, f) => {
          const s = (f.severity || '').toUpperCase();
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});
        // Sort sev badges by rank
        const sortedSevs = Object.entries(sevCounts).sort(
          ([a], [b]) => (SEV_RANK[a] ?? 99) - (SEV_RANK[b] ?? 99)
        );
        return (
          <div key={groupKey} className="card overflow-hidden p-0">
            <button
              type="button"
              onClick={() => toggleGroup(groupKey)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-input/40 transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                : <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />}
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-secondary">{groupKey}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {sortedSevs.map(([sev, count]) => (
                  <span key={sev} className={`rounded border px-1.5 py-0.5 text-2xs font-medium uppercase ${semgrepSevCls(sev)}`}>
                    {sev} {count}
                  </span>
                ))}
                <span className="text-xs text-text-muted ml-1">{items.length} finding{items.length !== 1 ? 's' : ''}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="divide-y divide-border border-t border-border">
                {items.map((f) => (
                  <div key={f.id} className="px-4 py-3 flex gap-3 group">
                    <div className="shrink-0 pt-0.5">
                      <span className={`rounded border px-1.5 py-0.5 text-2xs font-medium uppercase ${semgrepSevCls(f.severity)}`}>
                        {f.severity || 'INFO'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <span className="block text-sm text-text-primary">{f.message}</span>

                      {/* Location + rule */}
                      <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                        {groupBy === 'vuln_class' && f.path && <span className="font-mono">{f.path}</span>}
                        {groupBy === 'file' && f.check_id && <span className="font-mono text-accent/70">{f.check_id}</span>}
                        {f.line > 0 && <span>line {f.line}{f.col > 0 ? `:${f.col}` : ''}</span>}
                      </div>

                      {/* Metadata badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {f.vulnerability_class && (
                          <span className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-2xs text-purple-400">
                            {f.vulnerability_class}
                          </span>
                        )}
                        {f.likelihood && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-2xs text-text-muted">
                            Likelihood: {f.likelihood}
                          </span>
                        )}
                        {f.impact && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-2xs text-text-muted">
                            Impact: {f.impact}
                          </span>
                        )}
                        {f.confidence && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-2xs text-text-muted">
                            Confidence: {f.confidence}
                          </span>
                        )}
                        {f.technology && (
                          <span className="rounded border border-border px-1.5 py-0.5 text-2xs text-text-muted">
                            {f.technology}
                          </span>
                        )}
                      </div>

                      {/* CWE / OWASP */}
                      {(f.cwe || f.owasp) && (
                        <div className="flex flex-wrap gap-2 text-2xs text-text-muted">
                          {f.cwe && <span>{f.cwe}</span>}
                          {f.owasp && <span>{f.owasp}</span>}
                        </div>
                      )}

                      {/* Code snippet */}
                      {f.lines && (
                        <pre className="mt-1 rounded-lg bg-input px-3 py-2 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap">
                          {f.lines}
                        </pre>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteFinding(f.id)}
                      className="shrink-0 self-start rounded-lg p-1 text-text-muted opacity-0 group-hover:opacity-100 transition-all hover:bg-input hover:text-red-500"
                      title="Delete finding"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const REVIEW_MODEL_KEY = 'code_review_model';

const SEVERITY_STYLES = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

function parseSeverities(content) {
  if (!content) return [];
  const found = new Set();
  const re = /severity\s*:[\s\W]*(critical|high|medium|moderate|low|info|informational)/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    const v = m[1].toLowerCase();
    found.add(v === 'moderate' || v === 'informational' ? (v === 'moderate' ? 'medium' : 'info') : v);
  }
  return ['critical', 'high', 'medium', 'low', 'info'].filter((s) => found.has(s));
}

function fuzzyMatch(text, query) {
  if (!query.trim()) return true;
  const t = text.toLowerCase();
  return query.toLowerCase().split(/\s+/).every((w) => t.includes(w));
}

function FileStatusIcon({ status }) {
  if (status === 'scanning') return <Loader2 className="h-4 w-4 animate-spin text-accent" />;
  if (status === 'done' || status === 'saved') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
  return <FileCode2 className="h-4 w-4 text-text-muted" />;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function buildMarkdown(results) {
  const lines = ['# Code Review Results', '', `**Date:** ${new Date().toLocaleString()}`, '', '---', ''];
  for (const r of results) {
    lines.push(`## ${r.filename}`, '');
    lines.push(r.content || '*No output.*', '');
    lines.push('---', '');
  }
  return lines.join('\n');
}

// Only bundled langs in prism-react-renderer; unmapped exts fall back to 'plain'
const EXT_LANG = {
  py: 'python', js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  java: 'clike', go: 'go', rs: 'rust', rb: 'clike', php: 'clike',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'clike',
  swift: 'swift', kt: 'kotlin', sh: 'plain', bash: 'plain', ps1: 'plain',
  yaml: 'yaml', yml: 'yaml', json: 'json', xml: 'markup', html: 'markup',
  css: 'css', sql: 'sql', tf: 'plain', hcl: 'plain',
};

function detectLang(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return EXT_LANG[ext] || 'plain';
}

function SourceModal({ filename, content, onClose }) {
  const [query, setQuery] = useState('');
  const [matchIdx, setMatchIdx] = useState(0);
  const [inverted, setInverted] = useState(() => !document.documentElement.classList.contains('dark'));
  const lineRefs = useRef([]);
  const inputRef = useRef(null);
  const lang = useMemo(() => detectLang(filename), [filename]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setMatchIdx(0); }, [query]);

  const matchingLineIdxs = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return content.split('\n')
      .map((line, i) => line.toLowerCase().includes(q) ? i : -1)
      .filter((i) => i >= 0);
  }, [content, query]);

  const matchCount = matchingLineIdxs.length;

  useLayoutEffect(() => {
    const lineIdx = matchingLineIdxs[matchIdx];
    if (lineIdx != null) lineRefs.current[lineIdx]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [matchIdx, matchingLineIdxs]);

  const next = () => setMatchIdx((i) => (i + 1) % Math.max(matchCount, 1));
  const prev = () => setMatchIdx((i) => (i - 1 + Math.max(matchCount, 1)) % Math.max(matchCount, 1));

  const handleKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prev() : next(); }
    if (e.key === 'Escape') { if (query) setQuery(''); else onClose(); }
  };

  const theme = inverted ? prismThemes.github : prismThemes.nightOwl;
  const border = inverted ? 'border-black/10' : 'border-white/10';
  const textMuted = inverted ? 'text-gray-400' : 'text-white/40';
  const textFile = inverted ? 'text-gray-600' : 'text-white/70';
  const inputCls = inverted
    ? 'bg-black/8 text-gray-900 placeholder-gray-400 focus:ring-black/20'
    : 'bg-white/10 text-white placeholder-white/30 focus:ring-white/30';
  const btnCls = inverted ? 'text-gray-400 hover:text-gray-900' : 'text-white/40 hover:text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className={`flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${border}`}
        style={{ backgroundColor: theme.plain.backgroundColor }}
      >
        <div className={`flex items-center gap-3 border-b px-5 py-3 ${border}`}>
          <span className={`min-w-0 flex-1 truncate font-mono text-sm ${textFile}`}>{filename}</span>
          <div className="flex shrink-0 items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search lines… (Enter / ⇧Enter)"
              className={`w-52 rounded px-2 py-1 text-xs outline-none focus:ring-1 ${inputCls}`}
            />
            {query && (
              <>
                <span className={`text-xs tabular-nums ${textMuted}`}>
                  {matchCount > 0 ? `${matchIdx + 1} / ${matchCount} lines` : 'no matches'}
                </span>
                <button type="button" onClick={prev} className={`rounded px-1 text-xs ${btnCls}`} title="Previous (⇧Enter)">↑</button>
                <button type="button" onClick={next} className={`rounded px-1 text-xs ${btnCls}`} title="Next (Enter)">↓</button>
              </>
            )}
          </div>
          <button type="button" onClick={() => setInverted((v) => !v)} className={`shrink-0 transition-colors ${btnCls}`} title="Toggle light/dark">
            <SunMoon className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className={`shrink-0 transition-colors ${btnCls}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <Highlight theme={theme} code={content} language={lang}>
            {({ style, tokens, getLineProps, getTokenProps }) => {
              const lineNumWidth = String(tokens.length).length;
              const lineNumColor = inverted ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)';
              const gutterBorder = inverted ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
              return (
              <pre
                className="min-h-full font-mono text-xs leading-relaxed"
                style={{ ...style, margin: 0, background: 'transparent', padding: 0 }}
              >
                {tokens.map((line, i) => {
                  const isMatch = query.trim() && matchingLineIdxs.includes(i);
                  const isCurrent = isMatch && matchingLineIdxs[matchIdx] === i;
                  const lineProps = getLineProps({ line });
                  return (
                    <div
                      key={i}
                      ref={(el) => { lineRefs.current[i] = el; }}
                      {...lineProps}
                      style={{
                        ...lineProps.style,
                        display: 'flex',
                        backgroundColor: isCurrent
                          ? 'rgba(250,204,21,0.35)'
                          : isMatch
                          ? 'rgba(250,204,21,0.12)'
                          : undefined,
                      }}
                    >
                      <span
                        style={{
                          minWidth: `${lineNumWidth + 1}ch`,
                          paddingRight: '1.25rem',
                          paddingLeft: '1.25rem',
                          textAlign: 'right',
                          color: lineNumColor,
                          borderRight: `1px solid ${gutterBorder}`,
                          userSelect: 'none',
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem', flex: 1 }}>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </span>
                    </div>
                  );
                })}
              </pre>
              );
            }}
          </Highlight>
        </div>
      </div>
    </div>
  );
}

function AddToNoteModal({ result, engagementId, onClose }) {
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/engagements/${engagementId}/assets`)
      .then(({ data }) => {
        setAssets(data);
        if (data.length > 0) setAssetId(String(data[0].id));
      })
      .catch(() => toast.error('Could not load assets'));
  }, [engagementId]);

  const handleSave = async () => {
    if (!assetId) return;
    setSaving(true);
    try {
      const body = `# Code Review: ${result.filename}\n\n${result.content}`;
      await api.post(`/assets/${assetId}/notes`, { body });
      toast.success('Added to asset note');
      onClose();
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">Add to Asset Note</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-text-muted">
            Results for <span className="font-mono text-xs text-text-secondary">{result.filename}</span> will be appended as a new note on the selected asset.
          </p>
          <div>
            <label className="label">Asset</label>
            {assets.length === 0 ? (
              <p className="text-sm text-text-muted">No assets in this engagement.</p>
            ) : (
              <select className="input" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                {assets.map((a) => (
                  <option key={a.id} value={String(a.id)}>{a.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || assets.length === 0}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />}
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}


const JOB_FILE_STATUS_ICON = {
  pending:   <Loader2 className="h-3.5 w-3.5 text-text-muted" />,
  running:   <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />,
  done:      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  error:     <XCircle className="h-3.5 w-3.5 text-red-500" />,
  cancelled: <Ban className="h-3.5 w-3.5 text-text-muted" />,
};

export default function CodeReview() {
  const { id: engagementId } = useParams();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState('review');

  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() => localStorage.getItem(REVIEW_MODEL_KEY) || '');
  const [modelsLoading, setModelsLoading] = useState(true);

  const [mode, setMode] = useState('single_file');

  // Single file mode
  const [filename, setFilename] = useState('');
  const [fileCode, setFileCode] = useState('');
  const fileInputRef = useRef(null);

  // Directory mode
  const [scanDirs, setScanDirs] = useState([]);
  const [scanDirsLoading, setScanDirsLoading] = useState(false);
  const [selectedScanDir, setSelectedScanDir] = useState('');
  const [fileList, setFileList] = useState([]);
  const [selected, setSelected] = useState({});
  const [listLoading, setListLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [fileFilter, setFileFilter] = useState('');
  const uploadDirInputRef = useRef(null);

  const {
    results, setResults,
    scanning, setScanning,
    scanEngagementId, setScanEngagementId,
    resultsEngagementId, setResultsEngagementId,
    activeJobId, setActiveJobId,
    jobFiles, setJobFiles,
    seenResultIds,
  } = useCodeReviewScan();

  const [noteModal, setNoteModal] = useState(null);
  const [resultFilter, setResultFilter] = useState('');
  const [sourceModal, setSourceModal] = useState(null);

  // ── Models ────────────────────────────────────────────────────────────────

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const { data } = await api.get('/assistant/models');
      const list = data?.data ?? [];
      setModels(list);
      const ids = list.map((m) => m.id).filter(Boolean);
      setModel((prev) => {
        if (prev && ids.includes(prev)) return prev;
        const first = ids[0] || '';
        if (first) localStorage.setItem(REVIEW_MODEL_KEY, first);
        return first;
      });
    } catch {
      setModels([]);
      toast.error('Could not load models');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  // ── Scan directories ──────────────────────────────────────────────────────

  const loadScanDirs = useCallback(async () => {
    setScanDirsLoading(true);
    try {
      const { data } = await api.get('/code-scanner/scan-directories');
      setScanDirs(data);
      if (data.length > 0) {
        setSelectedScanDir((prev) => {
          const found = data.find((d) => d.name === prev);
          return found ? prev : data[0].name;
        });
      } else {
        setSelectedScanDir('');
      }
    } catch {
      setScanDirs([]);
    } finally {
      setScanDirsLoading(false);
    }
  }, []);

  useEffect(() => { loadScanDirs(); }, [loadScanDirs]);

  useEffect(() => {
    if (mode === 'directory') loadScanDirs();
  }, [mode, loadScanDirs]);

  useEffect(() => {
    if (mode !== 'directory' || !selectedScanDir) return;
    const dir = scanDirs.find((d) => d.name === selectedScanDir);
    if (dir) listFilesFor(dir.path);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScanDir, scanDirs]);

  // Patch sourcePath onto results loaded from DB once scanDirs known
  useEffect(() => {
    if (!scanDirs.length) return;
    setResults((prev) => prev.map((r) => {
      if (r.sourcePath || r.sourceContent) return r;
      const parts = r.filename.split('/');
      if (parts.length < 2) return r;
      const dir = scanDirs.find((d) => d.name === parts[0]);
      if (!dir) return r;
      return { ...r, sourcePath: `${dir.path}/${parts.slice(1).join('/')}` };
    }));
  }, [scanDirs, setResults]);

  // ── DB results load ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!engagementId) return;
    if (resultsEngagementId === engagementId) return;
    api.get(`/code-scanner/results/${engagementId}`)
      .then(({ data }) => {
        setResults(data.map((r) => ({
          key: `db-${r.id}`,
          id: r.id,
          filename: r.filename,
          content: r.content,
          status: 'saved',
          expanded: false,
          createdAt: r.created_at,
        })));
        setResultsEngagementId(engagementId);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  // ── Reconnect to active job after page refresh ────────────────────────────

  useEffect(() => {
    if (!engagementId || activeJobId || scanning) return;
    api.get(`/code-scanner/active-job/${engagementId}`)
      .then(({ data }) => {
        if (data && data.id) {
          setActiveJobId(data.id);
          setJobFiles(data.files || []);
          setScanning(true);
          setScanEngagementId(engagementId);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  // ── Poll active job ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeJobId || !scanning) return;

    const poll = async () => {
      try {
        const { data: job } = await api.get(`/code-scanner/jobs/${activeJobId}`);
        setJobFiles(job.files || []);

        for (const f of (job.files || [])) {
          if (f.status === 'done' && f.result_id != null && f.result_content != null) {
            if (!seenResultIds.current.has(f.result_id)) {
              seenResultIds.current.add(f.result_id);
              setResults((prev) => {
                if (prev.some((r) => r.id === f.result_id)) return prev;
                return [{
                  key: `job-${f.result_id}`,
                  id: f.result_id,
                  filename: f.filename,
                  content: f.result_content,
                  sourcePath: null,
                  sourceContent: null,
                  status: 'saved',
                  expanded: true,
                  createdAt: null,
                }, ...prev];
              });
            }
          }
        }

        if (job.status === 'done' || job.status === 'cancelled' || job.status === 'error') {
          setScanning(false);
          setActiveJobId(null);
          setJobFiles([]);
          setResultsEngagementId(engagementId);
        }
      } catch (e) {
        console.error('Job poll error', e);
      }
    };

    const timerId = setInterval(poll, 2000);
    poll();
    return () => clearInterval(timerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, scanning]);

  // ── Single file browse ────────────────────────────────────────────────────

  const persistModel = (id) => {
    setModel(id);
    if (id) localStorage.setItem(REVIEW_MODEL_KEY, id);
  };

  const handleFileBrowse = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setFileCode(ev.target.result || '');
    reader.onerror = () => toast.error('Could not read file');
    reader.readAsText(file);
  };

  // ── Directory upload ──────────────────────────────────────────────────────

  const handleDirUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const formData = new FormData();
    const paths = [];
    for (const file of files) {
      formData.append('files', file);
      paths.push(file.webkitRelativePath || file.name);
    }
    formData.append('paths_json', JSON.stringify(paths));

    setUploadProgress(0);
    try {
      const { data } = await api.post('/code-scanner/upload-directory', formData, {
        onUploadProgress: (ev) => {
          if (ev.total) setUploadProgress(Math.round((ev.loaded * 100) / ev.total));
        },
      });
      toast.success(`Uploaded ${data.uploaded} files to "${data.folder}"`);
      await loadScanDirs();
      setSelectedScanDir(data.folder);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadProgress(null);
    }
  };

  // ── Directory file listing ────────────────────────────────────────────────

  const listFilesFor = async (path) => {
    if (!path) return;
    setListLoading(true);
    setFileList([]);
    setSelected({});
    try {
      const { data } = await api.post('/code-scanner/list-files', { path });
      setFileList(data.files);
      const sel = {};
      data.files.forEach((f) => { sel[f.path] = !f.skippable; });
      setSelected(sel);
      if (data.files.length === 0) toast('No scannable files found');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message);
    } finally {
      setListLoading(false);
    }
  };

  const handleDirSelect = (name) => { setSelectedScanDir(name); };

  const deleteScanDir = async (name) => {
    try {
      await api.delete(`/code-scanner/scan-directory/${encodeURIComponent(name)}`);
      toast.success(`Deleted "${name}"`);
      setFileList([]);
      setSelected({});
      await loadScanDirs();
    } catch {
      toast.error('Failed to delete directory');
    }
  };

  const filteredFileList = fileFilter.trim()
    ? fileList.filter((f) => fuzzyMatch(f.relative_path, fileFilter))
    : fileList;

  const toggleFile = (path) => setSelected((prev) => ({ ...prev, [path]: !prev[path] }));
  const toggleAll = () => {
    const anyOn = filteredFileList.some((f) => selected[f.path]);
    setSelected((prev) => {
      const next = { ...prev };
      filteredFileList.forEach((f) => { next[f.path] = !anyOn && !f.skippable; });
      return next;
    });
  };

  // ── Scan (job-based) ──────────────────────────────────────────────────────

  const runScan = async () => {
    if (!model) { toast.error('Select a model first'); return; }
    if (mode === 'single_file' && !fileCode.trim()) { toast.error('Load or paste code first'); return; }
    const selectedFiles = filteredFileList.filter((f) => selected[f.path]);
    if (mode === 'directory' && selectedFiles.length === 0) {
      toast.error('Select at least one file'); return;
    }

    const files = mode === 'single_file'
      ? [{ filename: filename || 'file', inline_content: fileCode }]
      : selectedFiles.map((f) => ({
          filename: `${selectedScanDir}/${f.relative_path || f.path}`,
          file_path: f.path,
        }));

    try {
      const { data: job } = await api.post('/code-scanner/jobs', {
        engagement_id: parseInt(engagementId),
        model,
        system_prompt: settings.code_review_system_prompt || '',
        files,
      });
      seenResultIds.current.clear();
      setJobFiles(job.files || []);
      setActiveJobId(job.id);
      setScanning(true);
      setScanEngagementId(engagementId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start scan');
    }
  };

  const stopScan = async () => {
    if (!activeJobId) return;
    try { await api.delete(`/code-scanner/jobs/${activeJobId}`); } catch { /* ignore */ }
    setScanning(false);
    setActiveJobId(null);
    setJobFiles([]);
  };

  const cancelJobFile = async (fileId) => {
    if (!activeJobId) return;
    try {
      await api.delete(`/code-scanner/jobs/${activeJobId}/files/${fileId}`);
      setJobFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, status: 'cancelled' } : f));
    } catch { toast.error('Could not cancel file'); }
  };

  // ── Re-scan a single result ───────────────────────────────────────────────

  const reprocessResult = async (result) => {
    if (scanning) return;
    let inlineContent = result.sourceContent || null;
    if (!inlineContent && result.sourcePath) {
      try {
        const { data } = await api.post('/code-scanner/read-file', { path: result.sourcePath });
        inlineContent = data.content;
      } catch {
        toast.error('Could not read source file');
        return;
      }
    }
    if (!inlineContent) { toast.error('No source content available to re-scan'); return; }

    try {
      const { data: job } = await api.post('/code-scanner/jobs', {
        engagement_id: parseInt(engagementId),
        model,
        system_prompt: settings.code_review_system_prompt || '',
        files: [{ filename: result.filename, inline_content: inlineContent }],
      });
      seenResultIds.current.clear();
      setJobFiles(job.files || []);
      setActiveJobId(job.id);
      setScanning(true);
      setScanEngagementId(engagementId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start re-scan');
    }
  };

  const openSource = async (result) => {
    if (result.sourceContent) {
      setSourceModal({ filename: result.filename, content: result.sourceContent });
      return;
    }
    if (result.sourcePath) {
      try {
        const { data } = await api.post('/code-scanner/read-file', { path: result.sourcePath });
        setSourceModal({ filename: result.filename, content: data.content });
      } catch {
        toast.error('Could not read source file');
      }
      return;
    }
    toast.error('Source file not available for this result');
  };

  const deleteResult = async (result) => {
    if (result.id) {
      try {
        await api.delete(`/code-scanner/results/${result.id}`);
      } catch {
        toast.error('Failed to delete');
        return;
      }
    }
    setResults((prev) => prev.filter((r) => r.key !== result.key));
  };

  const saveMarkdown = (onlyFindings = false) => {
    const toExport = results.filter((r) => {
      if (!r.content) return false;
      if (onlyFindings) return parseSeverities(r.content).length > 0;
      return true;
    });
    if (toExport.length === 0) { toast('No results to export'); return; }
    const md = buildMarkdown(toExport);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-review-${onlyFindings ? 'findings-' : ''}${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllResults = async () => {
    const savedIds = results.filter((r) => r.id).map((r) => r.id);
    try {
      await Promise.all(savedIds.map((id) => api.delete(`/code-scanner/results/${id}`)));
    } catch {
      toast.error('Some results could not be deleted from DB');
    }
    setResults([]);
    setResultsEngagementId(null);
  };

  const toggleExpand = (key) => {
    setResults((prev) => prev.map((r) => r.key === key ? { ...r, expanded: !r.expanded } : r));
  };

  const selectedCount = filteredFileList.filter((f) => selected[f.path]).length;
  const doneResults = results.filter((r) => r.content);
  const filteredResults = results.filter((r) =>
    fuzzyMatch(`${r.filename} ${r.content}`, resultFilter)
  );

  // Job progress summary
  const jobTotal = jobFiles.length;
  const jobDone = jobFiles.filter((f) => f.status === 'done' || f.status === 'cancelled' || f.status === 'error').length;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-accent" />
            Code Review
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Analyze code for vulnerabilities and exploitation paths using your local LLM.
          </p>
        </div>
        {doneResults.length > 0 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => saveMarkdown(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <Save className="h-4 w-4" />
              Save Findings
            </button>
            <button type="button" onClick={() => saveMarkdown(false)} className="btn-secondary flex items-center gap-2 text-sm">
              <Save className="h-4 w-4" />
              Save All
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'review',       label: 'LLM Review' },
          { id: 'semgrep',      label: 'Semgrep' },
          { id: 'noseyparker',  label: 'Noseyparker' },
          { id: 'trufflehog',   label: 'Trufflehog' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'semgrep' && <SemgrepTab engagementId={engagementId} />}
      {activeTab === 'noseyparker' && <SecretScanTab engagementId={engagementId} toolName="noseyparker" />}
      {activeTab === 'trufflehog' && <SecretScanTab engagementId={engagementId} toolName="trufflehog" />}

      {activeTab === 'review' && <>

      {/* Config row */}
      <div className="card flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <label className="label">Model</label>
          <div className="flex items-center gap-2">
            <select
              className="input flex-1"
              value={model}
              onChange={(e) => persistModel(e.target.value)}
              disabled={modelsLoading || models.length === 0}
            >
              {models.length === 0
                ? <option value="">No models — check LLM_PROXY_URL</option>
                : models.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
            </select>
            <button
              type="button"
              onClick={loadModels}
              disabled={modelsLoading}
              className="btn-secondary shrink-0 p-2"
              title="Refresh models"
            >
              <RefreshCw className={clsx('h-4 w-4', modelsLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
        <div>
          <label className="label">Input Mode</label>
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode('single_file')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                mode === 'single_file' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-secondary hover:bg-input',
              )}
            >
              <FileCode2 className="h-4 w-4" />
              Single File
            </button>
            <button
              type="button"
              onClick={() => setMode('directory')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
                mode === 'directory' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-secondary hover:bg-input',
              )}
            >
              <FolderOpen className="h-4 w-4" />
              Directory
            </button>
          </div>
        </div>
      </div>

      {/* Input area */}
      {mode === 'single_file' ? (
        <div className="card space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Filename</label>
              <input
                className="input"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="example.py"
              />
            </div>
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileBrowse} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Upload className="h-4 w-4" />
                Browse
              </button>
            </div>
          </div>
          <div>
            <label className="label">Code</label>
            <textarea
              className="textarea min-h-[260px] font-mono text-xs"
              value={fileCode}
              onChange={(e) => setFileCode(e.target.value)}
              placeholder="Paste code or use Browse to load a file from your machine…"
            />
          </div>
        </div>
      ) : (
        <div className="card space-y-4">
          {/* Upload folder */}
          <div>
            <label className="label mb-2">Upload Directory from Local Machine</label>
            <input
              ref={uploadDirInputRef}
              type="file"
              className="hidden"
              // @ts-ignore
              webkitdirectory=""
              multiple
              onChange={handleDirUpload}
            />
            <button
              type="button"
              onClick={() => uploadDirInputRef.current?.click()}
              disabled={uploadProgress !== null}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {uploadProgress !== null
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FolderUp className="h-4 w-4" />}
              {uploadProgress !== null ? `Uploading… ${uploadProgress}%` : 'Upload Folder'}
            </button>
            {uploadProgress !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-input">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* Directory selector */}
          <div>
            <label className="label">Select Directory</label>
            {scanDirsLoading ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : scanDirs.length === 0 ? (
              <p className="text-sm text-text-muted">No directories uploaded yet. Use Upload Folder above.</p>
            ) : (
              <div className="space-y-1.5">
                {scanDirs.map((d) => (
                  <div
                    key={d.name}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors cursor-pointer',
                      selectedScanDir === d.name
                        ? 'border-accent/40 bg-accent/5 text-accent'
                        : 'border-border bg-input/30 text-text-secondary hover:border-accent/30 hover:bg-accent/5',
                    )}
                    onClick={() => handleDirSelect(d.name)}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">{d.name}</span>
                    <span className="shrink-0 text-xs text-text-muted">{d.file_count} files</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteScanDir(d.name); }}
                      className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                      title="Delete directory"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={loadScanDirs}
                  disabled={scanDirsLoading}
                  className="btn-ghost flex items-center gap-1.5 text-xs text-text-muted"
                >
                  <RefreshCw className={clsx('h-3 w-3', scanDirsLoading && 'animate-spin')} />
                  Refresh
                </button>
              </div>
            )}
          </div>

          {/* File list */}
          {listLoading && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Listing files…
            </div>
          )}
          {fileList.length > 0 && (
            <div>
              <input
                type="text"
                className="input mb-2 text-sm"
                placeholder="Filter files…"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
              />
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-text-muted">
                  {selectedCount} selected
                  {fileFilter.trim()
                    ? ` · showing ${filteredFileList.length} of ${fileList.length}`
                    : ` of ${fileList.length}`}
                  {(() => {
                    const dir = scanDirs.find((d) => d.name === selectedScanDir);
                    const total = dir?.file_count;
                    return total && total > fileList.length
                      ? ` · ${total - fileList.length} non-code files excluded`
                      : null;
                  })()}
                </span>
                <button type="button" onClick={toggleAll} className="btn-ghost text-xs text-text-muted">
                  {filteredFileList.some((f) => selected[f.path]) ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {filteredFileList.map((f) => (
                  <label
                    key={f.path}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer text-sm transition-colors',
                      f.skippable ? 'opacity-50 cursor-not-allowed' : 'hover:bg-input/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[f.path]}
                      onChange={() => !f.skippable && toggleFile(f.path)}
                      disabled={f.skippable}
                      className="shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary">{f.relative_path}</span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {formatBytes(f.size)}{f.skippable && ' — too large'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scan controls */}
      <div className="flex items-center gap-3">
        {scanning ? (
          <button type="button" onClick={stopScan} className="btn-secondary flex items-center gap-2">
            <Square className="h-3.5 w-3.5 fill-current" />
            Cancel All
          </button>
        ) : (
          <button
            type="button"
            onClick={runScan}
            disabled={!model || (mode === 'single_file' ? !fileCode.trim() : selectedCount === 0)}
            className="btn-primary flex items-center gap-2"
          >
            <ScanLine className="h-4 w-4" />
            {mode === 'directory' ? `Review ${selectedCount} File${selectedCount !== 1 ? 's' : ''}` : 'Review File'}
          </button>
        )}
      </div>

      {/* Active job progress panel */}
      {scanning && jobFiles.length > 0 && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span className="text-sm font-medium text-text-secondary">
                Scanning {jobDone} / {jobTotal} files
              </span>
            </div>
            <span className="text-xs text-text-muted">Runs in background — safe to navigate away</span>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-border rounded-xl border border-border">
            {jobFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2">
                <span className="shrink-0">{JOB_FILE_STATUS_ICON[f.status] ?? JOB_FILE_STATUS_ICON.pending}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary">{f.filename}</span>
                {f.status === 'error' && (
                  <span className="shrink-0 text-xs text-red-400 truncate max-w-[200px]">{f.error_message}</span>
                )}
                {f.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => cancelJobFile(f.id)}
                    className="shrink-0 rounded p-0.5 text-text-muted hover:text-red-400 transition-colors"
                    title="Cancel this file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
              Results ({filteredResults.length}{resultFilter ? ` of ${results.length}` : ''})
            </h2>
            <div className="flex items-center gap-2">
              {doneResults.length > 0 && (
                <>
                  <button type="button" onClick={() => saveMarkdown(true)} className="btn-ghost flex items-center gap-1.5 text-xs text-text-muted">
                    <Save className="h-3.5 w-3.5" />
                    Save Findings
                  </button>
                  <button type="button" onClick={() => saveMarkdown(false)} className="btn-ghost flex items-center gap-1.5 text-xs text-text-muted">
                    <Save className="h-3.5 w-3.5" />
                    Save All
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={clearAllResults}
                disabled={scanning}
                className="btn-ghost flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </button>
            </div>
          </div>
          <input
            type="text"
            className="input text-sm"
            placeholder="Filter results — SQL, XSS, RCE, filename…"
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
          />
          {filteredResults.map((r) => {
            const severities = parseSeverities(r.content);
            return (
            <div key={r.key} className="card overflow-hidden">
              <div className="flex w-full min-w-0 items-start gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(r.key)}
                  className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                >
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <FileStatusIcon status={r.status} />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-secondary">
                      {r.filename}
                    </span>
                    {r.expanded
                      ? <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                      : <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />}
                  </div>
                  {r.content && severities.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-6">
                      {severities.map((sev) => (
                        <span key={sev} className={`rounded border px-1.5 py-0.5 text-2xs font-medium uppercase ${SEVERITY_STYLES[sev]}`}>
                          {sev}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                  {(r.sourcePath || r.sourceContent) && (
                    <button
                      type="button"
                      onClick={() => openSource(r)}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-input hover:text-accent"
                      title="View source file"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {(r.status === 'saved' || r.status === 'done' || r.status === 'error') && (
                    <button
                      type="button"
                      onClick={() => reprocessResult(r)}
                      disabled={scanning}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-input hover:text-accent disabled:opacity-40"
                      title="Re-scan with LLM"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {(r.status === 'saved' || r.status === 'done') && r.content && (
                    <button
                      type="button"
                      onClick={() => setNoteModal(r)}
                      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-input hover:text-accent"
                      title="Add to asset note"
                    >
                      <StickyNote className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteResult(r)}
                    className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-input hover:text-red-500"
                    title="Delete result"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {r.expanded && (
                <div className="mt-3 border-t border-border pt-3">
                  {r.content ? (
                    <div className="text-sm leading-relaxed [&_.markdown-body]:text-sm [&_.markdown-body]:leading-relaxed [&_.markdown-body_pre]:!text-xs">
                      <MarkdownViewer content={r.content} />
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted italic">No output.</p>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {noteModal && (
        <AddToNoteModal
          result={noteModal}
          engagementId={engagementId}
          onClose={() => setNoteModal(null)}
        />
      )}

      {sourceModal && (
        <SourceModal
          filename={sourceModal.filename}
          content={sourceModal.content}
          onClose={() => setSourceModal(null)}
        />
      )}

      </>}
    </div>
  );
}
