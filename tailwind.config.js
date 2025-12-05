import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './apps/front/src/**/*.{js,ts,jsx,tsx,mdx}',
    // 注意：admin-front 使用 UnoCSS，不包含在这里
    // './apps/admin-front/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
      },
      backgroundColor: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        tertiary: 'var(--bg-tertiary)',
      },
      borderColor: {
        default: 'var(--border-color)',
      },
      colors: {
        border: 'var(--border-color)',
        input: 'var(--border-color)',
        ring: 'var(--border-color)',
        background: 'var(--bg-primary)',
        foreground: 'var(--text-primary)',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1536px',
        },
      },
      keyframes: {
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px) translateX(-50%)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) translateX(-50%)',
          },
        },
        'fade-out-down': {
          '0%': {
            opacity: '1',
            transform: 'translateY(0) translateX(-50%)',
          },
          '100%': {
            opacity: '0',
            transform: 'translateY(10px) translateX(-50%)',
          },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.3s ease-out forwards',
        'fade-out-down': 'fade-out-down 0.3s ease-out forwards',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
