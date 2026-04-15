/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./_layouts/**/*.html",
    "./_includes/**/*.html",
    "./_posts/**/*.{html,md}",
    "./*.{html,md}",
    "./docs/**/*.{html,md}",
  ],
  theme: {
    extend: {
      colors: {
        nuts: {
          50: "#fdf8f0",
          100: "#f9eddb",
          200: "#f2d7b4",
          300: "#e9bb83",
          400: "#df9950",
          500: "#d88032",
          600: "#c96827",
          700: "#a75022",
          800: "#864122",
          900: "#6d371e",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
