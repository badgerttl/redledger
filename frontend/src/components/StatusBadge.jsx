import clsx from 'clsx';

const COLORS = {
  draft: 'border-text-muted text-text-muted',
  confirmed: 'border-sev-medium text-sev-medium',
  reported: 'border-cyan-500 text-cyan-500',
  remediated: 'border-green-500 text-green-500',
  active: 'border-green-500 text-green-500',
  complete: 'border-text-muted text-text-muted',
};

export default function StatusBadge({ status }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', COLORS[status] || COLORS.draft)}>
      {status}
    </span>
  );
}
