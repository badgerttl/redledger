/**
 * Context usage ring — explicit SVG strokes; `toolbar` lays out beside composer actions.
 */
export default function ContextUsageDonut({ used, limit, limitHint, variant = 'toolbar' }) {
  const safeLimit = Math.max(1024, limit || 1);
  const frac = Math.min(1, Math.max(0, used / safeLimit));
  const isToolbar = variant === 'toolbar';
  const r = isToolbar ? 14 : 18;
  const strokeW = isToolbar ? 3.5 : 4;
  const size = (r + strokeW) * 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - frac);

  const progressStroke =
    frac >= 0.98 ? '#f87171' : frac >= 0.85 ? '#fbbf24' : 'rgb(var(--color-accent) / 1)';

  const hint = limitHint ? ` ${limitHint}.` : '';
  const title = `Estimated ~${used.toLocaleString()} / ${safeLimit.toLocaleString()} tokens (system + chat). Rough ~4 chars per token.${hint} Override in Settings if needed.`;

  const ring = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <g transform={`translate(${size / 2} ${size / 2})`}>
        <circle r={r} fill="none" stroke="var(--color-border)" strokeWidth={strokeW} />
        <circle
          r={r}
          fill="none"
          stroke={progressStroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90)"
          style={{ transition: 'stroke-dashoffset 0.25s ease' }}
        />
      </g>
    </svg>
  );

  if (isToolbar) {
    return (
      <div
        className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl border border-border bg-input/35 px-3 py-2"
        title={title}
      >
        {ring}
        <div className="min-w-0 leading-tight">
          <div className="text-2xs font-semibold uppercase tracking-wide text-text-muted">Context</div>
          <div className="text-xs font-medium tabular-nums text-text-secondary">
            {Math.round(frac * 100)}% · ~{used.toLocaleString()}/{safeLimit.toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-input/40 px-2 py-1.5"
      title={title}
    >
      <span className="text-2xs font-semibold uppercase tracking-wide text-text-muted">Context</span>
      {ring}
      <span className="text-2xs font-semibold tabular-nums text-text-secondary">{Math.round(frac * 100)}%</span>
    </div>
  );
}
