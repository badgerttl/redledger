export default function TagBadge({ tag }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs bg-white/5 border border-border text-text-secondary">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
      {tag.name}
    </span>
  );
}
