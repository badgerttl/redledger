/** Accent presets — classes theme-{id} in index.css (crimson is default, no class). */
export const COLOR_THEMES = [
  { id: 'crimson', color: '#dc2626', label: 'Crimson' },
  { id: 'blue', color: '#0ea5e9', label: 'Blue' },
  { id: 'green', color: '#10b981', label: 'Green' },
  { id: 'slate', color: '#64748b', label: 'Slate' },
];

export function applyColorTheme(themeId) {
  COLOR_THEMES.forEach((t) => {
    document.documentElement.classList.remove(`theme-${t.id}`);
  });
  if (themeId && themeId !== 'crimson') {
    document.documentElement.classList.add(`theme-${themeId}`);
  }
}

export function applyDarkMode(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
}

export function applyFontSize(step) {
  const pct = 100 + (Number(step) || 0) * 10;
  document.documentElement.style.fontSize = pct === 100 ? '' : `${pct}%`;
}

/** Run before React mount — matches previous main.jsx behavior. */
export function initDocumentThemeFromStorage() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }

  applyColorTheme(localStorage.getItem('colorTheme') || 'crimson');
  applyFontSize(localStorage.getItem('fontSizeStep') || 0);
}
