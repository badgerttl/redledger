import { useState, useEffect, useRef } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { useEngagement } from '../context/EngagementContext';
import clsx from 'clsx';
import {
  LayoutDashboard, Target, Server, AlertTriangle, Key,
  Terminal, CheckSquare, Clock, BookOpen, FileText,
  ChevronLeft, ChevronRight, Shield, ChevronDown, Plus,
  Sun, Moon, Palette, Folder,
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

const COLOR_THEMES = [
  { id: 'crimson', color: '#dc2626', label: 'Crimson' },
  { id: 'blue', color: '#0ea5e9', label: 'Blue' },
  { id: 'green', color: '#10b981', label: 'Green' },
  { id: 'slate', color: '#64748b', label: 'Slate' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [colorTheme, setColorTheme] = useState('crimson');
  const themeMenuRef = useRef(null);
  const { engagements, current, selectEngagement, setCurrent } = useEngagement();
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const isDark = saved ? saved === 'dark' : true;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);

    const savedColor = localStorage.getItem('colorTheme') || 'crimson';
    setColorTheme(savedColor);
    COLOR_THEMES.forEach(t => document.documentElement.classList.remove(`theme-${t.id}`));
    if (savedColor !== 'crimson') {
      document.documentElement.classList.add(`theme-${savedColor}`);
    }
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const switchColorTheme = (themeId) => {
    COLOR_THEMES.forEach(t => {
      document.documentElement.classList.remove(`theme-${t.id}`);
    });
    if (themeId !== 'crimson') {
      document.documentElement.classList.add(`theme-${themeId}`);
    }
    setColorTheme(themeId);
    localStorage.setItem('colorTheme', themeId);
    setThemeMenuOpen(false);
  };

  useEffect(() => {
    if (!themeMenuOpen) return;
    const close = (e) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [themeMenuOpen]);

  const engId = id || current?.id;
  const activeColorTheme = COLOR_THEMES.find((t) => t.id === colorTheme) ?? COLOR_THEMES[0];

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
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setThemeMenuOpen(false);
                setDropdownOpen(!dropdownOpen);
              }}
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
      </nav>

      {/* Accent theme (dropdown — works when sidebar is collapsed) */}
      <div className="shrink-0 border-t border-sidebar-border/80 px-2 py-2">
        <div ref={themeMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              setThemeMenuOpen((o) => !o);
            }}
            className={clsx(
              'flex w-full items-center rounded-xl border border-sidebar-border/90 bg-white/[0.04] text-xs font-medium text-sidebar-text transition-all hover:bg-white/[0.07]',
              collapsed ? 'justify-center py-2.5' : 'justify-between gap-2 px-3 py-2.5',
            )}
            aria-expanded={themeMenuOpen}
            aria-haspopup="listbox"
            aria-label="Accent color"
          >
            {collapsed ? (
              <Palette
                className={clsx(
                  'h-[1.1rem] w-[1.1rem] shrink-0',
                  themeMenuOpen ? 'text-accent' : 'text-sidebar-text-muted',
                )}
              />
            ) : (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm ring-1 ring-white/15"
                    style={{ backgroundColor: activeColorTheme.color }}
                  />
                  <span className="truncate">{activeColorTheme.label}</span>
                </span>
                <ChevronDown
                  className={clsx(
                    'h-3.5 w-3.5 shrink-0 text-sidebar-text-muted transition-transform duration-200',
                    themeMenuOpen && 'rotate-180',
                  )}
                />
              </>
            )}
          </button>
          {themeMenuOpen && (
            <div
              className="absolute bottom-full left-0 right-0 z-[60] mb-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-card backdrop-blur-md"
              role="listbox"
              aria-label="Choose accent color"
            >
              <div className="py-1">
                {COLOR_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={colorTheme === t.id}
                    onClick={() => switchColorTheme(t.id)}
                    className={clsx(
                      'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors',
                      colorTheme === t.id
                        ? 'bg-accent/10 font-medium text-accent'
                        : 'text-text-secondary hover:bg-black/[0.04] hover:text-text-primary dark:hover:bg-white/[0.06]',
                    )}
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                      style={{ backgroundColor: t.color }}
                    />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dark/light toggle */}
      <button
        onClick={toggleTheme}
        className="flex items-center justify-center gap-2 h-11 border-t border-sidebar-border/80 text-sidebar-text-muted hover:text-sidebar-text hover:bg-white/[0.04] transition-colors"
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        {!collapsed && <span className="text-xs">{dark ? 'Light mode' : 'Dark mode'}</span>}
      </button>

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
