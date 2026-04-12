/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sentinel: {
          bg: '#0a0e1a',
          surface: '#111827',
          border: '#1f2937',
          accent: '#06b6d4',
          'accent-dim': '#0891b2',
          safe: '#22c55e',
          caution: '#eab308',
          danger: '#ef4444',
          rug: '#991b1b',
        },
      },
    },
  },
  plugins: [],
};
