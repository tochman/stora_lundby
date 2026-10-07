/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Stora Lundby Scoutkår's own brand blue (from storalundby.scout.se).
        brand: {
          50: '#eaf1f7',
          100: '#d4e3ef',
          500: '#043a63',
          700: '#032a48'
        },
        accent: {
          500: '#198754'
        }
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(0.5rem)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 250ms ease-out both'
      },
      fontFamily: {
        logo: ['"ScouternaRoundedPro"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
