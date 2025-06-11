/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts}',
    "./node_modules/flowbite/**/*.js" 
  ],
  darkMode: 'class', //Este codigo permite hacer los cambios de modo oscuro a claro
  theme: {
    extend: {
      colors: {
        'color-primary': '#7a95cd',
        'color-primary-100': '#7088b8',
        'color-secondary': '#747d91',
        'color-azul': '#2469ff',
        'color-azul-100': '#0853f5',
        'color-rojo': '#c5000f',
        'color-rojo-100': '#0853f5',
      },
      borderColor: {
        'color-primary': '#1d335d',
      }
    }
  },
  plugins: [
    require('flowbite/plugin')
  ],
};
