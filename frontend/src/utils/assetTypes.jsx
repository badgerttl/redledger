import { Server, Globe, Zap, Smartphone, Cloud, AtSign, GitBranch, Network, Database } from 'lucide-react';

export const ASSET_TYPES = [
  { value: 'host',           label: 'Host',           Icon: Server },
  { value: 'web_page',       label: 'Web Page',       Icon: Globe },
  { value: 'api_endpoint',   label: 'API Endpoint',   Icon: Zap },
  { value: 'domain',         label: 'Domain',         Icon: AtSign },
  { value: 'network',        label: 'Network',        Icon: Network },
  { value: 'database',       label: 'Database',       Icon: Database },
  { value: 'git_repo',       label: 'Git Repo',       Icon: GitBranch },
  { value: 'mobile_app',     label: 'Mobile App',     Icon: Smartphone },
  { value: 'cloud_resource', label: 'Cloud Resource', Icon: Cloud },
];

export function assetTypeLabel(type) {
  return ASSET_TYPES.find(t => t.value === type)?.label ?? type;
}

export function AssetIcon({ type, className }) {
  const { Icon } = ASSET_TYPES.find(t => t.value === type) ?? { Icon: Server };
  return <Icon className={className} />;
}
