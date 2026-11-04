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
        synapse: {
          jet: '#080808',
          deep: '#101010',
          surface: '#151515',
          elevated: '#1C1C1C',
          border: '#282828',
          pink: '#FF168B',
          softpink: '#FF4FA3',
          yellow: '#EFFF00',
          white: '#FFFFFF',
          secondary: '#A1A1AA',
          muted: '#71717A',
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Syncopate', 'Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'pink-glow': '0 0 25px -5px rgba(255, 22, 139, 0.4)',
        'yellow-glow': '0 0 25px -5px rgba(239, 255, 0, 0.35)',
        'card-subtle': '0 4px 20px -2px rgba(0, 0, 0, 0.65)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 4s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}

