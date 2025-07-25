/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6C63FF',
        secondary: '#4ADE80',
        dark: '#0F172A',
        light: '#F8FAFC',
      },
    },
  },
  plugins: [],
};
