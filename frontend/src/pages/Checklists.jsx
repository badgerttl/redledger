import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';

export default function Checklists() {
  const { id } = useParams();
  const [checklists, setChecklists] = useState({});
  const [collapsed, setCollapsed] = useState({});
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh(r => r + 1);

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

  const toggle = async (itemId, checked) => {
    try {
      await api.patch(`/checklists/${itemId}`, { is_checked: checked });
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const phases = Object.keys(checklists);
  const totalItems = phases.reduce((sum, p) => sum + checklists[p].length, 0);
  const checkedItems = phases.reduce((sum, p) => sum + checklists[p].filter(i => i.is_checked).length, 0);
  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><CheckSquare className="w-5 h-5" /> Methodology Checklists</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{checkedItems}/{totalItems} complete</span>
          <div className="w-32 h-2 bg-input rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-medium text-accent">{progress}%</span>
        </div>
      </div>

      <div className="space-y-3">
        {phases.map((phase) => {
          const items = checklists[phase];
          const phaseChecked = items.filter(i => i.is_checked).length;
          const isCollapsed = collapsed[phase];

          return (
            <div key={phase} className="card">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setCollapsed(prev => ({ ...prev, [phase]: !prev[phase] }))}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                  <span className="text-sm font-medium text-text-primary">{phase}</span>
                  <span className="text-xs text-text-muted">{phaseChecked}/{items.length}</span>
                </div>
                <div className="w-20 h-1.5 bg-input rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: items.length > 0 ? `${(phaseChecked / items.length) * 100}%` : '0%' }}
                  />
                </div>
              </button>

              {!isCollapsed && (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  {items.map((item) => (
                    <label key={item.id} className="flex items-start gap-3 py-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={item.is_checked}
                        onChange={(e) => toggle(item.id, e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-border bg-input text-accent focus:ring-accent/50"
                      />
                      <div>
                        <span className={clsx('text-sm', item.is_checked ? 'text-text-muted line-through' : 'text-text-primary')}>
                          {item.label}
                        </span>
                        {item.description && (
                          <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </label>
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
