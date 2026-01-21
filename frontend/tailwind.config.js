/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme - Xám đen background
        background: {
          DEFAULT: '#0f1419',
          secondary: '#1a1f26',
          tertiary: '#242b33',
          hover: '#2d353f',
        },
        // Blue/Teal accent - Cloud, Network, Container feel
        accent: {
          DEFAULT: '#0ea5e9', // Sky blue
          light: '#38bdf8',
          dark: '#0284c7',
          teal: '#14b8a6',
          cyan: '#06b6d4',
        },
        // Text colors
        text: {
          primary: '#f1f5f9',
          secondary: '#94a3b8',
          muted: '#64748b',
        },
        // Status colors
        status: {
          running: '#22c55e',
          stopped: '#ef4444',
          paused: '#f59e0b',
          created: '#8b5cf6',
        },
        // Border colors
        border: {
          DEFAULT: '#2d353f',
          light: '#3d454f',
        },
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(14, 165, 233, 0.3)',
        'glow-teal': '0 0 20px rgba(20, 184, 166, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}


