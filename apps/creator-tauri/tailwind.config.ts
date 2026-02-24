import type { Config } from 'tailwindcss'

const oklch = (name: string) => `oklch(var(${name}))`
const oklchAlpha = (name: string) => `oklch(var(${name}) / <alpha-value>)`

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: oklch('--border'),
        input: oklch('--input'),
        ring: oklchAlpha('--ring'),
        background: oklchAlpha('--background'),
        foreground: oklchAlpha('--foreground'),
        primary: {
          DEFAULT: oklchAlpha('--primary'),
          foreground: oklchAlpha('--primary-foreground')
        },
        secondary: {
          DEFAULT: oklchAlpha('--secondary'),
          foreground: oklchAlpha('--secondary-foreground')
        },
        destructive: {
          DEFAULT: oklchAlpha('--destructive'),
          foreground: oklchAlpha('--destructive-foreground')
        },
        muted: {
          DEFAULT: oklchAlpha('--muted'),
          foreground: oklchAlpha('--muted-foreground')
        },
        accent: {
          DEFAULT: oklchAlpha('--accent'),
          foreground: oklchAlpha('--accent-foreground')
        },
        card: {
          DEFAULT: oklchAlpha('--card'),
          foreground: oklchAlpha('--card-foreground')
        },
        sidebar: {
          DEFAULT: oklch('--sidebar'),
          foreground: oklch('--sidebar-foreground'),
          primary: oklch('--sidebar-primary'),
          'primary-foreground': oklch('--sidebar-primary-foreground'),
          accent: oklch('--sidebar-accent'),
          'accent-foreground': oklch('--sidebar-accent-foreground'),
          border: oklch('--sidebar-border'),
          ring: oklch('--sidebar-ring')
        }
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.6rem',
        sm: '0.45rem'
      },
      boxShadow: {
        soft: '0 20px 40px -30px rgba(15, 23, 42, 0.45)'
      }
    }
  },
  plugins: []
}

export default config
