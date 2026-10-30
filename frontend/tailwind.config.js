/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Soft Mint Green palette
        mint: {
          50: '#F2FAF6',
          100: '#E1F5EC',
          200: '#C4EADB',
          300: '#99DBC1',
          400: '#5EC49F',
          500: '#2DB384',
          600: '#1E966B',
          700: '#187756',
          800: '#165F45',
          900: '#134E39',
          950: '#082C20',
        },
        // Fresh Sage Green palette
        sage: {
          50: '#F4F7F5',
          100: '#E4EBE6',
          200: '#CBD9CE',
          300: '#A9C0AD',
          400: '#83A389',
          500: '#64876B',
          600: '#4F6C55',
          700: '#405645',
          800: '#354639',
          900: '#2D3A30',
          950: '#161F18',
        },
        // Deep Forest Green
        forest: {
          50: '#F0F6F3',
          100: '#DCECE3',
          200: '#BDDACB',
          300: '#95C1AC',
          400: '#68A287',
          500: '#468369',
          600: '#346953',
          700: '#2B5443',
          800: '#244437',
          900: '#1E382E',
          950: '#0E1F18',
        },
        // Accent Lime Green (vibrant)
        limeAccent: {
          50: '#F7FEE7',
          100: '#ECFCCB',
          200: '#D9F99D',
          300: '#BEF264',
          400: '#A3E635',
          500: '#84CC16',
          600: '#65A30D',
          700: '#4D7C0F',
          800: '#3F6212',
          900: '#365314',
        },
        // Backward compatibility mapping to prevent broken styles
        lavender: {
          50: '#F2FAF6',
          100: '#E1F5EC',
          200: '#C4EADB',
          300: '#99DBC1',
          400: '#5EC49F',
          500: '#2DB384',
          600: '#1E966B',
          700: '#187756',
          800: '#165F45',
          900: '#134E39',
          950: '#082C20',
        }
      },
      boxShadow: {
        'mint-sm': '0 2px 10px -2px rgba(30, 150, 107, 0.12)',
        'mint-md': '0 8px 24px -4px rgba(30, 150, 107, 0.16)',
        'mint-lg': '0 16px 40px -8px rgba(30, 150, 107, 0.22)',
        'mint-glow': '0 0 25px rgba(45, 179, 132, 0.35)',
        'lavender-sm': '0 2px 10px -2px rgba(30, 150, 107, 0.12)',
        'lavender-md': '0 8px 24px -4px rgba(30, 150, 107, 0.16)',
        'lavender-lg': '0 16px 40px -8px rgba(30, 150, 107, 0.22)',
        'lavender-glow': '0 0 25px rgba(45, 179, 132, 0.35)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-in': 'fadeIn 0.35s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
