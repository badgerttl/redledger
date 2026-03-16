/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        body: 'var(--color-body)',
        card: 'var(--color-card)',
        sidebar: 'var(--color-sidebar)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        accent: '#dc2626',
        'accent-hover': '#ef4444',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'sev-critical': '#f43f5e',
        'sev-high': '#f97316',
        'sev-medium': '#fbbf24',
        'sev-low': '#06b6d4',
        'sev-info': '#64748b',
        'row-alt': 'var(--color-row-alt)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': '0.6875rem',
      },
    },
  },
  plugins: [],
};
