import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, CheckSquare, Ban, Shield, BookOpen, RefreshCw } from 'lucide-react';

const isApplicable = (i) => !i.is_na;
const WSTG_PREFIX = 'WSTG - ';
const PHASE_GUIDE_SLUGS = {
  Reconnaissance: 'reconnaissance',
  'Scanning and Enumeration': 'scanning_and_enumeration',
  Exploitation: 'exploitation',
  'Post-Exploitation': 'post_exploitation',
  Reporting: 'reporting',
};

function guideSectionSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ProgressBar({ checked, total }) {
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary">{checked}/{total} complete</span>
      <div className="w-32 h-2 bg-input rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-accent">{pct}%</span>
    </div>
  );
}

function PhaseGroup({ phase, items, onPatch, isWstg }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const appl = items.filter(isApplicable);
  const phaseChecked = appl.filter((i) => i.is_checked).length;
  const phaseApplicable = appl.length;
  const guideSlug = PHASE_GUIDE_SLUGS[phase];

  return (
    <div className={clsx('card', isWstg && 'border-l-2 border-l-accent/30')}>
      <div className="w-full flex items-center justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex flex-1 items-center gap-3 text-left"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="shrink-0">
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            )}
          </span>
          <span className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">{phase}</span>
            <span className="text-xs text-text-muted">
              {phaseChecked}/{phaseApplicable}
              {items.length > phaseApplicable && (
                <span className="text-text-muted/80"> · {items.length - phaseApplicable} N/A</span>
              )}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {guideSlug && (
            <button
              type="button"
              title={`View ${phase} guide`}
              onClick={() => navigate(`/guides?tab=methodology&phase=${guideSlug}`)}
              className="text-text-muted hover:text-accent transition-colors"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          )}
          <div className="w-20 h-1.5 bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: phaseApplicable > 0 ? `${(phaseChecked / phaseApplicable) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 py-1.5">
              <input
                type="checkbox"
                checked={item.is_checked}
                disabled={item.is_na}
                onChange={(e) => onPatch(item.id, { is_checked: e.target.checked })}
                className="mt-0.5 w-4 h-4 shrink-0 rounded border-border bg-input text-accent focus:ring-accent/50 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                title={item.is_na ? 'Mark as applicable' : 'Mark as not applicable (N/A)'}
                onClick={() => onPatch(item.id, { is_na: !item.is_na })}
                className={clsx(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                  item.is_na
                    ? 'border-red-500 bg-red-500/15 text-red-500 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.25)]'
                    : 'border-border bg-input/40 text-text-muted hover:border-red-400/50 hover:text-red-400',
                )}
                aria-pressed={item.is_na}
              >
                <Ban className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={clsx(
                      'text-sm',
                      item.is_na && 'line-through text-text-muted',
                      !item.is_na && item.is_checked && 'text-text-muted line-through',
                      !item.is_na && !item.is_checked && 'text-text-primary',
                    )}
                  >
                    {item.label}
                  </span>
                  {isWstg && (() => {
                    const wstgId = item.label.match(/^(WSTG-[A-Z]+-\d+):/)?.[1];
                    return wstgId ? (
                      <button
                        type="button"
                        title={`View OWASP guide for ${wstgId}`}
                        onClick={() => navigate(`/guides?tab=wstg&test=${wstgId}`)}
                        className="shrink-0 text-text-muted hover:text-accent transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                    ) : null;
                  })()}
                  {!isWstg && guideSlug && (
                    <button
                      type="button"
                      title={`View guide section for ${item.label}`}
                      onClick={() => navigate(`/guides?tab=methodology&phase=${guideSlug}&section=${guideSectionSlug(item.label)}`)}
                      className="shrink-0 text-text-muted hover:text-accent transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {item.description && (
                  <p
                    className={clsx(
                      'text-xs mt-0.5',
                      item.is_na ? 'line-through text-text-muted/80' : 'text-text-muted',
                    )}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Checklists() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'methodology';
  const setActiveTab = (tab) => setSearchParams({ tab });

  const [checklists, setChecklists] = useState({});
  const [refresh, setRefresh] = useState(0);
  const [loadingWstg, setLoadingWstg] = useState(false);
  const [syncingMethodology, setSyncingMethodology] = useState(false);
  const reload = () => setRefresh((r) => r + 1);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/engagements/${id}/checklists`, { signal: controller.signal })
      .then(({ data }) => setChecklists(data))
      .catch((err) => { if (err.name !== 'CanceledError') toast.error(err.message); });
    return () => controller.abort();
  }, [id, refresh]);

  const patchItem = async (itemId, body) => {
    try {
      await api.patch(`/checklists/${itemId}`, body);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleLoadWstg = async () => {
    setLoadingWstg(true);
    try {
      const { data } = await api.post(`/engagements/${id}/wstg/load`);
      if (data.already_loaded) {
        toast('WSTG checklist already loaded', { icon: 'ℹ️' });
      } else {
        toast.success(`Loaded ${data.loaded} WSTG test cases`);
        setActiveTab('wstg');
        reload();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingWstg(false);
    }
  };

  const handleSyncMethodology = async () => {
    setSyncingMethodology(true);
    try {
      const { data } = await api.post(`/engagements/${id}/checklists/methodology/sync`);
      if (data.added > 0 || data.updated > 0) {
        const parts = [];
        if (data.added > 0) parts.push(`added ${data.added}`);
        if (data.updated > 0) parts.push(`updated ${data.updated}`);
        toast.success(`Methodology checklist ${parts.join(', ')}`);
        setActiveTab('methodology');
        reload();
      } else {
        toast('Methodology checklist already up to date', { icon: 'ℹ️' });
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncingMethodology(false);
    }
  };

  const allPhases = Object.keys(checklists);
  const wstgPhases = allPhases.filter((p) => p.startsWith(WSTG_PREFIX));
  const methodPhases = allPhases.filter((p) => !p.startsWith(WSTG_PREFIX));
  const hasWstg = wstgPhases.length > 0;

  const methodItems = methodPhases.flatMap((p) => checklists[p]);
  const wstgItems = wstgPhases.flatMap((p) => checklists[p]);

  const countApplicable = (items) => items.filter(isApplicable);
  const methodAppl = countApplicable(methodItems);
  const wstgAppl = countApplicable(wstgItems);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <CheckSquare className="w-5 h-5" /> Methodology Checklists
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncMethodology}
            disabled={syncingMethodology}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={clsx('w-4 h-4', syncingMethodology && 'animate-spin')} />
            {syncingMethodology ? 'Updating…' : 'Update Methodology'}
          </button>
          {!hasWstg && (
            <button
              onClick={handleLoadWstg}
              disabled={loadingWstg}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Shield className="w-4 h-4" />
              {loadingWstg ? 'Loading…' : 'Load OWASP WSTG'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('methodology')}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
            activeTab === 'methodology'
              ? 'bg-accent text-white'
              : 'bg-card border border-border text-text-secondary hover:text-text-primary hover:border-text-muted'
          )}
        >
          Methodology
        </button>
        <button
          onClick={() => setActiveTab('wstg')}
          className={clsx(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150 flex items-center gap-1.5',
            activeTab === 'wstg'
              ? 'bg-accent text-white'
              : 'bg-card border border-border text-text-secondary hover:text-text-primary hover:border-text-muted'
          )}
        >
          <Shield className="w-3.5 h-3.5" />
          OWASP WSTG
          {hasWstg && (
            <span className={clsx(
              'ml-1 text-xs px-1.5 py-0.5 rounded-full',
              activeTab === 'wstg' ? 'bg-white/20' : 'bg-accent/15 text-accent'
            )}>
              {wstgItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Progress bar for active tab */}
      <div className="mb-4">
        {activeTab === 'methodology' ? (
          <ProgressBar
            checked={methodAppl.filter((i) => i.is_checked).length}
            total={methodAppl.length}
          />
        ) : (
          <ProgressBar
            checked={wstgAppl.filter((i) => i.is_checked).length}
            total={wstgAppl.length}
          />
        )}
      </div>

      {/* Methodology tab */}
      {activeTab === 'methodology' && (
        <div className="space-y-3">
          {methodPhases.map((phase) => (
            <PhaseGroup
              key={phase}
              phase={phase}
              items={checklists[phase]}
              onPatch={patchItem}
              isWstg={false}
            />
          ))}
          {methodPhases.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              No checklist items. Create an engagement to generate default checklists.
            </div>
          )}
        </div>
      )}

      {/* WSTG tab */}
      {activeTab === 'wstg' && (
        <div className="space-y-3">
          {!hasWstg ? (
            <div className="text-center py-12 text-text-muted">
              <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="mb-3">WSTG checklist not loaded for this engagement.</p>
              <button
                onClick={handleLoadWstg}
                disabled={loadingWstg}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                <Shield className="w-4 h-4" />
                {loadingWstg ? 'Loading…' : 'Load OWASP WSTG'}
              </button>
            </div>
          ) : (
            wstgPhases.map((phase) => (
              <PhaseGroup
                key={phase}
                phase={phase}
                items={checklists[phase]}
                onPatch={patchItem}
                isWstg
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
