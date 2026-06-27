/** @type {import('tailwindcss').Config} */
// Colors are driven by theme/tokens.ts (inline styles). Tailwind here is only
// for layout utilities + the two font families.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        ui: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
