import type { Config } from 'tailwindcss';

/**
 * Trust Ring design system — Section 4 of PROJECT_MASTER_PROMPT.md.
 * Tokens live here and in globals.css as CSS variables; nothing in the app
 * should hardcode a hex value.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '480px' }, // mobile-first: the app never exceeds a phone column
    },
    extend: {
      colors: {
        ink: 'hsl(var(--ink))',
        canvas: 'hsl(var(--canvas))',
        surface: 'hsl(var(--surface))',
        'trust-indigo': 'hsl(var(--trust-indigo))',
        marigold: 'hsl(var(--marigold))',
        'signal-green': 'hsl(var(--signal-green))',
        'signal-red': 'hsl(var(--signal-red))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--focus-ring))',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '1rem',
        pill: '999px',
      },
      boxShadow: {
        // Section 4: cards are separated by surface fill + soft shadow, never stripes.
        card: '0 1px 2px rgba(20, 24, 31, 0.04), 0 8px 24px -12px rgba(20, 24, 31, 0.16)',
        'card-hover': '0 2px 4px rgba(20, 24, 31, 0.06), 0 16px 32px -16px rgba(20, 24, 31, 0.24)',
        sheet: '0 -8px 32px -12px rgba(20, 24, 31, 0.24)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
