/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Mono"', 'monospace'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        cyber: {
          bg: '#080c14',
          card: '#0d1524',
          border: '#1a2740',
          glow: '#00e5ff',
          accent: '#7b2fff',
          gold: '#f5c542',
          danger: '#ff3860',
          muted: '#4a5a78',
          text: '#c8d8f0',
        },
      },
    },
  },
  plugins: [],
};
