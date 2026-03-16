import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

export default function Scope() {
  const { id } = useParams();
  const [scope, setScope] = useState({ in_scope: '', out_scope: '' });
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState({ entry_type: 'domain', value: '' });

  const load = async () => {
    try {
      const [s, e] = await Promise.all([
        api.get(`/engagements/${id}/scope`),
        api.get(`/engagements/${id}/scope-entries`),
      ]);
      setScope(s.data);
      setEntries(e.data);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, [id]);

  const saveScope = async () => {
    try {
      await api.put(`/engagements/${id}/scope`, { in_scope: scope.in_scope, out_scope: scope.out_scope });
      toast.success('Scope saved');
    } catch { toast.error('Failed to save scope'); }
  };

  const addEntry = async () => {
    if (!newEntry.value.trim()) return;
    try {
      await api.post(`/engagements/${id}/scope-entries`, newEntry);
      setNewEntry({ ...newEntry, value: '' });
      load();
      toast.success('Entry added');
    } catch { toast.error('Failed to add entry'); }
  };

  const deleteEntry = async (entryId) => {
    try {
      await api.delete(`/scope-entries/${entryId}`);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Scope</h1>
        <button onClick={saveScope} className="btn-primary">Save</button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card">
          <label className="label">In Scope</label>
          <textarea
            className="textarea min-h-[200px]"
            placeholder="Define what is in scope for this engagement..."
            value={scope.in_scope}
            onChange={(e) => setScope({ ...scope, in_scope: e.target.value })}
          />
        </div>
        <div className="card">
          <label className="label">Out of Scope</label>
          <textarea
            className="textarea min-h-[200px]"
            placeholder="Define what is out of scope..."
            value={scope.out_scope}
            onChange={(e) => setScope({ ...scope, out_scope: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-medium mb-4">Scope Entries</h2>

        <div className="flex gap-3 mb-4">
          <select
            className="input w-40"
            value={newEntry.entry_type}
            onChange={(e) => setNewEntry({ ...newEntry, entry_type: e.target.value })}
          >
            <option value="domain">Domain</option>
            <option value="ip_range">IP Range</option>
            <option value="cidr">CIDR</option>
            <option value="url">URL</option>
          </select>
          <input
            className="input flex-1"
            placeholder="Enter value..."
            value={newEntry.value}
            onChange={(e) => setNewEntry({ ...newEntry, value: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          />
          <button onClick={addEntry} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">Value</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="table-row">
                <td className="px-3 py-2 text-sm">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">{entry.entry_type}</span>
                </td>
                <td className="px-3 py-2 text-sm text-text-secondary font-mono">{entry.value}</td>
                <td className="px-3 py-2">
                  <button onClick={() => deleteEntry(entry.id)} className="text-text-muted hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-text-muted">No scope entries yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
