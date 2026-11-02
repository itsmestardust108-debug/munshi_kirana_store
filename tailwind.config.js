/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mk: {
          purple: '#5F259F',
          'purple-dark': '#4F1E85',
          soft: '#F0E7FA',
          bg: '#F8F7FB',
          surface: '#FFFFFF',
          text: '#29163D',
          muted: '#6B6175',
          line: '#E9E3EE',
          green: '#176B49',
          'green-bg': '#EAF5EF',
          orange: '#8C5510',
          'orange-bg': '#FFF3DC',
          red: '#B42318',
          'red-bg': '#FEE4E2',
        }
      },
      fontFamily: {
        devanagari: ['"Noto Sans Devanagari"', '"Nirmala UI"', 'system-ui', 'sans-serif'],
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      minHeight: {
        'touch': '56px',
        'touch-sm': '48px',
      },
      minWidth: {
        'touch': '56px',
        'touch-sm': '48px',
      },
      borderRadius: {
        'card': '16px',
      }
    },
  },
  plugins: [],
}

