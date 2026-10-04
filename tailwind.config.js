/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#dfeeff',
          500: '#0d6efd',
          700: '#0b5ed7'
        },
        accent: {
          500: '#198754'
        }
      }
    }
  },
  plugins: []
};
