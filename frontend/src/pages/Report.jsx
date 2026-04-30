import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import SeverityBadge from '../components/SeverityBadge';
import { FileText, Download, Loader2, Eye, EyeOff, CheckSquare, Square, RefreshCw } from 'lucide-react';

export default function Report() {
  const { id } = useParams();
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [findings, setFindings] = useState([]);
  const [excluded, setExcluded] = useState(new Set());
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    api.get(`/engagements/${id}/findings`)
      .then(({ data }) => setFindings(data))
      .catch(() => {});
  }, [id]);

  const toggleExclude = (fid) => {
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(fid) ? next.delete(fid) : next.add(fid);
      return next;
    });
  };

  const toggleAll = () => {
    if (excluded.size === findings.length) {
      setExcluded(new Set());
    } else {
      setExcluded(new Set(findings.map(f => f.id)));
    }
  };

  const excludedList = [...excluded];

  const loadPreview = async () => {
    setPreviewLoading(true);
    setShowPreview(true);
    try {
      const params = excludedList.length ? `?excluded_ids=${excludedList.join(',')}` : '';
      const { data } = await api.get(`/engagements/${id}/report/preview${params}`);
      setPreviewHtml(data);
    } catch (err) { toast.error(err.message); }
    setPreviewLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post(`/engagements/${id}/report`, { excluded_finding_ids: excludedList });
      toast.success('Report generated');
      setGenerated(true);
    } catch (err) { toast.error(err.message); }
    setGenerating(false);
  };

  const handleDownload = (format) => {
    window.open(`/api/engagements/${id}/report/download?format=${format}`, '_blank');
  };

  const includedCount = findings.length - excluded.size;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><FileText className="w-5 h-5" /> Report</h1>
      </div>

      {/* Finding inclusion */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium">
            Findings to Include
            <span className="ml-2 text-sm font-normal text-text-muted">({includedCount} of {findings.length})</span>
          </h2>
          {findings.length > 0 && (
            <button onClick={toggleAll} className="btn-ghost text-xs">
              {excluded.size === findings.length ? 'Include all' : 'Exclude all'}
            </button>
          )}
        </div>
        {findings.length === 0 ? (
          <p className="text-sm text-text-muted">No findings in this engagement.</p>
        ) : (
          <div className="space-y-1.5">
            {findings.map(f => {
              const isExcluded = excluded.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleExclude(f.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                    isExcluded
                      ? 'border-border bg-transparent opacity-50'
                      : 'border-border bg-input hover:border-accent/40'
                  }`}
                >
                  {isExcluded
                    ? <Square className="w-4 h-4 text-text-muted shrink-0" />
                    : <CheckSquare className="w-4 h-4 text-accent shrink-0" />}
                  <span className="flex-1 text-sm text-text-primary truncate">{f.title}</span>
                  <SeverityBadge severity={f.severity} />
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    f.status === 'draft' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-accent/10 text-accent'
                  }`}>{f.status}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <button onClick={loadPreview} disabled={previewLoading} className="btn-secondary flex items-center gap-2">
            {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Preview
          </button>
          <button onClick={handleGenerate} disabled={generating || includedCount === 0} className="btn-primary flex items-center gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="card mb-4 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-sm font-medium">Preview</span>
            <div className="flex gap-2">
              <button onClick={loadPreview} disabled={previewLoading} className="btn-ghost text-xs flex items-center gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button onClick={() => setShowPreview(false)} className="btn-ghost text-xs flex items-center gap-1">
                <EyeOff className="w-3.5 h-3.5" /> Hide
              </button>
            </div>
          </div>
          {previewLoading ? (
            <div className="flex items-center justify-center py-16 text-text-muted">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading preview...
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              srcDoc={previewHtml}
              className="w-full border-0"
              style={{ height: '720px' }}
              title="Report Preview"
              sandbox="allow-same-origin"
            />
          )}
        </div>
      )}

      {/* Download */}
      {generated && (
        <div className="card mb-4">
          <h2 className="text-base font-medium mb-3">Download Report</h2>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => handleDownload('md')} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> Markdown (.md)
            </button>
            <button onClick={() => handleDownload('html')} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> HTML (.html)
            </button>
            <button onClick={() => handleDownload('pdf')} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> PDF (.pdf)
            </button>
          </div>
          <p className="text-xs text-text-muted mt-3">
            HTML and PDF exports are styled and print-ready. Markdown can be further edited in any text editor.
          </p>
        </div>
      )}

      <div className="card">
        <h2 className="text-base font-medium mb-3">Report Checklist</h2>
        <div className="space-y-2 text-sm text-text-secondary">
          <p>Before generating, ensure you have:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Defined the engagement scope (in-scope and out-of-scope)</li>
            <li>Created findings with complete descriptions, impact, and remediation</li>
            <li>Assigned CVSS scores to all findings</li>
            <li>Attached evidence screenshots to findings</li>
            <li>Documented client info and rules of engagement</li>
            <li>Completed methodology checklists</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
