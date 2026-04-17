/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#dce6f1',
          600: '#1E3A5F',
          700: '#162d4a',
          900: '#0f1f33',
        },
      },
    },
  },
  plugins: [],
}
