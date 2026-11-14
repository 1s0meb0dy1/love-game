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
        // Heat 2: нейтральні й «білий» беруться зі змінних теми (src/styles.css), тож text-white, bg-white/[…] і zinc-* самі перемикаються між «Ніч» і «Світанок»
        white: 'rgb(var(--tw-white) / <alpha-value>)',
        zinc: {
          50: 'rgb(var(--z-50) / <alpha-value>)', 100: 'rgb(var(--z-100) / <alpha-value>)', 200: 'rgb(var(--z-200) / <alpha-value>)', 300: 'rgb(var(--z-300) / <alpha-value>)', 400: 'rgb(var(--z-400) / <alpha-value>)', 500: 'rgb(var(--z-500) / <alpha-value>)', 600: 'rgb(var(--z-600) / <alpha-value>)', 700: 'rgb(var(--z-700) / <alpha-value>)', 800: 'rgb(var(--z-800) / <alpha-value>)', 900: 'rgb(var(--z-900) / <alpha-value>)', 950: 'rgb(var(--z-950) / <alpha-value>)',
        },
        rose: {
          50: 'rgb(var(--r-50) / <alpha-value>)', 100: 'rgb(var(--r-100) / <alpha-value>)', 200: 'rgb(var(--r-200) / <alpha-value>)', 300: 'rgb(var(--r-300) / <alpha-value>)', 400: 'rgb(var(--r-400) / <alpha-value>)',
          500: '#ff4d6d', 600: '#dc2a52', 700: '#b8173f', 800: '#8f1634', 900: '#5e1024', 950: '#3a0a17',
        },
      },
    },
  },
  plugins: [],
};
