import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import MarkdownViewer from '../components/MarkdownViewer';
import MarkdownEditor from '../components/MarkdownEditor';
import TagBadge from '../components/TagBadge';
import AttachmentGallery from '../components/AttachmentGallery';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, Plus, Trash2, StickyNote, X, Copy, ShieldAlert, KeyRound, Eye, EyeOff, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import ReconRecommendations from '../components/ReconRecommendations';
import AssetChat from '../components/AssetChat';
import { ASSET_TYPES, assetTypeLabel, AssetIcon } from '../utils/assetTypes';

const DEFAULT_TAG_COLORS = ['#6366f1', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

function AssetTree({ parentId, allAssets, depth, engagementId, navigate, currentAssetName, currentAssetId }) {
  const children = allAssets.filter(a => a.parent_asset_id === parentId);
  if (children.length === 0) return null;
  return (
    <>
      {children.map((child, idx) => {
        const isLast = idx === children.length - 1;
        const grandchildren = allAssets.filter(a => a.parent_asset_id === child.id);
        return (
          <div key={child.id}>
            <div
              className="flex items-center gap-2 px-4 py-2.5 hover:bg-accent/5 cursor-pointer transition-colors group"
              style={{ paddingLeft: `${16 + depth * 24}px` }}
              onClick={() => navigate(`/e/${engagementId}/assets/${child.id}`, {
                state: { from: `/e/${engagementId}/assets/${currentAssetId}`, fromLabel: currentAssetName }
              })}
            >
              {depth > 0 && (
                <span className="text-border select-none shrink-0" style={{ marginLeft: '-16px', marginRight: '4px' }}>
                  {isLast ? '└' : '├'}
                </span>
              )}
              <AssetIcon type={child.asset_type} className="w-3.5 h-3.5 shrink-0 text-text-muted" />
              <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">{child.name}</span>
              <span className="text-xs text-text-muted">{assetTypeLabel(child.asset_type)}</span>
              {child.target && <span className="text-xs font-mono text-text-muted truncate">{child.target}</span>}
            </div>
            {grandchildren.length > 0 && (
              <AssetTree
                parentId={child.id}
                allAssets={allAssets}
                depth={depth + 1}
                engagementId={engagementId}
                navigate={navigate}
                currentAssetName={currentAssetName}
                currentAssetId={currentAssetId}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default function AssetDetail() {
  const { id, assetId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.from || `/e/${id}/assets`;
  const backLabel = location.state?.fromLabel || 'Assets';
  const [asset, setAsset] = useState(null);
  const [notes, setNotes] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [linkedFindings, setLinkedFindings] = useState([]);
  const [linkedCredentials, setLinkedCredentials] = useState([]);
  const [revealedCreds, setRevealedCreds] = useState({});
  const [newNote, setNewNote] = useState('');
  /** Bumps after successful add so TipTap composer remounts empty (controlled reset). */
  const [newNoteEditorKey, setNewNoteEditorKey] = useState(0);
  const [editingNote, setEditingNote] = useState(null);
  const [editingNoteBody, setEditingNoteBody] = useState('');
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [noteFilter, setNoteFilter] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', asset_type: 'host', target: '', os: '', ports_summary: '' });
  const [showCreateLinked, setShowCreateLinked] = useState(false);
  const [linkedForm, setLinkedForm] = useState({ name: '', asset_type: 'host', target: '', os: '' });
  const [allTags, setAllTags] = useState([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [allEngagementAssets, setAllEngagementAssets] = useState([]);

  const load = async () => {
    try {
      const [a, n, s, t, f, cr, engAssets] = await Promise.all([
        api.get(`/assets/${assetId}`),
        api.get(`/assets/${assetId}/notes`),
        api.get(`/assets/${assetId}/screenshots`),
        api.get('/tags'),
        api.get(`/assets/${assetId}/findings`),
        api.get(`/assets/${assetId}/credentials`),
        api.get(`/engagements/${id}/assets`),
      ]);
      setAsset(a.data);
      setNotes(n.data);
      setScreenshots(s.data);
      setAllTags(t.data);
      setLinkedFindings(f.data);
      setLinkedCredentials(cr.data);
      setAllEngagementAssets(engAssets.data);
    } catch (err) {
      if (err.name !== 'CanceledError') toast.error(err.message);
    }
  };

  useEffect(() => { load(); }, [assetId]);

  useEffect(() => {
    setNewNote('');
    setNewNoteEditorKey((k) => k + 1);
  }, [assetId]);

  const startEdit = () => {
    setForm({
      name: asset.name || '',
      asset_type: asset.asset_type || 'host',
      target: asset.target || '',
      os: asset.os || '',
      ports_summary: asset.ports_summary || '',
      parent_asset_id: asset.parent_asset_id ?? null,
    });
    setEditing(true);
  };

  const handleCreateLinked = async () => {
    if (!linkedForm.name.trim()) return toast.error('Name is required');
    try {
      await api.post(`/engagements/${id}/assets`, { ...linkedForm, parent_asset_id: parseInt(assetId) });
      setShowCreateLinked(false);
      setLinkedForm({ name: '', asset_type: 'host', target: '', os: '' });
      load();
      toast.success('Linked asset created');
    } catch (err) { toast.error(err.message); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      await api.patch(`/assets/${assetId}`, form);
      setEditing(false);
      load();
      toast.success('Asset updated');
    } catch (err) { toast.error(err.message); }
  };


  const addTagToAsset = async (tagId) => {
    const currentIds = asset.tags?.map(t => t.id) || [];
    if (currentIds.includes(tagId)) return;
    try {
      await api.patch(`/assets/${assetId}`, { tag_ids: [...currentIds, tagId] });
      setShowTagDropdown(false);
      load();
      toast.success('Tag added');
    } catch (err) { toast.error(err.message); }
  };

  const removeTagFromAsset = async (tagId) => {
    const currentIds = asset.tags?.map(t => t.id) || [];
    try {
      await api.patch(`/assets/${assetId}`, { tag_ids: currentIds.filter(id => id !== tagId) });
      load();
    } catch (err) { toast.error(err.message); }
  };

  const createAndAddTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const { data } = await api.post('/tags', { name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      setShowCreateTag(false);
      await addTagToAsset(data.id);
    } catch (err) { toast.error(err.message); }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      const { data } = await api.post(`/assets/${assetId}/notes`, { body: newNote });
      setNewNote('');
      setNewNoteEditorKey((k) => k + 1);
      setExpandedNotes((prev) => new Set([...prev, data.id]));
      load();
      toast.success('Note added');
    } catch (err) { toast.error(err.message); }
  };

  const updateNote = async (noteId, body) => {
    try {
      await api.patch(`/notes/${noteId}`, { body });
      setEditingNote(null);
      load();
      toast.success('Note updated');
    } catch (err) { toast.error(err.message); }
  };

  const deleteNote = async (noteId) => {
    try {
      await api.delete(`/notes/${noteId}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const uploadFile = async (files) => {
    const file = files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caption', '');
    try {
      await api.post(`/assets/${assetId}/screenshots`, formData);
      load();
      toast.success('File uploaded');
    } catch (err) { toast.error(err.message); }
  };

  const deleteFile = async (scId) => {
    try {
      await api.delete(`/screenshots/${scId}`);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const copyTarget = async () => {
    if (!asset?.target) return;
    try {
      await navigator.clipboard.writeText(asset.target);
      toast.success('Copied to clipboard');
    } catch { toast.error('Failed to copy to clipboard'); }
  };

  if (!asset) return <div className="text-text-muted">Loading...</div>;

  const assetTagIds = asset.tags?.map(t => t.id) || [];
  const availableTags = allTags.filter(t => !assetTagIds.includes(t.id));

  return (
    <div>
      <button onClick={() => navigate(backTo)} className="btn-ghost mb-4 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to {backLabel}
      </button>

      {/* Ancestor breadcrumb chain */}
      {asset.parent_asset_id && (() => {
        const ancestors = [];
        let cur = allEngagementAssets.find(a => a.id === asset.parent_asset_id);
        while (cur) {
          ancestors.unshift(cur);
          cur = allEngagementAssets.find(a => a.id === cur.parent_asset_id);
        }
        if (ancestors.length === 0) return null;
        return (
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-3 flex-wrap">
            {ancestors.map((anc, i) => (
              <span key={anc.id} className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate(`/e/${id}/assets/${anc.id}`, { state: { from: `/e/${id}/assets/${assetId}`, fromLabel: asset.name } })}
                  className="flex items-center gap-1 hover:text-accent transition-colors"
                >
                  <AssetIcon type={anc.asset_type} className="w-3 h-3" />
                  {anc.name}
                </button>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </span>
            ))}
            <span className="flex items-center gap-1 text-text-secondary">
              <AssetIcon type={asset.asset_type} className="w-3 h-3" />
              {asset.name}
            </span>
          </div>
        );
      })()}

      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">{asset.name}</h1>
            {asset.target && (
              <button
                onClick={copyTarget}
                className="text-text-muted hover:text-accent transition-colors p-1 rounded hover:bg-accent/10"
                title="Copy target"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-text-muted mt-0.5">{assetTypeLabel(asset.asset_type)} · {asset.target}</p>
        </div>
        <button onClick={startEdit} className="btn-secondary">Edit</button>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Edit Asset</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}>
                {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Target (IP / URL)</label>
              <input className="input font-mono text-sm" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
            </div>
            <div>
              <label className="label">OS</label>
              <input className="input" value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Ports</label>
              <input className="input font-mono text-sm" placeholder="e.g. 80/tcp(http), 443/tcp(https)" value={form.ports_summary} onChange={(e) => setForm({ ...form, ports_summary: e.target.value })} />
            </div>
            <div>
              <label className="label">Parent Asset</label>
              <select
                className="input"
                value={form.parent_asset_id ?? ''}
                onChange={(e) => setForm({ ...form, parent_asset_id: e.target.value ? parseInt(e.target.value) : null })}
              >
                <option value="">None</option>
                {allEngagementAssets
                  .filter(a => a.id !== parseInt(assetId) && !(asset.children || []).some(c => c.id === a.id))
                  .map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({assetTypeLabel(a.asset_type)})</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Tags</label>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {asset.tags?.map(t => (
                  <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/5 border border-border text-text-secondary">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    {t.name}
                    <button onClick={() => removeTagFromAsset(t.id)} className="text-text-muted hover:text-red-400 transition-colors ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTagDropdown(!showTagDropdown)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-accent hover:bg-accent/10 transition-colors border border-dashed border-accent/40"
                  >
                    <Plus className="w-3 h-3" /> Add tag
                  </button>
                  {showTagDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-xl z-50 w-56">
                      {availableTags.length > 0 && (
                        <div className="max-h-40 overflow-y-auto">
                          {availableTags.map(t => (
                            <button key={t.id} onClick={() => addTagToAsset(t.id)} className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-accent/5 transition-colors flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                              {t.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {availableTags.length === 0 && !showCreateTag && (
                        <div className="px-3 py-2 text-xs text-text-muted">No more tags</div>
                      )}
                      <div className="border-t border-border">
                        {showCreateTag ? (
                          <div className="p-2 space-y-2">
                            <input className="input py-1 text-xs" placeholder="Tag name..." value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAndAddTag()} autoFocus />
                            <div className="flex gap-1">
                              {DEFAULT_TAG_COLORS.map(c => (
                                <button key={c} onClick={() => setNewTagColor(c)} className={`w-5 h-5 rounded-full border-2 transition-colors ${newTagColor === c ? 'border-text-primary' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={createAndAddTag} className="btn-primary text-xs py-1 px-2">Create</button>
                              <button onClick={() => setShowCreateTag(false)} className="btn-secondary text-xs py-1 px-2">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setShowCreateTag(true)} className="w-full text-left px-3 py-2 text-xs text-accent hover:bg-accent/5 transition-colors flex items-center gap-1.5">
                            <Plus className="w-3 h-3" /> Create new tag
                          </button>
                        )}
                      </div>
                      <div className="border-t border-border">
                        <button onClick={() => { setShowTagDropdown(false); setShowCreateTag(false); }} className="w-full text-center px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors">Close</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => { setEditing(false); setShowTagDropdown(false); }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Asset info — hidden while edit form is open */}
      {!editing && (
      <div className="card mb-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-muted shrink-0">Name:</span>
            <span className="text-text-secondary truncate">{asset.name}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-muted shrink-0">Target:</span>
            <span className="text-text-secondary font-mono text-xs truncate">{asset.target || '—'}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-muted shrink-0">Type:</span>
            <span className="text-text-secondary truncate">{assetTypeLabel(asset.asset_type)}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-muted shrink-0">OS:</span>
            <span className="text-text-secondary truncate">{asset.os || '—'}</span>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-muted shrink-0">Ports:</span>
            <span className="text-text-secondary font-mono text-xs truncate">{asset.ports_summary || '—'}</span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-muted shrink-0">Parent:</span>
            {asset.parent_asset_id ? (
              <button
                onClick={() => navigate(`/e/${id}/assets/${asset.parent_asset_id}`, { state: { from: `/e/${id}/assets/${assetId}`, fromLabel: asset.name } })}
                className="text-accent hover:underline text-xs truncate"
              >
                {allEngagementAssets.find(a => a.id === asset.parent_asset_id)?.name || `Asset #${asset.parent_asset_id}`}
              </button>
            ) : (
              <span className="text-text-muted text-xs">—</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap col-span-1">
            <span className="text-text-muted shrink-0">Tags:</span>
            {asset.tags?.length
              ? asset.tags.map(t => <TagBadge key={t.id} tag={t} />)
              : <span className="text-text-muted text-xs">—</span>}
          </div>
        </div>
      </div>
      )}

      {asset.asset_type === 'host' && (
        <ReconRecommendations portsSummary={asset.ports_summary} target={asset.target} />
      )}

      {/* Linked Assets */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Linked Assets
          </h2>
          <button
            onClick={() => { setShowCreateLinked(v => !v); setLinkedForm({ name: '', asset_type: 'host', target: '', os: '' }); }}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New Linked Asset
          </button>
        </div>

        {showCreateLinked && (
          <div className="card mb-3">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={linkedForm.name} onChange={(e) => setLinkedForm({ ...linkedForm, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={linkedForm.asset_type} onChange={(e) => setLinkedForm({ ...linkedForm, asset_type: e.target.value })}>
                  {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Target (IP / URL)</label>
                <input className="input font-mono text-sm" value={linkedForm.target} onChange={(e) => setLinkedForm({ ...linkedForm, target: e.target.value })} />
              </div>
              <div>
                <label className="label">OS</label>
                <input className="input" value={linkedForm.os} onChange={(e) => setLinkedForm({ ...linkedForm, os: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateLinked} className="btn-primary text-sm">Create</button>
              <button onClick={() => setShowCreateLinked(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}

        {asset.children && asset.children.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <AssetTree
              parentId={parseInt(assetId)}
              allAssets={allEngagementAssets}
              depth={0}
              engagementId={id}
              navigate={navigate}
              currentAssetName={asset.name}
              currentAssetId={parseInt(assetId)}
            />
          </div>
        ) : (
          !showCreateLinked && <p className="text-sm text-text-muted">No linked assets yet.</p>
        )}
      </div>

      {/* Linked Findings */}
      <div className="mb-6">
        <h2 className="text-base font-medium mb-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Linked Findings
        </h2>
        {linkedFindings.length === 0 ? (
          <p className="text-sm text-text-muted">No findings linked to this asset yet.</p>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Severity</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Phase</th>
                </tr>
              </thead>
              <tbody>
                {linkedFindings.map((f) => (
                  <tr
                    key={f.id}
                    className="table-row cursor-pointer"
                    onClick={() => navigate(`/e/${id}/findings/${f.id}`, { state: { from: `/e/${id}/assets/${assetId}`, fromLabel: asset?.name || 'Asset' } })}
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-text-primary">{f.title}</td>
                    <td className="px-4 py-2.5"><SeverityBadge severity={f.severity} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">{f.phase || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked Credentials */}
      <div className="mb-6">
        <h2 className="text-base font-medium mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Linked Credentials
        </h2>
        {linkedCredentials.length === 0 ? (
          <p className="text-sm text-text-muted">No credentials linked to this asset yet.</p>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Username</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Secret</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Access Level</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Source</th>
                </tr>
              </thead>
              <tbody>
                {linkedCredentials.map((c) => (
                  <tr key={c.id} className="table-row cursor-pointer" onClick={() => navigate(`/e/${id}/credentials/${c.id}`, { state: { from: `/e/${id}/assets/${assetId}`, fromLabel: asset?.name || 'Asset' } })}>
                    <td className="px-4 py-2.5 text-sm font-mono text-text-primary">{c.username || '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary">{revealedCreds[c.id] ? c.secret : '••••••••'}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRevealedCreds(prev => ({ ...prev, [c.id]: !prev[c.id] })); }}
                          className="text-text-muted hover:text-text-primary transition-colors"
                          title={revealedCreds[c.id] ? 'Hide' : 'Reveal'}
                        >
                          {revealedCreds[c.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span className="px-2 py-0.5 rounded text-xs bg-accent/10 text-accent">{c.secret_type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">{c.access_level || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">{c.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes — full width; saved notes first, composer below */}
      <div className="mb-8">
        <h2 className="text-base font-medium mb-3 flex items-center gap-2"><StickyNote className="w-4 h-4" /> Notes</h2>
        {notes.length > 1 && (
          <input
            type="text"
            className="input text-sm mb-3"
            placeholder="Filter notes…"
            value={noteFilter}
            onChange={(e) => setNoteFilter(e.target.value)}
          />
        )}
        <div className="space-y-3 mb-6">
          {notes.filter((n) => {
            if (!noteFilter.trim()) return true;
            const t = (n.body || '').toLowerCase();
            return noteFilter.toLowerCase().split(/\s+/).every((w) => t.includes(w));
          }).map((n) => {
            const isExpanded = expandedNotes.has(n.id);
            const isEditing = editingNote === n.id;
            const firstLine = (() => {
              const line = (n.body || '').split('\n').find((l) => l.trim()) || '';
              return line.replace(/^#{1,6}\s*/, '').replace(/[*_`~[\]]/g, '').trim().slice(0, 160) || 'Empty note';
            })();
            const toggleExpand = () =>
              setExpandedNotes((prev) => {
                const next = new Set(prev);
                next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                return next;
              });
            return (
              <div key={n.id} className="card overflow-hidden">
                {/* Collapse header — always visible */}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={toggleExpand}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-muted" />
                      : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-text-muted" />}
                    <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{firstLine}</span>
                    <span className="shrink-0 text-2xs text-text-muted">{new Date(n.created_at).toLocaleString()}</span>
                  </button>
                )}
                {/* Expanded / editing body */}
                {(isExpanded || isEditing) && (
                  <div className={!isEditing ? 'mt-3 border-t border-border pt-3' : ''}>
                    {isEditing ? (
                      <div>
                        <MarkdownEditor
                          value={editingNoteBody}
                          onChange={setEditingNoteBody}
                          minHeight="120px"
                          id={`note-edit-${n.id}`}
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => updateNote(n.id, editingNoteBody)} className="btn-primary text-xs">Save</button>
                          <button onClick={() => { setEditingNote(null); setEditingNoteBody(''); }} className="btn-secondary text-xs">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <MarkdownViewer content={n.body} />
                        <div className="flex items-center justify-end mt-2 pt-2 border-t border-border gap-2">
                          <button onClick={() => { setEditingNote(n.id); setEditingNoteBody(n.body); }} className="btn-ghost text-xs">Edit</button>
                          <button onClick={() => deleteNote(n.id)} className="text-text-muted hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {notes.length === 0 && <p className="text-sm text-text-muted">No notes yet</p>}
        </div>
        <div>
          <label className="label block mb-1">New note (Markdown)</label>
          <MarkdownEditor
            key={newNoteEditorKey}
            value={newNote}
            onChange={setNewNote}
            placeholder="Write a note (markdown supported)..."
            minHeight="140px"
          />
          <button type="button" onClick={addNote} className="btn-primary text-sm flex items-center gap-2 mt-2">
            <Plus className="w-3.5 h-3.5" /> Add Note
          </button>
        </div>
      </div>

      {/* Attachments — below notes */}
      <AttachmentGallery
        attachments={screenshots}
        onUpload={uploadFile}
        onDelete={deleteFile}
      />

      {/* Asset Assistant — LLM chat contextualised to this asset */}
      <div className="mt-10">
      <AssetChat
        assetId={assetId}
        asset={asset}
        linkedFindings={linkedFindings}
        linkedCredentials={linkedCredentials}
        notes={notes}
        onNoteAdded={load}
      />
      </div>
    </div>
  );
}
