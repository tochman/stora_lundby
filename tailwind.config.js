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
      fontFamily: {
        logo: ['"ScouternaRoundedPro"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
