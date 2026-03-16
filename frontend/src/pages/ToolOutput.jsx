import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import TagBadge from '../components/TagBadge';
import FileUpload from '../components/FileUpload';
import { Plus, Trash2, Upload, ChevronDown, ChevronUp } from 'lucide-react';

import { formatStructuredContent } from '../utils/formatContent';

const PHASES = ['', 'Reconnaissance', 'Scanning and Enumeration', 'Exploitation', 'Post-Exploitation', 'Reporting'];

export default function ToolOutput() {
  const { id } = useParams();
  const [outputs, setOutputs] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ tool_name: '', phase: '', content: '' });
  const [filterPhase, setFilterPhase] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    try {
      const params = {};
      if (filterPhase) params.phase = filterPhase;
      const { data } = await api.get(`/engagements/${id}/tool-output`, { params });
      setOutputs(data);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, [id, filterPhase]);

  const handleCreate = async () => {
    if (!form.content.trim()) return toast.error('Content is required');
    try {
      await api.post(`/engagements/${id}/tool-output`, form);
      toast.success('Tool output added');
      setShowCreate(false);
      setForm({ tool_name: '', phase: '', content: '' });
      load();
    } catch { toast.error('Failed to add output'); }
  };

  const handleNmapImport = async (files) => {
    const file = files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post(`/engagements/${id}/import/nmap`, formData);
      toast.success(`Imported ${data.hosts_found} host(s)`);
      setShowImport(false);
      load();
    } catch { toast.error('Import failed — is this a valid Nmap XML file?'); }
  };

  const handleDelete = async (outputId) => {
    try {
      await api.delete(`/tool-output/${outputId}`);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tool Output</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import Nmap
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Output
          </button>
        </div>
      </div>

      {showImport && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Import Nmap XML</h2>
          <FileUpload
            onDrop={handleNmapImport}
            accept={{ 'text/xml': ['.xml'], 'application/xml': ['.xml'] }}
            label="Drop Nmap XML file here or click to upload"
          />
          <button onClick={() => setShowImport(false)} className="btn-secondary mt-3">Cancel</button>
        </div>
      )}

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Add Tool Output</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Tool Name</label><input className="input" placeholder="e.g. nmap, gobuster..." value={form.tool_name} onChange={(e) => setForm({ ...form, tool_name: e.target.value })} /></div>
            <div>
              <label className="label">Phase</label>
              <select className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                {PHASES.map(p => <option key={p} value={p}>{p || 'Select phase...'}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Content</label>
            <textarea className="textarea font-mono text-xs min-h-[200px]" placeholder="Paste tool output here..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary">Add</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {PHASES.map(p => (
          <button
            key={p}
            onClick={() => setFilterPhase(p)}
            className={`btn-ghost text-xs ${filterPhase === p ? 'bg-accent/10 text-accent' : ''}`}
          >
            {p || 'All'}
          </button>
        ))}
      </div>

      {/* Output list */}
      <div className="space-y-3">
        {outputs.map((o) => (
          <div key={o.id} className="card">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-text-primary">{o.tool_name || 'Unnamed'}</span>
                {o.phase && <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">{o.phase}</span>}
                <div className="flex gap-1">{o.tags?.map(t => <TagBadge key={t.id} tag={t} />)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">{new Date(o.created_at).toLocaleString()}</span>
                {expandedId === o.id ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </div>
            </div>
            {expandedId === o.id && (
              <div className="mt-3 pt-3 border-t border-border">
                <pre className="bg-input p-4 rounded-lg overflow-x-auto text-xs font-mono text-text-secondary max-h-96 overflow-y-auto whitespace-pre-wrap">{formatStructuredContent(o.content)}</pre>
                <div className="flex justify-end mt-3">
                  <button onClick={() => handleDelete(o.id)} className="btn-danger text-xs flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {outputs.length === 0 && (
          <div className="text-center py-12 text-text-muted">No tool output yet</div>
        )}
      </div>
    </div>
  );
}
