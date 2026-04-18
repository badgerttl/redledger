import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import MarkdownViewer from '../components/MarkdownViewer';
import MarkdownEditor from '../components/MarkdownEditor';
import TagBadge from '../components/TagBadge';
import AttachmentGallery from '../components/AttachmentGallery';
import { ArrowLeft, Plus, Trash2, StickyNote, Pencil, Check, X, Copy } from 'lucide-react';
import ReconRecommendations from '../components/ReconRecommendations';

const DEFAULT_TAG_COLORS = ['#6366f1', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function AssetDetail() {
  const { id, assetId } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [notes, setNotes] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [editingNoteBody, setEditingNoteBody] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [showCreateTag, setShowCreateTag] = useState(false);

  const load = async () => {
    try {
      const [a, n, s, t] = await Promise.all([
        api.get(`/assets/${assetId}`),
        api.get(`/assets/${assetId}/notes`),
        api.get(`/assets/${assetId}/screenshots`),
        api.get('/tags'),
      ]);
      setAsset(a.data);
      setNotes(n.data);
      setScreenshots(s.data);
      setAllTags(t.data);
    } catch { /* empty */ }
  };

  useEffect(() => { load(); }, [assetId]);

  const startEditField = (field) => {
    setEditingField(field);
    setEditValue(asset[field] || '');
  };

  const saveField = async () => {
    try {
      await api.patch(`/assets/${assetId}`, { [editingField]: editValue });
      setEditingField(null);
      load();
      toast.success('Updated');
    } catch { toast.error('Failed to update'); }
  };

  const cancelEditField = () => {
    setEditingField(null);
    setEditValue('');
  };

  const addTagToAsset = async (tagId) => {
    const currentIds = asset.tags?.map(t => t.id) || [];
    if (currentIds.includes(tagId)) return;
    try {
      await api.patch(`/assets/${assetId}`, { tag_ids: [...currentIds, tagId] });
      setShowTagDropdown(false);
      load();
      toast.success('Tag added');
    } catch { toast.error('Failed to add tag'); }
  };

  const removeTagFromAsset = async (tagId) => {
    const currentIds = asset.tags?.map(t => t.id) || [];
    try {
      await api.patch(`/assets/${assetId}`, { tag_ids: currentIds.filter(id => id !== tagId) });
      load();
    } catch { toast.error('Failed to remove tag'); }
  };

  const createAndAddTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const { data } = await api.post('/tags', { name: newTagName.trim(), color: newTagColor });
      setNewTagName('');
      setShowCreateTag(false);
      await addTagToAsset(data.id);
    } catch (err) {
      toast.error(err.response?.status === 409 ? 'Tag already exists' : 'Failed to create tag');
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.post(`/assets/${assetId}/notes`, { body: newNote });
      setNewNote('');
      load();
      toast.success('Note added');
    } catch { toast.error('Failed to add note'); }
  };

  const updateNote = async (noteId, body) => {
    try {
      await api.patch(`/notes/${noteId}`, { body });
      setEditingNote(null);
      load();
      toast.success('Note updated');
    } catch { toast.error('Failed to update note'); }
  };

  const deleteNote = async (noteId) => {
    try {
      await api.delete(`/notes/${noteId}`);
      load();
    } catch { toast.error('Failed to delete'); }
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
    } catch { toast.error('Upload failed'); }
  };

  const deleteFile = async (scId) => {
    try {
      await api.delete(`/screenshots/${scId}`);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const copyTarget = async () => {
    if (!asset?.target) return;
    try {
      await navigator.clipboard.writeText(asset.target);
      toast.success('Copied to clipboard');
    } catch { toast.error('Failed to copy'); }
  };

  if (!asset) return <div className="text-text-muted">Loading...</div>;

  const renderEditableField = (field, label, mono = false) => {
    if (editingField === field) {
      return (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-text-muted shrink-0">{label}:</span>
          <input
            className="input py-1 text-xs flex-1"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') cancelEditField(); }}
            autoFocus
          />
          <button onClick={saveField} className="text-green-400 hover:text-green-300 transition-colors">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={cancelEditField} className="text-text-muted hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 group/field">
        <span className="text-text-muted">{label}:</span>
        <span className={`text-text-secondary ${mono ? 'font-mono text-xs' : ''}`}>{asset[field] || '—'}</span>
        <button
          onClick={() => startEditField(field)}
          className="text-text-muted hover:text-accent transition-colors opacity-0 group-hover/field:opacity-100"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  };

  const assetTagIds = asset.tags?.map(t => t.id) || [];
  const availableTags = allTags.filter(t => !assetTagIds.includes(t.id));

  return (
    <div>
      <button onClick={() => navigate(`/e/${id}/assets`)} className="btn-ghost mb-4 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Assets
      </button>

      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">{asset.name}</h1>
            {asset.target && (
              <button
                onClick={copyTarget}
                className="text-text-muted hover:text-accent transition-colors p-1 rounded hover:bg-accent/10"
                title={`Copy ${asset.asset_type === 'host' ? 'IP address' : 'URL'}`}
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-text-muted mt-0.5">{asset.asset_type === 'host' ? 'Host' : 'Web Page'} · {asset.target}</p>
        </div>
      </div>

      {/* Asset info */}
      <div className="card mb-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          {renderEditableField('os', 'OS')}
          {renderEditableField('ports_summary', 'Ports', true)}
          <div className="relative">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-text-muted shrink-0">Tags:</span>
              {asset.tags?.map(t => (
                <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs bg-white/5 border border-border text-text-secondary group/tag">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  {t.name}
                  <button
                    onClick={() => removeTagFromAsset(t.id)}
                    className="opacity-0 group-hover/tag:opacity-100 text-text-muted hover:text-red-400 transition-all ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs text-accent hover:bg-accent/10 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {showTagDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-md shadow-xl z-50 w-56">
                {availableTags.length > 0 && (
                  <div className="max-h-40 overflow-y-auto">
                    {availableTags.map(t => (
                      <button
                        key={t.id}
                        onClick={() => addTagToAsset(t.id)}
                        className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-accent/5 transition-colors flex items-center gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                {availableTags.length === 0 && !showCreateTag && (
                  <div className="px-3 py-2 text-xs text-text-muted">No more tags available</div>
                )}
                <div className="border-t border-border">
                  {showCreateTag ? (
                    <div className="p-2 space-y-2">
                      <input
                        className="input py-1 text-xs"
                        placeholder="Tag name..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createAndAddTag()}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        {DEFAULT_TAG_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewTagColor(c)}
                            className={`w-5 h-5 rounded-full border-2 transition-colors ${newTagColor === c ? 'border-text-primary' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={createAndAddTag} className="btn-primary text-xs py-1 px-2">Create</button>
                        <button onClick={() => setShowCreateTag(false)} className="btn-secondary text-xs py-1 px-2">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCreateTag(true)}
                      className="w-full text-left px-3 py-2 text-xs text-accent hover:bg-accent/5 transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" /> Create new tag
                    </button>
                  )}
                </div>
                <div className="border-t border-border">
                  <button
                    onClick={() => { setShowTagDropdown(false); setShowCreateTag(false); }}
                    className="w-full text-center px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {asset.asset_type === 'host' && (
        <ReconRecommendations portsSummary={asset.ports_summary} target={asset.target} />
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Notes */}
        <div>
          <h2 className="text-base font-medium mb-3 flex items-center gap-2"><StickyNote className="w-4 h-4" /> Notes</h2>
          <div className="mb-4">
            <label className="label block mb-1">New note (Markdown)</label>
            <MarkdownEditor
              value={newNote}
              onChange={setNewNote}
              placeholder="Write a note (markdown supported)..."
              minHeight="140px"
            />
            <button onClick={addNote} className="btn-primary text-sm flex items-center gap-2 mt-2">
              <Plus className="w-3.5 h-3.5" /> Add Note
            </button>
          </div>
          <div className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="card">
                {editingNote === n.id ? (
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
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                      <span className="text-2xs text-text-muted">{new Date(n.created_at).toLocaleString()}</span>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingNote(n.id); setEditingNoteBody(n.body); }} className="btn-ghost text-xs">Edit</button>
                        <button onClick={() => deleteNote(n.id)} className="text-text-muted hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {notes.length === 0 && <p className="text-sm text-text-muted">No notes yet</p>}
          </div>
        </div>

        {/* Attachments */}
        <div>
          <AttachmentGallery
            attachments={screenshots}
            onUpload={uploadFile}
            onDelete={deleteFile}
          />
        </div>
      </div>
    </div>
  );
}
