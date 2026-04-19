import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, CheckSquare, Ban } from 'lucide-react';

const isApplicable = (i) => !i.is_na;

export default function Checklists() {
  const { id } = useParams();
  const [checklists, setChecklists] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh((r) => r + 1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data } = await api.get(`/engagements/${id}/checklists`, { signal: controller.signal });
        setChecklists(data);
      } catch (err) {
        if (err.name !== 'CanceledError') toast.error(err.message);
      }
    };
    load();
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

  const phases = Object.keys(checklists);
  const flatItems = phases.flatMap((p) => checklists[p]);
  const applicableFlat = flatItems.filter(isApplicable);
  const totalApplicable = applicableFlat.length;
  const checkedApplicable = applicableFlat.filter((i) => i.is_checked).length;
  const progress = totalApplicable > 0 ? Math.round((checkedApplicable / totalApplicable) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <CheckSquare className="w-5 h-5" /> Methodology Checklists
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">
            {checkedApplicable}/{totalApplicable} complete
            {flatItems.length > totalApplicable && (
              <span className="text-text-muted">
                {' '}
                ({flatItems.length - totalApplicable} N/A)
              </span>
            )}
          </span>
          <div className="w-32 h-2 bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-accent">{progress}%</span>
        </div>
      </div>

      <div className="space-y-3">
        {phases.map((phase) => {
          const items = checklists[phase];
          const appl = items.filter(isApplicable);
          const phaseChecked = appl.filter((i) => i.is_checked).length;
          const phaseApplicable = appl.length;
          const isCollapsed = collapsed[phase];

          return (
            <div key={phase} className="card">
              <button
                type="button"
                className="w-full flex items-center justify-between"
                onClick={() => setCollapsed((prev) => ({ ...prev, [phase]: !prev[phase] }))}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  )}
                  <span className="text-sm font-medium text-text-primary">{phase}</span>
                  <span className="text-xs text-text-muted">
                    {phaseChecked}/{phaseApplicable}
                    {items.length > phaseApplicable && (
                      <span className="text-text-muted/80"> · {items.length - phaseApplicable} N/A</span>
                    )}
                  </span>
                </div>
                <div className="w-20 h-1.5 bg-input rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{
                      width: phaseApplicable > 0 ? `${(phaseChecked / phaseApplicable) * 100}%` : '0%',
                    }}
                  />
                </div>
              </button>

              {!isCollapsed && (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={item.is_checked}
                        disabled={item.is_na}
                        onChange={(e) => patchItem(item.id, { is_checked: e.target.checked })}
                        className="mt-0.5 w-4 h-4 shrink-0 rounded border-border bg-input text-accent focus:ring-accent/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        title={item.is_na ? 'Mark as applicable' : 'Mark as not applicable (N/A)'}
                        onClick={() => patchItem(item.id, { is_na: !item.is_na })}
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
                        {item.description && (
                          <p
                            className={clsx(
                              'text-xs mt-0.5',
                              item.is_na && 'line-through text-text-muted/80',
                              !item.is_na && 'text-text-muted',
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
        })}

        {phases.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            No checklist items. Create an engagement to generate default checklists.
          </div>
        )}
      </div>
    </div>
  );
}
