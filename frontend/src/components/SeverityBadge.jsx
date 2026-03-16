import clsx from 'clsx';

const COLORS = {
  Critical: 'bg-sev-critical/20 text-sev-critical border-sev-critical/30',
  High: 'bg-sev-high/20 text-sev-high border-sev-high/30',
  Medium: 'bg-sev-medium/20 text-sev-medium border-sev-medium/30',
  Low: 'bg-sev-low/20 text-sev-low border-sev-low/30',
  Info: 'bg-sev-info/20 text-sev-info border-sev-info/30',
};

export default function SeverityBadge({ severity }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', COLORS[severity] || COLORS.Info)}>
      {severity}
    </span>
  );
}
