/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#070502',
        panel: '#0D0904',
        panel2: '#120D06',
        line: 'rgba(240,160,40,0.18)',
        gold: '#F0A028',
        gold2: '#B9741A',
        goldsoft: '#F8BA4E',
        sand: '#FFF4DE',
        mute: '#B9A27A',
      },
      fontFamily: {
        sans: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
        display: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
        kufi: ['Reem Kufi', 'Cairo', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
