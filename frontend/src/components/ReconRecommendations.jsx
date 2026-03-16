import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Compass } from 'lucide-react';
import PORT_RECOMMENDATIONS, { SERVICE_ALIASES, GENERIC_RECOMMENDATION } from '../data/portRecommendations.js';

function parsePortsSummary(raw) {
  if (!raw || !raw.trim()) return [];
  const entries = raw.split(',').map(s => s.trim()).filter(Boolean);
  const parsed = [];
  for (const entry of entries) {
    const m = entry.match(/^(\d+)\s*\/\s*(tcp|udp)\s*(?:\(([^)]*)\))?/i);
    if (m) {
      parsed.push({ port: parseInt(m[1], 10), protocol: m[2], service: (m[3] || '').trim() });
    } else {
      const numOnly = entry.match(/^(\d+)$/);
      if (numOnly) parsed.push({ port: parseInt(numOnly[1], 10), protocol: 'tcp', service: '' });
    }
  }
  return parsed;
}

function lookupRecommendations(portInfo) {
  const { port, service } = portInfo;
  if (PORT_RECOMMENDATIONS[port]) return PORT_RECOMMENDATIONS[port];
  if (service) {
    const alias = SERVICE_ALIASES[service.toLowerCase()];
    if (alias && PORT_RECOMMENDATIONS[alias]) return PORT_RECOMMENDATIONS[alias];
  }
  return null;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard may not be available */ }
  };

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1 rounded hover:bg-white/10 text-text-muted hover:text-text-secondary transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function PortGroup({ portInfo, target }) {
  const [expanded, setExpanded] = useState(false);
  const { port, protocol, service } = portInfo;

  const rec = lookupRecommendations(portInfo);
  const data = rec || GENERIC_RECOMMENDATION;
  const label = rec ? data.service : `Port ${port}`;

  const substituteVars = (cmd) =>
    cmd.replace(/\{target\}/g, target || '<target>').replace(/\{port\}/g, String(port));

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-primary hover:bg-white/5 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-accent shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />}
        <span className="font-mono text-xs text-accent">{port}/{protocol}</span>
        <span className="text-text-secondary">— {label}</span>
        {service && service.toLowerCase() !== label.toLowerCase() && (
          <span className="text-2xs text-text-muted">({service})</span>
        )}
        <span className="ml-auto text-2xs text-text-muted">{data.items.length} items</span>
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {data.items.map((item, idx) => (
            <ReconItem key={idx} item={item} substituteVars={substituteVars} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReconItem({ item, substituteVars }) {
  const [showCommands, setShowCommands] = useState(false);

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setShowCommands(!showCommands)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-full text-left"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
        <span>{item.title}</span>
        {item.commands.length > 0 && (
          <span className="ml-auto text-2xs text-text-muted">
            {showCommands ? 'hide' : 'commands'}
          </span>
        )}
      </button>
      {showCommands && item.commands.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {item.commands.map((cmd, i) => {
            const rendered = substituteVars(cmd);
            return (
              <div key={i} className="flex items-center gap-2 bg-input rounded px-2.5 py-1.5 group/cmd">
                <code className="text-xs font-mono text-text-secondary flex-1 break-all">{rendered}</code>
                <CopyButton text={rendered} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReconRecommendations({ portsSummary, target }) {
  const portEntries = useMemo(() => parsePortsSummary(portsSummary), [portsSummary]);

  if (!portsSummary || !portsSummary.trim()) {
    return null;
  }

  if (portEntries.length === 0) return null;

  return (
    <div className="card mb-6">
      <h2 className="text-base font-medium mb-4 flex items-center gap-2">
        <Compass className="w-4 h-4" /> Recommended Enumeration
      </h2>
      <div className="space-y-2">
        {portEntries.map((p, idx) => (
          <PortGroup key={`${p.port}-${p.protocol}-${idx}`} portInfo={p} target={target} />
        ))}
      </div>
    </div>
  );
}
