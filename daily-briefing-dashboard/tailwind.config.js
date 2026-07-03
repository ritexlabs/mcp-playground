/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer':    'shimmer 2s linear infinite',
        'float':      'float 4s ease-in-out infinite',
        'blink-dot':  'blinkDot 2s ease-in-out infinite',
        'spin-once':  'spin 0.7s ease-in-out',
        'count-up':   'fadeInUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400% 0' },
          '100%': { backgroundPosition: '400% 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-10px)' },
        },
        blinkDot: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.25' },
        },
      },
      boxShadow: {
        'card': '0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 60px -10px rgba(0,0,0,0.5)',
        'card-hover': '0 1px 0 rgba(255,255,255,0.10) inset, 0 32px 80px -10px rgba(0,0,0,0.6)',
      },
      backgroundImage: {
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
      },
    },
  },
  plugins: [],
}
