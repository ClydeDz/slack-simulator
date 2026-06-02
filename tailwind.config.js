/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'sidebar-bg':   'var(--slacksim-color-sidebar-bg)',
        'sidebar-fg':   'var(--slacksim-color-sidebar-fg)',
        'accent':       'var(--slacksim-color-accent)',
      },
    },
  },
  plugins: [],
}
