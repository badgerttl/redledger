import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import MarkdownViewer from '../components/MarkdownViewer';
import clsx from 'clsx';
import {
  BookOpen, RefreshCw, Shield, ChevronRight,
  ArrowLeft, Download, AlertCircle, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── WSTG sub-components ────────────────────────────────────────────────────

function WstgOverview({ index, onSelectCategory }) {
  if (!index) return <div className="text-text-muted py-12 text-center">Loading…</div>;
  return (
    <div>
      <p className="text-sm text-text-secondary mb-6">
        OWASP Web Security Testing Guide v4.2 — {index.categories.length} categories,{' '}
        {index.categories.reduce((n, c) => n + c.tests.length, 0)} test cases.
        Click a category to explore.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {index.categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onSelectCategory(cat)}
            className="card text-left hover:border-accent/50 hover:bg-accent/5 transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-mono text-accent mb-1">{cat.id}</div>
                <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors leading-snug">
                  {cat.name}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
            </div>
            <div className="text-xs text-text-muted mt-2">{cat.tests.length} test cases</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function WstgCategory({ cat, content, contentLoading, downloaded, onSelectTest, onInternalLink }) {
  return (
    <div>
      {contentLoading ? (
        <div className="text-text-muted py-8 text-center">Loading…</div>
      ) : (
        <>
          {!downloaded && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Full guide not downloaded — click <strong className="mx-1">Update from Online</strong> to fetch complete content.
            </div>
          )}
          {content && (
            <div className="card mb-4">
              <MarkdownViewer content={content} onInternalLink={onInternalLink} />
            </div>
          )}
        </>
      )}
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">
        Test Cases — {cat.id}
      </h3>
      <div className="space-y-2">
        {cat.tests.map((test) => (
          <button
            key={test.id}
            onClick={() => onSelectTest(test)}
            className="card w-full text-left hover:border-accent/50 hover:bg-accent/5 transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-mono text-accent mb-0.5">{test.id}</div>
                <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                  {test.name}
                </div>
                {test.description && (
                  <div className="text-xs text-text-muted mt-1 line-clamp-2">{test.description}</div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function WstgTest({ content, contentLoading, downloaded, onInternalLink }) {
  return (
    <div>
      {contentLoading ? (
        <div className="text-text-muted py-8 text-center">Loading…</div>
      ) : (
        <>
          {!downloaded && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Showing stub — click <strong className="mx-1">Update from Online</strong> to download the full test guide.
            </div>
          )}
          <div className="card">
            <MarkdownViewer content={content} onInternalLink={onInternalLink} />
          </div>
        </>
      )}
    </div>
  );
}

function RefreshResult({ result, onClose }) {
  if (!result) return null;
  const hasErrors = result.errors?.length > 0;
  return (
    <div className={clsx(
      'mb-4 rounded-md border px-3 py-2 text-xs',
      hasErrors
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        : 'border-green-500/30 bg-green-500/10 text-green-400',
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {hasErrors
            ? <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            : <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>
            Downloaded {result.categories} category guides, {result.tests} test cases.
            {hasErrors && ` ${result.errors.length} errors.`}
          </span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary ml-4">✕</button>
      </div>
      {hasErrors && (
        <details className="mt-1">
          <summary className="cursor-pointer text-text-muted">Show errors</summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {result.errors.map((e, i) => <li key={i} className="font-mono">{e}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Guides() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven state — source of truth for all navigation
  const activeTab = searchParams.get('tab');        // null | 'wstg'
  const phaseSlug = searchParams.get('phase');       // null | slug
  const wstgCatKey = searchParams.get('cat');        // null | 'info' etc
  const wstgTestId = searchParams.get('test');       // null | 'WSTG-INFO-01'

  const isWstg = activeTab === 'wstg';
  const wstgView = wstgTestId ? 'test' : wstgCatKey ? 'category' : 'overview';

  // Local data state (content, not nav)
  const [phases, setPhases] = useState([]);
  const [phaseGuide, setPhaseGuide] = useState(null);
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [wstgIndex, setWstgIndex] = useState(null);
  const [catContent, setCatContent] = useState('');
  const [catDownloaded, setCatDownloaded] = useState(false);
  const [catLoading, setCatLoading] = useState(false);
  const [testContent, setTestContent] = useState('');
  const [testDownloaded, setTestDownloaded] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);

  // ── Navigation helpers (no pushState — React Router handles history) ─────
  const goPhase = useCallback((slug) => {
    setSearchParams(slug ? { phase: slug } : {});
  }, [setSearchParams]);

  const goWstgOverview = useCallback(() => {
    setSearchParams({ tab: 'wstg' });
  }, [setSearchParams]);

  const goCategory = useCallback((cat) => {
    setSearchParams({ tab: 'wstg', cat: cat.key });
  }, [setSearchParams]);

  const goTest = useCallback((test, catKey) => {
    setSearchParams({ tab: 'wstg', cat: catKey, test: test.id });
  }, [setSearchParams]);

  const goBack = useCallback(() => {
    if (wstgView === 'test') setSearchParams({ tab: 'wstg', cat: wstgCatKey });
    else if (wstgView === 'category') setSearchParams({ tab: 'wstg' });
  }, [wstgView, wstgCatKey, setSearchParams]);

  // ── Load phases list ─────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/phases').then(({ data }) => {
      setPhases(data);
      // Default to first phase if nothing selected
      if (!activeTab && !phaseSlug && data.length > 0) {
        setSearchParams({ phase: data[0].slug }, { replace: true });
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load phase guide (non-WSTG) ──────────────────────────────────────────
  const effectivePhase = phaseSlug || phases[0]?.slug;
  useEffect(() => {
    if (isWstg || !effectivePhase) return;
    setPhaseLoading(true);
    setPhaseGuide(null);
    api.get(`/phases/${effectivePhase}/guide`)
      .then(({ data }) => setPhaseGuide(data))
      .catch(() => {})
      .finally(() => setPhaseLoading(false));
  }, [isWstg, effectivePhase]);

  // ── Load WSTG index ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isWstg || wstgIndex) return;
    api.get('/guides/wstg/index').then(({ data }) => setWstgIndex(data)).catch(() => {});
  }, [isWstg, wstgIndex]);

  // ── Auto-resolve cat when test arrives without cat (deep-linked) ─────────
  useEffect(() => {
    if (!wstgIndex || !wstgTestId || wstgCatKey) return;
    for (const cat of wstgIndex.categories) {
      if (cat.tests.some((t) => t.id === wstgTestId)) {
        setSearchParams({ tab: 'wstg', cat: cat.key, test: wstgTestId }, { replace: true });
        break;
      }
    }
  }, [wstgIndex, wstgTestId, wstgCatKey, setSearchParams]);

  // ── Load category content ────────────────────────────────────────────────
  useEffect(() => {
    if (!isWstg || !wstgCatKey || wstgTestId) return;
    setCatLoading(true);
    api.get(`/guides/wstg/categories/${wstgCatKey}`)
      .then(({ data }) => { setCatContent(data.content); setCatDownloaded(data.downloaded); })
      .catch(() => {})
      .finally(() => setCatLoading(false));
  }, [isWstg, wstgCatKey, wstgTestId]);

  // ── Load test content ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isWstg || !wstgTestId) return;
    setTestLoading(true);
    api.get(`/guides/wstg/tests/${wstgTestId}`)
      .then(({ data }) => { setTestContent(data.content); setTestDownloaded(data.downloaded); })
      .catch(() => {})
      .finally(() => setTestLoading(false));
  }, [isWstg, wstgTestId]);

  // ── Derived objects from index ───────────────────────────────────────────
  const wstgCat = useMemo(() => {
    if (!wstgIndex || !wstgCatKey) return null;
    return wstgIndex.categories.find((c) => c.key === wstgCatKey) || null;
  }, [wstgIndex, wstgCatKey]);

  const wstgTest = useMemo(() => {
    if (!wstgCat || !wstgTestId) return null;
    return wstgCat.tests.find((t) => t.id === wstgTestId) || null;
  }, [wstgCat, wstgTestId]);

  // ── Internal markdown link resolver ─────────────────────────────────────
  const handleInternalLink = useCallback((href) => {
    if (!wstgIndex) return;
    const normalized = href.replace(/^(\.\.\/)+/, '');
    const parts = normalized.split('/');
    const filename = parts[parts.length - 1];
    const fileMatch = filename.match(/^(\d{2})-.*\.md$/);
    if (!fileMatch) return;
    const testNum = parseInt(fileMatch[1], 10);

    let targetCat = wstgCat;
    if (parts.length > 1) {
      const folderMatch = parts[0].match(/^(\d{2})-/);
      if (folderMatch) {
        const catIdx = parseInt(folderMatch[1], 10) - 1;
        targetCat = wstgIndex.categories[catIdx] || wstgCat;
      }
    }
    if (!targetCat) return;
    const test = targetCat.tests[testNum - 1];
    if (!test) return;
    goTest(test, targetCat.key);
  }, [wstgIndex, wstgCat, goTest]);

  // ── Update from Online ───────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const { data } = await api.post('/guides/wstg/refresh');
      setRefreshResult(data);
      toast.success(`Downloaded ${data.categories} categories, ${data.tests} test cases`);
      // Reload current view
      if (wstgCatKey && !wstgTestId) {
        setCatLoading(true);
        api.get(`/guides/wstg/categories/${wstgCatKey}`)
          .then(({ data: d }) => { setCatContent(d.content); setCatDownloaded(d.downloaded); })
          .catch(() => {})
          .finally(() => setCatLoading(false));
      } else if (wstgTestId) {
        setTestLoading(true);
        api.get(`/guides/wstg/tests/${wstgTestId}`)
          .then(({ data: d }) => { setTestContent(d.content); setTestDownloaded(d.downloaded); })
          .catch(() => {})
          .finally(() => setTestLoading(false));
      }
    } catch (err) {
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><BookOpen className="w-5 h-5" /> Phase Guides</h1>
        {isWstg && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {refreshing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {refreshing ? 'Downloading…' : 'Update from Online'}
          </button>
        )}
      </div>

      {/* Top-level tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {phases.map((p) => (
          <button
            key={p.slug}
            onClick={() => goPhase(p.slug)}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
              !isWstg && effectivePhase === p.slug
                ? 'bg-accent text-white'
                : 'bg-card border border-border text-text-secondary hover:text-text-primary hover:border-text-muted',
            )}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={goWstgOverview}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 flex items-center gap-1.5',
            isWstg
              ? 'bg-accent text-white'
              : 'bg-card border border-border text-text-secondary hover:text-text-primary hover:border-text-muted',
          )}
        >
          <Shield className="w-3.5 h-3.5" />
          OWASP WSTG
        </button>
      </div>

      {/* Phase guide */}
      {!isWstg && (
        <div className="card">
          {phaseLoading ? (
            <div className="text-text-muted py-8 text-center">Loading guide…</div>
          ) : phaseGuide ? (
            <MarkdownViewer content={phaseGuide.content} />
          ) : (
            <div className="text-text-muted py-8 text-center">Select a phase to view its guide</div>
          )}
        </div>
      )}

      {/* WSTG guide */}
      {isWstg && (
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm mb-3 flex-wrap min-w-0">
            <button
              onClick={goWstgOverview}
              className={clsx(
                'flex items-center gap-1 shrink-0 transition-colors',
                wstgView === 'overview'
                  ? 'text-text-primary font-medium cursor-default'
                  : 'text-accent hover:underline',
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              WSTG Overview
            </button>
            {wstgCat && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <button
                  onClick={wstgTest ? () => goCategory(wstgCat) : undefined}
                  className={clsx(
                    'transition-colors shrink-0',
                    !wstgTest ? 'text-text-primary font-medium cursor-default' : 'text-accent hover:underline',
                  )}
                >
                  {wstgCat.id}: {wstgCat.name}
                </button>
              </>
            )}
            {wstgTest && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="text-text-primary font-medium truncate">{wstgTest.id}: {wstgTest.name}</span>
              </>
            )}
          </nav>

          {wstgView !== 'overview' && (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {wstgView === 'test' ? `Back to ${wstgCat?.name}` : 'Back to Overview'}
            </button>
          )}

          <RefreshResult result={refreshResult} onClose={() => setRefreshResult(null)} />

          {wstgView === 'overview' && (
            <WstgOverview index={wstgIndex} onSelectCategory={goCategory} />
          )}
          {wstgView === 'category' && wstgCat && (
            <WstgCategory
              cat={wstgCat}
              content={catContent}
              contentLoading={catLoading}
              downloaded={catDownloaded}
              onSelectTest={(test) => goTest(test, wstgCatKey)}
              onInternalLink={handleInternalLink}
            />
          )}
          {wstgView === 'test' && (
            <WstgTest
              content={testContent}
              contentLoading={testLoading}
              downloaded={testDownloaded}
              onInternalLink={handleInternalLink}
            />
          )}
        </div>
      )}
    </div>
  );
}
