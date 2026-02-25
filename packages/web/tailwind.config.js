/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:     '#080808',
        surface:  '#111111',
        elevated: '#191919',
        border:   '#252525',
        accent:   '#c8f135',
        'accent-muted': '#8aaa22',
        fg:       '#f0f0f0',
        muted:    '#7a7a7a',
        faint:    '#333333',
        danger:   '#ff4444',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        body:    ['Karla', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-up':  'fadeUp 0.3s ease forwards',
        'shimmer':  'shimmer 1.4s infinite linear',
      },
    },
  },
  plugins: [],
};
