/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./pages/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      container: { center: true, padding: "1rem", screens: { lg: "900px" } },
      colors: { brand: { DEFAULT: "#6366f1", 600: "#4f46e5" } }
    },
  },
  plugins: [],
};
