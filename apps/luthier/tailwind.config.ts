import type { Config } from 'tailwindcss'

const lab = (name: string) => `lab(var(${name}))`
const labAlpha = (name: string) => `lab(var(${name}) / <alpha-value>)`

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: lab('--border'),
        input: lab('--input'),
        ring: labAlpha('--ring'),
        background: labAlpha('--background'),
        foreground: labAlpha('--foreground'),
        primary: {
          DEFAULT: labAlpha('--primary'),
          foreground: labAlpha('--primary-foreground'),
        },
        secondary: {
          DEFAULT: labAlpha('--secondary'),
          foreground: labAlpha('--secondary-foreground'),
        },
        destructive: {
          DEFAULT: labAlpha('--destructive'),
          foreground: labAlpha('--destructive-foreground'),
        },
        muted: {
          DEFAULT: labAlpha('--muted'),
          foreground: labAlpha('--muted-foreground'),
        },
        accent: {
          DEFAULT: labAlpha('--accent'),
          foreground: labAlpha('--accent-foreground'),
        },
        card: {
          DEFAULT: labAlpha('--card'),
          foreground: labAlpha('--card-foreground'),
        },
        sidebar: {
          DEFAULT: lab('--sidebar'),
          foreground: lab('--sidebar-foreground'),
          primary: lab('--sidebar-primary'),
          'primary-foreground': lab('--sidebar-primary-foreground'),
          accent: lab('--sidebar-accent'),
          'accent-foreground': lab('--sidebar-accent-foreground'),
          border: lab('--sidebar-border'),
          ring: lab('--sidebar-ring'),
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.6rem',
        sm: '0.45rem',
      },
      boxShadow: {
        soft: '0 20px 40px -30px rgba(15, 23, 42, 0.45)',
      },
    },
  },
  plugins: [],
}

export default config
