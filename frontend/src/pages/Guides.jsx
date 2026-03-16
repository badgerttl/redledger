import { useState, useEffect } from 'react';
import api from '../api/client';
import MarkdownViewer from '../components/MarkdownViewer';
import clsx from 'clsx';
import { BookOpen } from 'lucide-react';

export default function Guides() {
  const [phases, setPhases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/phases').then(({ data }) => {
      setPhases(data);
      if (data.length > 0) setSelected(data[0].slug);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.get(`/phases/${selected}/guide`).then(({ data }) => {
      setGuide(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selected]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><BookOpen className="w-5 h-5" /> Phase Guides</h1>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {phases.map((p) => (
          <button
            key={p.slug}
            onClick={() => setSelected(p.slug)}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors duration-150',
              selected === p.slug
                ? 'bg-accent text-white'
                : 'bg-card border border-border text-text-secondary hover:text-text-primary hover:border-text-muted'
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="text-text-muted py-8 text-center">Loading guide...</div>
        ) : guide ? (
          <MarkdownViewer content={guide.content} />
        ) : (
          <div className="text-text-muted py-8 text-center">Select a phase to view its guide</div>
        )}
      </div>
    </div>
  );
}
