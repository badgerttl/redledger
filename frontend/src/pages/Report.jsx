import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { FileText, Download, Loader2 } from 'lucide-react';

export default function Report() {
  const { id } = useParams();
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post(`/engagements/${id}/report`);
      toast.success('Report generated');
      setGenerated(true);
    } catch (err) { toast.error(err.message); }
    setGenerating(false);
  };

  const handleDownload = (format) => {
    window.open(`/api/engagements/${id}/report/download?format=${format}`, '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><FileText className="w-5 h-5" /> Report</h1>
      </div>

      <div className="card mb-6">
        <h2 className="text-base font-medium mb-3">Generate Report</h2>
        <p className="text-sm text-text-secondary mb-4">
          Generate a penetration test report based on all engagement data — scope, findings, methodology completion, and rules of engagement.
          Make sure all findings are complete with descriptions, impact, and remediation before generating.
        </p>
        <button onClick={handleGenerate} disabled={generating} className="btn-primary flex items-center gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {generated && (
        <div className="card">
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

      <div className="card mt-6">
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
