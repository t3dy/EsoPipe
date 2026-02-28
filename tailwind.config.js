/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      colors: {
        parchment: {
          50: '#fdf8f0',
          100: '#f9f0dc',
          200: '#f2deb8',
          300: '#e8c88e',
          400: '#dca965',
          500: '#c8883e',
          600: '#a86830',
          700: '#864f25',
          800: '#6b3e1e',
          900: '#56311a',
        },
        ink: {
          50: '#f4f2ef',
          100: '#e6e2db',
          200: '#cdc6bb',
          300: '#b0a494',
          400: '#96846f',
          500: '#7d6b58',
          600: '#5f5043',
          700: '#3d342b',
          800: '#2a231d',
          900: '#1a1510',
        },
      },
    },
  },
  plugins: [],
}

