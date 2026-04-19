import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Plus, Clock } from 'lucide-react';
import { isStructuredContent, formatStructuredContent } from '../utils/formatContent';

const PHASES = ['', 'Reconnaissance', 'Scanning and Enumeration', 'Exploitation', 'Post-Exploitation', 'Reporting'];

export default function ActivityLog() {
  const { id } = useParams();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ action: '', target: '', phase: '', notes: '' });
  const [filterPhase, setFilterPhase] = useState('');
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh(r => r + 1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = { limit: 100 };
        if (filterPhase) params.phase = filterPhase;
        const { data } = await api.get(`/engagements/${id}/activity-log`, { params, signal: controller.signal });
        setLogs(data.items);
        setTotal(data.total);
      } catch (err) {
        if (err.name !== 'CanceledError') toast.error(err.message);
      }
    };
    load();
    return () => controller.abort();
  }, [id, filterPhase, refresh]);

  const handleCreate = async () => {
    if (!form.action.trim()) return toast.error('Action is required');
    try {
      await api.post(`/engagements/${id}/activity-log`, form);
      toast.success('Log entry added');
      setShowCreate(false);
      setForm({ action: '', target: '', phase: '', notes: '' });
      reload();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Clock className="w-5 h-5" /> Activity Log</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Log Activity</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2"><label className="label">Action *</label><input className="input" placeholder="What did you do?" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} /></div>
            <div><label className="label">Target</label><input className="input" placeholder="e.g. 10.10.10.1, webapp..." value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
            <div>
              <label className="label">Phase</label>
              <select className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                {PHASES.map(p => <option key={p} value={p}>{p || 'Select...'}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">Notes</label><textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary">Add</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <span className="text-xs text-text-muted">Filter:</span>
        {PHASES.map(p => (
          <button key={p} onClick={() => setFilterPhase(p)} className={`btn-ghost text-xs ${filterPhase === p ? 'bg-accent/10 text-accent' : ''}`}>
            {p || 'All'}
          </button>
        ))}
        <span className="text-xs text-text-muted ml-auto">{total} entries</span>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {logs.map((log, i) => (
          <div key={log.id} className="flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-accent shrink-0 mt-1.5" />
              {i < logs.length - 1 && <div className="w-px flex-1 bg-border" />}
            </div>
            {/* Content */}
            <div className="pb-6 flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-text-primary">{log.action}</p>
                  {log.target && <p className="text-xs text-text-muted mt-0.5">Target: {log.target}</p>}
                  {log.notes && (
                  <div className="text-xs text-text-secondary mt-1">
                    {isStructuredContent(log.notes) ? (
                      <pre className="bg-input p-3 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto mt-1">
                        {formatStructuredContent(log.notes)}
                      </pre>
                    ) : (
                      <p>{log.notes}</p>
                    )}
                  </div>
                )}
                </div>
                <div className="text-right shrink-0 ml-4">
                  {log.phase && <span className="text-2xs px-2 py-0.5 rounded bg-accent/10 text-accent">{log.phase}</span>}
                  <p className="text-2xs text-text-muted mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-12 text-text-muted">No activity logged yet</div>
        )}
      </div>
    </div>
  );
}
