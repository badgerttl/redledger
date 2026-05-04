import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import TagBadge from '../components/TagBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Plus,
  Server,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Network,
  Copy,
  ArrowDownWideNarrow,
  Hash,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Square,
  CheckSquare,
} from 'lucide-react';
import { ASSET_TYPES, assetTypeLabel, AssetIcon } from '../utils/assetTypes';

const ASSET_TYPE_ORDER = Object.fromEntries(ASSET_TYPES.map((t, i) => [t.value, i]));
const VALID_ASSET_TYPES = new Set(ASSET_TYPES.map((t) => t.value));

const CSV_TEMPLATE = `name,asset_type,target,os\nweb-app-prod,web_page,https://example.com,\ndb-server,host,10.10.10.5,Linux Ubuntu 22.04\napi-gateway,api_endpoint,https://api.example.com/v1,\nexample.com,domain,example.com,\n10.10.10.0/24,network,10.10.10.0/24,\nprod-db,database,10.10.10.20,\nmy-repo,git_repo,https://github.com/org/repo,\n`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'assets_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const typeIdx = header.indexOf('asset_type');
  const targetIdx = header.indexOf('target');
  const osIdx = header.indexOf('os');
  if (nameIdx === -1) return null; // bad header

  return lines.slice(1).map((line, i) => {
    const cols = line.split(',');
    const name = (cols[nameIdx] || '').trim();
    const asset_type = (cols[typeIdx] || '').trim() || 'host';
    const target = (cols[targetIdx] || '').trim();
    const os = (cols[osIdx] || '').trim();
    const errors = [];
    if (!name) errors.push('name required');
    if (!VALID_ASSET_TYPES.has(asset_type))
      errors.push(`invalid type "${asset_type}" — use: ${[...VALID_ASSET_TYPES].join(', ')}`);
    return { _row: i + 2, name, asset_type, target, os, errors };
  }).filter((r) => r.name || r.target); // skip blank rows
}

function CsvImportPanel({ engagementId, onDone, onClose }) {
  const [rows, setRows] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseCsv(ev.target.result);
      if (result === null) {
        setParseError('CSV must have a "name" column header.');
        setRows(null);
      } else {
        setParseError('');
        setRows(result);
      }
    };
    reader.readAsText(file);
  };

  const validRows = rows?.filter((r) => r.errors.length === 0) ?? [];
  const hasErrors = rows?.some((r) => r.errors.length > 0);

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    try {
      const { data } = await api.post(`/engagements/${engagementId}/assets/import`, {
        assets: validRows.map(({ name, asset_type, target, os }) => ({ name, asset_type, target, os })),
      });
      toast.success(`Imported ${data.imported} asset${data.imported !== 1 ? 's' : ''}`);
      onDone();
    } catch (err) { toast.error(err.message); }
    setImporting(false);
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium flex items-center gap-2">
          <Upload className="w-4 h-4" /> Import Assets from CSV
        </h2>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button type="button" onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Download Template
        </button>
        <span className="text-xs text-text-muted">Columns: name, asset_type, target, os — asset_type defaults to "host" if blank</span>
      </div>

      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors mb-4">
        <Upload className="w-5 h-5 text-text-muted" />
        <span className="text-sm text-text-muted">Click to select CSV file</span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </label>

      {parseError && (
        <div className="flex items-center gap-2 text-sm text-red-400 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" /> {parseError}
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-text-muted mb-4">No data rows found in file.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm text-text-secondary">
              <span className="text-text-primary font-medium">{rows.length}</span> row{rows.length !== 1 ? 's' : ''} parsed
              {hasErrors && <span className="text-yellow-500 ml-2">· {rows.filter(r => r.errors.length).length} with errors (will be skipped)</span>}
            </p>
          </div>
          <div className="card p-0 overflow-hidden overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-text-muted font-medium">#</th>
                  <th className="text-left px-3 py-2 text-text-muted font-medium">Name</th>
                  <th className="text-left px-3 py-2 text-text-muted font-medium">Type</th>
                  <th className="text-left px-3 py-2 text-text-muted font-medium">Target</th>
                  <th className="text-left px-3 py-2 text-text-muted font-medium">OS</th>
                  <th className="text-left px-3 py-2 text-text-muted font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._row} className={`border-b border-border last:border-0 ${r.errors.length ? 'bg-red-500/5' : ''}`}>
                    <td className="px-3 py-1.5 text-text-muted">{r._row}</td>
                    <td className="px-3 py-1.5 font-medium text-text-primary">{r.name || '—'}</td>
                    <td className="px-3 py-1.5 text-text-secondary">{r.asset_type}</td>
                    <td className="px-3 py-1.5 font-mono text-text-secondary">{r.target || '—'}</td>
                    <td className="px-3 py-1.5 text-text-secondary">{r.os || '—'}</td>
                    <td className="px-3 py-1.5">
                      {r.errors.length
                        ? <span className="flex items-center gap-1 text-red-400"><AlertCircle className="w-3 h-3 shrink-0" />{r.errors.join(', ')}</span>
                        : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleImport}
          disabled={importing || !validRows.length}
          className="btn-primary flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {importing ? 'Importing…' : `Import ${validRows.length} Asset${validRows.length !== 1 ? 's' : ''}`}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

function tagsSortKey(asset) {
  const tags = asset.tags;
  if (!tags?.length) return '';
  return tags
    .map((t) => t.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .join(', ');
}

function PortGroup({ group, engagementId, navigate, onCopyTarget }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-white/5 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-accent shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />}
        <Network className="w-4 h-4 text-text-muted shrink-0" />
        <span className="font-mono text-xs text-accent">{group.port}/{group.protocol}</span>
        {group.service && <span className="text-text-secondary">— {group.service}</span>}
        <span className="ml-auto text-2xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">{group.assets.length} host{group.assets.length !== 1 ? 's' : ''}</span>
      </button>
      {expanded && (
        <div className="border-t border-border">
          {group.assets.map(a => (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/e/${engagementId}/assets/${a.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/e/${engagementId}/assets/${a.id}`)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-white/5 transition-colors text-left border-b border-border last:border-b-0 cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-text-muted shrink-0 ml-6" />
              <span className="text-text-primary">{a.name}</span>
              <span className="font-mono text-xs text-text-muted">{a.target}</span>
              {a.target && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onCopyTarget(e, a.target); }}
                  className="text-text-muted hover:text-accent transition-colors p-0.5 rounded hover:bg-accent/10 shrink-0"
                  title="Copy target"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
              {a.os && <span className="text-2xs text-text-muted ml-auto">{a.os}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortsView({ portGroups, engagementId, navigate, onCopyTarget, emptyMessage }) {
  if (portGroups.length === 0) {
    return (
      <div className="card py-8 text-center text-sm text-text-muted">
        {emptyMessage ?? 'No ports discovered yet. Add ports to host assets or import an Nmap scan.'}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {portGroups.map(g => (
        <PortGroup key={`${g.port}-${g.protocol}`} group={g} engagementId={engagementId} navigate={navigate} onCopyTarget={onCopyTarget} />
      ))}
    </div>
  );
}

export default function Assets() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('type') || 'all';
  const setFilter = (type) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (type && type !== 'all') next.set('type', type);
      else next.delete('type');
      return next;
    });
    setTagFilter(new Set());
    setSelectedIds(new Set());
  };

  const [assets, setAssets] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ name: '', asset_type: 'host', target: '', os: '' });
  const [portSort, setPortSort] = useState('port');
  const [portSearch, setPortSearch] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh(r => r + 1);

  const [expandedIds, setExpandedIds] = useState(new Set());
  const toggleExpanded = (aid) => setExpandedIds(prev => { const n = new Set(prev); n.has(aid) ? n.delete(aid) : n.add(aid); return n; });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkType, setBulkType] = useState('');
  const [bulkOs, setBulkOs] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [tagFilter, setTagFilter] = useState(new Set());
  const [allTags, setAllTags] = useState([]);
  const [bulkNewTagName, setBulkNewTagName] = useState('');
  const [bulkNewTagColor, setBulkNewTagColor] = useState('#6366f1');
  const [showBulkNewTag, setShowBulkNewTag] = useState(false);

  const TAG_COLORS = ['#6366f1', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [{ data: assetData }, { data: tagData }] = await Promise.all([
          api.get(`/engagements/${id}/assets`, { signal: controller.signal }),
          api.get('/tags', { signal: controller.signal }),
        ]);
        setAssets(assetData);
        setAllTags(tagData);
      } catch (err) {
        if (err.name !== 'CanceledError') toast.error(err.message);
      }
    };
    load();
    return () => controller.abort();
  }, [id, refresh]);

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      await api.post(`/engagements/${id}/assets`, form);
      toast.success('Asset created');
      setShowCreate(false);
      setForm({ name: '', asset_type: 'host', target: '', os: '' });
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const confirmDelete = async (assetId) => {
    try {
      await api.delete(`/assets/${assetId}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      reload();
    } catch (err) { toast.error(err.message); }
  };

  const copyTarget = async (e, target) => {
    e.stopPropagation();
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      toast.success('Copied to clipboard');
    } catch { toast.error('Failed to copy'); }
  };

  const toggleSelect = (aid) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(aid) ? next.delete(aid) : next.add(aid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === assetsForTable.length
        ? new Set()
        : new Set(assetsForTable.map((a) => a.id))
    );
  };

  const applyBulkPatch = async (patch) => {
    if (!selectedIds.size) return;
    setBulkWorking(true);
    try {
      await Promise.all([...selectedIds].map((aid) => api.patch(`/assets/${aid}`, patch)));
      toast.success(`Updated ${selectedIds.size} asset${selectedIds.size !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setBulkType('');
      setBulkOs('');
      reload();
    } catch (err) { toast.error(err.message); }
    setBulkWorking(false);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkWorking(true);
    try {
      await Promise.all([...selectedIds].map((aid) => api.delete(`/assets/${aid}`)));
      toast.success(`Deleted ${selectedIds.size} asset${selectedIds.size !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      reload();
    } catch (err) { toast.error(err.message); }
    setBulkWorking(false);
  };

  const handleBulkAddTag = async (tagId) => {
    if (!selectedIds.size || !tagId) return;
    setBulkWorking(true);
    try {
      const selected = assets.filter((a) => selectedIds.has(a.id));
      await Promise.all(selected.map((a) => {
        const ids = (a.tags || []).map((t) => t.id);
        if (ids.includes(tagId)) return Promise.resolve();
        return api.patch(`/assets/${a.id}`, { tag_ids: [...ids, tagId] });
      }));
      toast.success(`Tag added to ${selectedIds.size} asset${selectedIds.size !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      reload();
    } catch (err) { toast.error(err.message); }
    setBulkWorking(false);
  };

  const handleBulkRemoveTag = async (tagId) => {
    if (!selectedIds.size || !tagId) return;
    setBulkWorking(true);
    try {
      const selected = assets.filter((a) => selectedIds.has(a.id));
      await Promise.all(selected.map((a) => {
        const ids = (a.tags || []).map((t) => t.id);
        if (!ids.includes(tagId)) return Promise.resolve();
        return api.patch(`/assets/${a.id}`, { tag_ids: ids.filter((i) => i !== tagId) });
      }));
      toast.success(`Tag removed from ${selectedIds.size} asset${selectedIds.size !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      reload();
    } catch (err) { toast.error(err.message); }
    setBulkWorking(false);
  };

  const handleBulkCreateAndAddTag = async () => {
    if (!bulkNewTagName.trim()) return;
    setBulkWorking(true);
    try {
      const { data: tag } = await api.post('/tags', { name: bulkNewTagName.trim(), color: bulkNewTagColor });
      setAllTags((prev) => [...prev, tag]);
      setBulkNewTagName('');
      setShowBulkNewTag(false);
      const selected = assets.filter((a) => selectedIds.has(a.id));
      await Promise.all(selected.map((a) => {
        const ids = (a.tags || []).map((t) => t.id);
        return api.patch(`/assets/${a.id}`, { tag_ids: [...ids, tag.id] });
      }));
      toast.success(`Tag "${tag.name}" created and added`);
      setSelectedIds(new Set());
      reload();
    } catch (err) { toast.error(err.message); }
    setBulkWorking(false);
  };

  const typeFilteredAssets = useMemo(() => {
    if (filter === 'ports') return [];
    if (filter === 'all') return assets;
    return assets.filter((a) => a.asset_type === filter);
  }, [assets, filter]);

  const assetsForTable = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    let list = typeFilteredAssets;
    if (tagFilter.size > 0) {
      list = list.filter((a) => {
        const assetTagIds = new Set((a.tags || []).map((t) => t.id));
        return [...tagFilter].every((tid) => assetTagIds.has(tid));
      });
    }
    if (q) {
      list = list.filter((a) => {
        const name = (a.name || '').toLowerCase();
        const target = (a.target || '').toLowerCase();
        return name.includes(q) || target.includes(q);
      });
    }
    const mul = sortDir === 'asc' ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
          break;
        case 'type':
          cmp = (ASSET_TYPE_ORDER[a.asset_type] ?? 99) - (ASSET_TYPE_ORDER[b.asset_type] ?? 99);
          break;
        case 'target':
          cmp = (a.target || '').localeCompare(b.target || '', undefined, { numeric: true, sensitivity: 'base' });
          break;
        case 'os':
          cmp = (a.os || '').localeCompare(b.os || '', undefined, { sensitivity: 'base' });
          break;
        case 'tags':
          cmp = tagsSortKey(a).localeCompare(tagsSortKey(b), undefined, { sensitivity: 'base' });
          break;
        default:
          return 0;
      }
      if (cmp !== 0) return cmp * mul;
      return a.id - b.id;
    });
    return sorted;
  }, [typeFilteredAssets, assetSearch, sortKey, sortDir]);

  const isTreeMode = filter === 'all' && !assetSearch.trim() && tagFilter.size === 0;

  const assetIdSet = useMemo(() => new Set(assets.map(a => a.id)), [assets]);

  const rootAssets = useMemo(() => {
    if (!isTreeMode) return [];
    return [...assets]
      .filter(a => !a.parent_asset_id || !assetIdSet.has(a.parent_asset_id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [assets, assetIdSet, isTreeMode]);

  const tagsInView = useMemo(() => {
    const map = new Map();
    for (const a of typeFilteredAssets) {
      for (const t of (a.tags || [])) {
        if (!map.has(t.id)) map.set(t.id, t);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [typeFilteredAssets]);

  const toggleColumnSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const portGroups = useMemo(() => {
    const map = {};
    for (const a of assets) {
      if (a.asset_type !== 'host' || !a.ports_summary) continue;
      const entries = a.ports_summary.split(',').map(s => s.trim()).filter(Boolean);
      for (const entry of entries) {
        const m = entry.match(/^(\d+)\s*\/\s*(tcp|udp)\s*(?:\(([^)]*)\))?/i);
        if (!m) continue;
        const key = `${m[1]}/${m[2]}`;
        const service = (m[3] || '').trim();
        if (!map[key]) map[key] = { port: parseInt(m[1], 10), protocol: m[2].toLowerCase(), service, assets: [] };
        if (!map[key].service && service) map[key].service = service;
        if (!map[key].assets.some((x) => x.id === a.id)) map[key].assets.push(a);
      }
    }
    let groups = Object.values(map);
    const q = portSearch.trim().toLowerCase();
    if (q) {
      groups = groups.filter((g) => {
        const portStr = String(g.port);
        const label = `${g.port}/${g.protocol}`.toLowerCase();
        const svc = (g.service || '').toLowerCase();
        return portStr.includes(q) || label.includes(q) || svc.includes(q);
      });
    }
    if (portSort === 'hosts') {
      groups.sort((a, b) => b.assets.length - a.assets.length || a.port - b.port || a.protocol.localeCompare(b.protocol));
    } else {
      groups.sort((a, b) => a.port - b.port || a.protocol.localeCompare(b.protocol));
    }
    return groups;
  }, [assets, portSort, portSearch]);

  const renderAssetRow = (a, depth, hasChildren) => {
    const isExpanded = expandedIds.has(a.id);
    return (
      <tr
        key={a.id}
        className={`table-row cursor-pointer ${selectedIds.has(a.id) ? 'bg-accent/5' : ''}`}
        onClick={() => navigate(`/e/${id}/assets/${a.id}`, { state: { from: `/e/${id}/assets`, fromLabel: 'Assets' } })}
      >
        <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(a.id); }}>
          {selectedIds.has(a.id)
            ? <CheckSquare className="w-4 h-4 text-accent" />
            : <Square className="w-4 h-4 text-text-muted hover:text-text-primary transition-colors" />}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-text-primary">
          <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 20}px` }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleExpanded(a.id); }}
                className="text-text-muted hover:text-accent transition-colors shrink-0 p-0.5 rounded hover:bg-accent/10"
              >
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              depth > 0 && <span className="w-4 shrink-0 text-border text-xs select-none">└</span>
            )}
            <AssetIcon type={a.asset_type} className="w-4 h-4 text-text-muted shrink-0" />
            <span>{a.name}</span>
            {a.target && (
              <button
                onClick={(e) => copyTarget(e, a.target)}
                className="text-text-muted hover:text-accent transition-colors p-0.5 rounded hover:bg-accent/10"
                title="Copy target"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-text-secondary">{assetTypeLabel(a.asset_type)}</td>
        <td className="px-4 py-3 text-sm text-text-secondary font-mono">{a.target}</td>
        <td className="px-4 py-3 text-sm text-text-secondary">{a.os || '—'}</td>
        <td className="px-4 py-3">
          <div className="flex gap-1 flex-wrap">{a.tags?.map((t) => <TagBadge key={t.id} tag={t} />)}</div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(a.id); }}
            className="text-text-muted hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  };

  const renderTreeRows = (items, allAssets, depth) => {
    return items.flatMap(a => {
      const children = allAssets
        .filter(c => c.parent_asset_id === a.id)
        .sort((x, y) => (x.name || '').localeCompare(y.name || '', undefined, { sensitivity: 'base' }));
      const hasChildren = children.length > 0;
      const isExpanded = expandedIds.has(a.id);
      const rows = [renderAssetRow(a, depth, hasChildren)];
      if (hasChildren && isExpanded) {
        rows.push(...renderTreeRows(children, allAssets, depth + 1));
      }
      return rows;
    });
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Assets</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(true); setShowCreate(false); }}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => { setShowCreate(true); setShowImport(false); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Asset
          </button>
        </div>
      </div>

      {showImport && (
        <CsvImportPanel
          engagementId={id}
          onDone={() => { setShowImport(false); reload(); }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-base font-medium mb-4">Add Asset</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}>
                {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className="label">Target (IP/URL)</label><input className="input" placeholder="10.10.10.1 or https://..." value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
            <div><label className="label">OS</label><input className="input" placeholder="e.g. Linux, Windows..." value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-3 flex-wrap">
        {['all', ...ASSET_TYPES.map(t => t.value), 'ports'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn-ghost ${filter === f ? 'bg-accent/10 text-accent' : ''}`}
          >
            {f === 'all' ? 'All' : f === 'ports' ? 'Ports' : assetTypeLabel(f) + 's'}
          </button>
        ))}
        <span className="text-xs text-text-muted self-center ml-2">
          {filter === 'ports' ? `${portGroups.length} port(s)` : `${assetsForTable.length} asset(s)`}
        </span>
      </div>

      {tagsInView.length > 0 && filter !== 'ports' && (
        <div className="flex gap-1.5 flex-wrap items-center mb-4">
          <span className="text-xs text-text-muted">Tags:</span>
          {tagsInView.map((t) => {
            const active = tagFilter.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTagFilter((prev) => {
                  const next = new Set(prev);
                  active ? next.delete(t.id) : next.add(t.id);
                  return next;
                })}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  active
                    ? 'border-transparent text-white'
                    : 'border-border text-text-muted hover:border-accent/50 hover:text-text-secondary'
                }`}
                style={active ? { backgroundColor: t.color } : {}}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.6)' : t.color }}
                />
                {t.name}
              </button>
            );
          })}
          {tagFilter.size > 0 && (
            <button
              type="button"
              onClick={() => setTagFilter(new Set())}
              className="btn-ghost text-xs text-text-muted flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}

      {filter === 'ports' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[200px] flex-1 max-w-md">
              <label className="label" htmlFor="ports-filter">Filter ports</label>
              <input
                id="ports-filter"
                type="search"
                className="input font-mono text-sm"
                placeholder="e.g. 443, ssh, tcp"
                value={portSearch}
                onChange={(e) => setPortSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <span className="label block">Sort by</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPortSort('port')}
                  className={`btn-ghost flex items-center gap-1.5 text-xs ${portSort === 'port' ? 'bg-accent/10 text-accent' : ''}`}
                  title="Lowest port number first"
                >
                  <Hash className="w-3.5 h-3.5" /> Port
                </button>
                <button
                  type="button"
                  onClick={() => setPortSort('hosts')}
                  className={`btn-ghost flex items-center gap-1.5 text-xs ${portSort === 'hosts' ? 'bg-accent/10 text-accent' : ''}`}
                  title="Most hosts first"
                >
                  <ArrowDownWideNarrow className="w-3.5 h-3.5" /> Host count
                </button>
              </div>
            </div>
          </div>
          <PortsView
            portGroups={portGroups}
            engagementId={id}
            navigate={navigate}
            onCopyTarget={copyTarget}
            emptyMessage={portSearch.trim() ? 'No ports match this filter. Try another port number or service name.' : undefined}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-w-md">
            <label className="label" htmlFor="assets-filter">
              Filter by name or address
            </label>
            <input
              id="assets-filter"
              type="search"
              className="input font-mono text-sm"
              placeholder="Hostname, IP, or URL substring…"
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="card mb-3 overflow-visible">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-text-primary">
                  {selectedIds.size} asset{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkWorking}
                    className="btn-ghost text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete selected
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedIds(new Set()); setBulkType(''); setBulkOs(''); setShowBulkNewTag(false); setBulkNewTagName(''); }}
                    className="btn-ghost text-xs text-text-muted flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-3 grid grid-cols-3 gap-x-6 gap-y-3">
                {/* Asset Type */}
                <div>
                  <label className="label mb-1.5 block">Asset Type</label>
                  <div className="flex gap-2">
                    <select
                      className="input text-xs flex-1"
                      value={bulkType}
                      disabled={bulkWorking}
                      onChange={(e) => setBulkType(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => applyBulkPatch({ asset_type: bulkType })}
                      disabled={bulkWorking || !bulkType}
                      className="btn-primary text-xs px-3"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* OS */}
                <div>
                  <label className="label mb-1.5 block">Operating System</label>
                  <div className="flex gap-2">
                    <input
                      className="input text-xs flex-1"
                      placeholder="e.g. Windows, Linux…"
                      value={bulkOs}
                      disabled={bulkWorking}
                      onChange={(e) => setBulkOs(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && bulkOs.trim() && applyBulkPatch({ os: bulkOs.trim() })}
                    />
                    <button
                      type="button"
                      onClick={() => applyBulkPatch({ os: bulkOs.trim() })}
                      disabled={bulkWorking || !bulkOs.trim()}
                      className="btn-primary text-xs px-3"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="label mb-1.5 block">Tags</label>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      className="input text-xs flex-1 min-w-0"
                      defaultValue=""
                      disabled={bulkWorking}
                      onChange={(e) => { if (e.target.value) { handleBulkAddTag(parseInt(e.target.value)); e.target.value = ''; } }}
                    >
                      <option value="" disabled>Add tag…</option>
                      {allTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select
                      className="input text-xs flex-1 min-w-0"
                      defaultValue=""
                      disabled={bulkWorking || !allTags.length}
                      onChange={(e) => { if (e.target.value) { handleBulkRemoveTag(parseInt(e.target.value)); e.target.value = ''; } }}
                    >
                      <option value="" disabled>Remove tag…</option>
                      {allTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowBulkNewTag((v) => !v)}
                      className="btn-secondary text-xs px-2.5 flex items-center gap-1 shrink-0"
                      title="Create new tag"
                    >
                      <Plus className="w-3.5 h-3.5" /> New
                    </button>
                  </div>

                  {/* Inline new-tag form */}
                  {showBulkNewTag && (
                    <div className="mt-2 flex flex-col gap-2 p-3 rounded-lg bg-input border border-border">
                      <input
                        className="input text-xs"
                        placeholder="Tag name…"
                        value={bulkNewTagName}
                        autoFocus
                        onChange={(e) => setBulkNewTagName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBulkCreateAndAddTag()}
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setBulkNewTagColor(c)}
                            className="w-5 h-5 rounded-full transition-transform hover:scale-110 shrink-0"
                            style={{
                              backgroundColor: c,
                              outline: bulkNewTagColor === c ? `2px solid ${c}` : 'none',
                              outlineOffset: '2px',
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleBulkCreateAndAddTag}
                          disabled={bulkWorking || !bulkNewTagName.trim()}
                          className="btn-primary text-xs flex-1"
                        >
                          Create &amp; Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowBulkNewTag(false); setBulkNewTagName(''); }}
                          className="btn-ghost text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 px-4 py-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-text-muted hover:text-text-primary transition-colors"
                      title={selectedIds.size === assetsForTable.length && assetsForTable.length > 0 ? 'Deselect all' : 'Select all'}
                    >
                      {selectedIds.size === assetsForTable.length && assetsForTable.length > 0
                        ? <CheckSquare className="w-4 h-4 text-accent" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleColumnSort('name')}
                      className="inline-flex items-center gap-1 hover:text-text-primary transition-colors"
                    >
                      Name
                      {sortKey === 'name' && (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleColumnSort('type')}
                      className="inline-flex items-center gap-1 hover:text-text-primary transition-colors"
                    >
                      Type
                      {sortKey === 'type' && (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleColumnSort('target')}
                      className="inline-flex items-center gap-1 hover:text-text-primary transition-colors"
                    >
                      Target
                      {sortKey === 'target' && (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleColumnSort('os')}
                      className="inline-flex items-center gap-1 hover:text-text-primary transition-colors"
                    >
                      OS
                      {sortKey === 'os' && (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleColumnSort('tags')}
                      className="inline-flex items-center gap-1 hover:text-text-primary transition-colors"
                    >
                      Tags
                      {sortKey === 'tags' && (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                    </button>
                  </th>
                  <th className="w-10" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {isTreeMode ? (
                  rootAssets.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">No assets yet</td></tr>
                  ) : (
                    renderTreeRows(rootAssets, assets, 0)
                  )
                ) : (
                  <>
                    {assetsForTable.map((a) => renderAssetRow(a, 0, false))}
                    {typeFilteredAssets.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">No assets yet</td></tr>
                    )}
                    {typeFilteredAssets.length > 0 && assetsForTable.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">No assets match this filter. Try another name or address.</td></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Asset"
        message="Delete this asset and all associated data? This cannot be undone."
        onConfirm={() => confirmDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
