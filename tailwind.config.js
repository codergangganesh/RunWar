/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // Emerald primary
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        volt: {
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16', // High-vis lime
          600: '#65a30d',
        },
        charcoal: {
          800: '#1e293b',
          850: '#141c2e',
          900: '#0f172a',
          950: '#090d16',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-brand': '0 0 25px -5px rgba(16, 185, 129, 0.5)',
        'glow-volt': '0 0 25px -5px rgba(132, 204, 22, 0.6)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.5)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': {
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
            transform: 'scale(1)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.85)',
            transform: 'scale(1.02)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'shimmer': 'shimmer 2.5s infinite linear',
      }
    },
  },
  plugins: [],
}
