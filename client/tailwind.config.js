/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          light: '#133E7C',
          DEFAULT: '#0B2A5B',
          dark: '#061B3F',
        },
        brand: {
          DEFAULT: '#1F6FEB',
          hover: '#165BB5',
          light: '#EFF6FF',
        },
        bg: {
          main: '#F3F7FC',
          card: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E1E9F4',
          subtle: '#EEF2F6',
        },
        slate: {
          900: '#1E293B',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          100: '#F1F5F9',
        },
        status: {
          success: '#16A34A',
          'success-bg': '#DCFCE7',
          'success-text': '#15803D',
          warning: '#F59E0B',
          'warning-bg': '#FEF3C7',
          'warning-text': '#B45309',
          critical: '#DC2626',
          'critical-bg': '#FEE2E2',
          'critical-text': '#B91C1C',
          info: '#1D4ED8',
          'info-bg': '#DBEAFE',
          'info-text': '#1E40AF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(11, 31, 58, 0.06), 0 1px 2px rgba(11, 31, 58, 0.04)',
        modal: '0 10px 25px -5px rgba(11, 31, 58, 0.1), 0 8px 10px -6px rgba(11, 31, 58, 0.1)',
        dropdown: '0 4px 6px -1px rgba(11, 31, 58, 0.1), 0 2px 4px -2px rgba(11, 31, 58, 0.06)',
      },
      borderRadius: {
        card: '12px',
        pill: '6px',
      }
    },
  },
  plugins: [],
}
