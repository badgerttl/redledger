import { useState, useRef, useEffect } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { useEngagement } from '../context/EngagementContext';
import clsx from 'clsx';
import {
  LayoutDashboard, Server, AlertTriangle, Key,
  Terminal, CheckSquare, Clock, BookOpen, FileText,
  ChevronLeft, ChevronRight, Shield, ChevronDown, Plus,
  Folder, MessageSquare, Settings, ScanLine,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/assets', icon: Server, label: 'Assets' },
  { to: '/findings', icon: AlertTriangle, label: 'Findings' },
  { to: '/credentials', icon: Key, label: 'Credentials' },
  { to: '/tool-output', icon: Terminal, label: 'Tool Output' },
  { to: '/checklists', icon: CheckSquare, label: 'Checklists' },
  { to: '/activity', icon: Clock, label: 'Activity Log' },

  { to: '/report', icon: FileText, label: 'Report' },
  { to: '/assistant', icon: MessageSquare, label: 'Assistant' },
  { to: '/code-review', icon: ScanLine, label: 'Code Review' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const engagementDropdownRef = useRef(null);
  const { engagements, current, selectEngagement, setCurrent } = useEngagement();
  const { id } = useParams();
  const navigate = useNavigate();

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

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (e) => {
      if (engagementDropdownRef.current && !engagementDropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [dropdownOpen]);

  return (
    <aside
      className={clsx(
        'bg-sidebar border-r border-sidebar-border flex flex-col h-screen shrink-0 transition-[width] duration-300 ease-out shadow-sidebar',
        collapsed ? 'w-14' : 'w-64'
      )}
    >
      <button
        onClick={handleGoHome}
        className={clsx(
          'flex items-center h-[3.25rem] border-b border-sidebar-border/80 shrink-0 hover:bg-white/[0.06] transition-colors w-full text-left group',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-3'
        )}
      >
        <span
          className={clsx(
            'flex items-center justify-center rounded-xl bg-accent/15 ring-1 ring-inset ring-accent/20 shrink-0',
            collapsed ? 'h-8 w-8' : 'h-9 w-9'
          )}
        >
          <Shield className={clsx('text-accent', collapsed ? 'w-[1rem] h-[1rem]' : 'w-[1.15rem] h-[1.15rem]')} />
        </span>
        {!collapsed && (
          <span className="font-semibold text-[0.9375rem] tracking-tight text-sidebar-text truncate group-hover:text-white transition-colors">
            RedLedger
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="border-b border-sidebar-border/80 px-3 py-3">
          <div className="relative" ref={engagementDropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-sidebar-border/90 bg-white/[0.04] px-3 py-2.5 text-left text-xs font-medium text-sidebar-text transition-all hover:border-sidebar-text-muted/50 hover:bg-white/[0.07]"
            >
              <span className="min-w-0 truncate">{current?.name || 'Select engagement'}</span>
              <ChevronDown
                className={clsx(
                  'h-3.5 w-3.5 shrink-0 text-sidebar-text-muted transition-transform duration-200',
                  dropdownOpen && 'rotate-180',
                )}
              />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-card backdrop-blur-md">
                <div className="max-h-52 overflow-y-auto overscroll-contain px-1.5 pt-1.5 pb-1 space-y-0.5">
                  {engagements.map((e) => {
                    const active = e.id === current?.id;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => handleSelect(e.id)}
                        className={clsx(
                          'group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors',
                          active
                            ? 'bg-accent/10 text-accent'
                            : 'text-text-secondary hover:bg-accent/10 hover:text-accent',
                        )}
                      >
                        <Folder
                          className={clsx(
                            'h-3.5 w-3.5 shrink-0 transition-colors',
                            active ? 'text-accent' : 'text-text-muted group-hover:text-accent',
                          )}
                        />
                        <span className="min-w-0 truncate">{e.name}</span>
                      </button>
                    );
                  })}
                  {engagements.length === 0 && (
                    <div className="rounded-lg px-2.5 py-2.5 text-center text-xs text-text-muted">
                      No engagements yet
                    </div>
                  )}
                </div>
                <div className="shrink-0 border-t border-border/80 bg-card px-1.5 py-1.5">
                  <button
                    type="button"
                    onClick={handleNewEngagement}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    New Engagement
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-1.5 space-y-0.5">
        {engId && NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={`/e/${engId}${to}`}
            end={to === ''}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                collapsed ? 'justify-center px-2 mx-0.5' : 'px-3 mx-0.5',
                isActive
                  ? 'bg-accent/[0.14] text-accent shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.22)]'
                  : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-white/[0.06]'
              )
            }
          >
            <Icon className="w-[1.05rem] h-[1.05rem] shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        <div className="my-3 mx-2 border-t border-sidebar-border/70" />

        <NavLink
          to="/guides"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              collapsed ? 'justify-center px-2 mx-0.5' : 'px-3 mx-0.5',
              isActive
                ? 'bg-accent/[0.14] text-accent shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.22)]'
                : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-white/[0.06]'
            )
          }
        >
          <BookOpen className="w-[1.05rem] h-[1.05rem] shrink-0" />
          {!collapsed && <span>Guides</span>}
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              collapsed ? 'justify-center px-2 mx-0.5' : 'px-3 mx-0.5',
              isActive
                ? 'bg-accent/[0.14] text-accent shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.22)]'
                : 'text-sidebar-text-muted hover:text-sidebar-text hover:bg-white/[0.06]'
            )
          }
        >
          <Settings className="w-[1.05rem] h-[1.05rem] shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-11 border-t border-sidebar-border/80 text-sidebar-text-muted hover:text-sidebar-text hover:bg-white/[0.04] transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
