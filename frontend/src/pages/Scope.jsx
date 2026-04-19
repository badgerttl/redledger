import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import MarkdownEditor from '../components/MarkdownEditor';
import MarkdownViewer from '../components/MarkdownViewer';

export default function Scope() {
  const { id } = useParams();
  const [scope, setScope] = useState({ in_scope: '', out_scope: '' });
  const [editScope, setEditScope] = useState(null); // null = view, object = editing copy
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState({ entry_type: 'domain', value: '' });
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh(r => r + 1);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [s, e] = await Promise.all([
          api.get(`/engagements/${id}/scope`, { signal: controller.signal }),
          api.get(`/engagements/${id}/scope-entries`, { signal: controller.signal }),
        ]);
        setScope(s.data);
        setEntries(e.data);
      } catch (err) {
        if (err.name !== 'CanceledError') toast.error(err.message);
      }
    };
    load();
    return () => controller.abort();
  }, [id, refresh]);

  const startEdit = () => setEditScope({ in_scope: scope.in_scope, out_scope: scope.out_scope });
  const cancelEdit = () => setEditScope(null);

  const saveScope = async () => {
    try {
      await api.put(`/engagements/${id}/scope`, { in_scope: editScope.in_scope, out_scope: editScope.out_scope });
      setScope({ in_scope: editScope.in_scope, out_scope: editScope.out_scope });
      setEditScope(null);
      toast.success('Scope saved');
    } catch (err) { toast.error(err.message); }
  };

  const addEntry = async () => {
    if (!newEntry.value.trim()) return;
    try {
      await api.post(`/engagements/${id}/scope-entries`, newEntry);
      setNewEntry({ ...newEntry, value: '' });
      reload();
      toast.success('Entry added');
    } catch (err) { toast.error(err.message); }
  };

  const deleteEntry = async (entryId) => {
    try {
      await api.delete(`/scope-entries/${entryId}`);
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const editing = editScope !== null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Scope</h1>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={saveScope} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" /> Save
            </button>
            <button onClick={cancelEdit} className="btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        ) : (
          <button onClick={startEdit} className="btn-secondary flex items-center gap-2">
            <Edit2 className="w-4 h-4" /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card">
          <label className="label mb-2 block">In Scope</label>
          {editing ? (
            <MarkdownEditor
              value={editScope.in_scope}
              onChange={(v) => setEditScope((prev) => ({ ...prev, in_scope: v }))}
              placeholder="Define what is in scope for this engagement..."
              minHeight="280px"
            />
          ) : (
            <div className="min-h-[80px]">
              {scope.in_scope?.trim()
                ? <MarkdownViewer content={scope.in_scope} />
                : <p className="text-sm text-text-muted italic">Not defined. Click Edit to add scope.</p>}
            </div>
          )}
        </div>
        <div className="card">
          <label className="label mb-2 block">Out of Scope</label>
          {editing ? (
            <MarkdownEditor
              value={editScope.out_scope}
              onChange={(v) => setEditScope((prev) => ({ ...prev, out_scope: v }))}
              placeholder="Define what is out of scope..."
              minHeight="280px"
            />
          ) : (
            <div className="min-h-[80px]">
              {scope.out_scope?.trim()
                ? <MarkdownViewer content={scope.out_scope} />
                : <p className="text-sm text-text-muted italic">Not defined. Click Edit to add scope.</p>}
            </div>
          )}
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
