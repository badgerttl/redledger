import { useState, useEffect } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { useEngagement } from '../context/EngagementContext';
import clsx from 'clsx';
import {
  LayoutDashboard, Target, Server, AlertTriangle, Key,
  Terminal, CheckSquare, Clock, BookOpen, FileText,
  ChevronLeft, ChevronRight, Shield, ChevronDown, Plus,
  Sun, Moon,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scope', icon: Target, label: 'Scope' },
  { to: '/assets', icon: Server, label: 'Assets' },
  { to: '/findings', icon: AlertTriangle, label: 'Findings' },
  { to: '/credentials', icon: Key, label: 'Credentials' },
  { to: '/tool-output', icon: Terminal, label: 'Tool Output' },
  { to: '/checklists', icon: CheckSquare, label: 'Checklists' },
  { to: '/activity', icon: Clock, label: 'Activity Log' },
  { to: '/report', icon: FileText, label: 'Report' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const { engagements, current, selectEngagement, setCurrent } = useEngagement();
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const isDark = saved ? saved === 'dark' : true;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const engId = id || current?.id;

  const handleSelect = (eid) => {
    selectEngagement(eid);
    setDropdownOpen(false);
    navigate(`/e/${eid}`);
  };

  const handleGoHome = () => {
    setCurrent(null);
    navigate('/');
  };

  const handleNewEngagement = () => {
    setDropdownOpen(false);
    setCurrent(null);
    navigate('/?new=1');
  };

  return (
    <aside
      className={clsx(
        'bg-sidebar border-r border-border flex flex-col h-screen shrink-0 transition-all duration-200',
        collapsed ? 'w-14' : 'w-60'
      )}
    >
      {/* Logo — clickable, navigates to engagement list */}
      <button onClick={handleGoHome} className="flex items-center gap-2 px-3 h-14 border-b border-border shrink-0 hover:bg-white/5 transition-colors w-full text-left">
        <Shield className="w-6 h-6 text-accent shrink-0" />
        {!collapsed && <span className="font-semibold text-sm text-text-primary truncate">RedLedger</span>}
      </button>

      {/* Engagement selector */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-border relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between bg-input border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary hover:border-text-muted transition-colors"
          >
            <span className="truncate">{current?.name || 'Select engagement'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
          </button>
          {dropdownOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-card border border-border rounded-md shadow-xl z-50 max-h-60 overflow-y-auto">
              {engagements.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleSelect(e.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors',
                    e.id === current?.id ? 'text-accent' : 'text-text-secondary'
                  )}
                >
                  {e.name}
                </button>
              ))}
              {engagements.length === 0 && (
                <div className="px-3 py-2 text-xs text-text-muted">No engagements yet</div>
              )}
              <div className="border-t border-border">
                <button
                  onClick={handleNewEngagement}
                  className="w-full text-left px-3 py-2 text-xs text-accent hover:bg-white/5 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> New Engagement
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {engId && NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={`/e/${engId}${to}`}
            end={to === ''}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors duration-150',
                isActive
                  ? 'bg-accent/10 text-accent border-l-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border-l-2 border-transparent'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        <div className="my-2 mx-3 border-t border-border" />

        <NavLink
          to="/guides"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2 mx-1.5 rounded-md text-sm transition-colors duration-150',
              isActive
                ? 'bg-accent/10 text-accent border-l-2 border-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border-l-2 border-transparent'
            )
          }
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Guides</span>}
        </NavLink>
      </nav>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="flex items-center justify-center gap-2 h-10 border-t border-border text-text-muted hover:text-text-primary transition-colors"
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        {!collapsed && <span className="text-xs">{dark ? 'Light mode' : 'Dark mode'}</span>}
      </button>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-border text-text-muted hover:text-text-primary transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
