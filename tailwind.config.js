/** @type {import('tailwindcss').Config} */
// Палитра и типографика — единый источник для всего интерфейса.
// Нейтральные (zinc) подкрашены в сливовый и подобраны так, чтобы текст проходил контраст WCAG AA на фоне экрана.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Onest', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Unbounded', 'Onest', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // минимальный читаемый размер — 13px (раньше встречались 10–11px)
        xs: ['0.8125rem', { lineHeight: '1.35' }],
        sm: ['0.9375rem', { lineHeight: '1.45' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.4' }],
        xl: ['1.25rem', { lineHeight: '1.3' }],
        '2xl': ['1.5rem', { lineHeight: '1.22' }],
      },
      colors: {
        zinc: {
          50: '#fbf6f5', 100: '#f3eaee', 200: '#e4d8e0', 300: '#d0c2cd', 400: '#b6a6b4',
          500: '#9a8a9c', 600: '#75667a', 700: '#4d4153', 800: '#30263a', 900: '#1d1526', 950: '#100a17',
        },
        rose: {
          50: '#fff1f3', 100: '#ffe1e7', 200: '#ffc4d0', 300: '#ff9fb3', 400: '#ff7993', 500: '#ff4d6d',
          600: '#dc2a52', 700: '#b8173f', 800: '#8f1634', 900: '#5e1024', 950: '#3a0a17',
        },
      },
    },
  },
  plugins: [],
};
