/** @type {import('tailwindcss').Config} */
const forms = require('@tailwindcss/forms');
const aspect = require('@tailwindcss/aspect-ratio');
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0f172a', // dark slate
        accent: '#b28b6b', // warm gold
        muted: '#6b7280'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial'],
        serif: ['Merriweather', 'Georgia', 'serif']
      },
      spacing: {
        '72': '18rem',
        '84': '21rem',
        '96': '24rem'
      }
    }
  },
  plugins: [forms, aspect]
};
