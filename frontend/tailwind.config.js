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
        forest: {
          50: '#EAF5EE',
          100: '#CBE7D4',
          200: '#A3D9B5',
          700: '#13653F',
          800: '#0F5132',
          900: '#0B4226',
          950: '#0A3423',
        },
        brand: {
          50: '#EAF5EE',
          100: '#CBE7D4',
          500: '#10b981',
          700: '#065F46',
          800: '#0F5132',
          900: '#0F5132',
          950: '#0A3423',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      }
    },
  },
  plugins: [],
}
