/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Fraunces'", "ui-serif", "Georgia", "serif"],
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // Warm accent — used sparingly for actions/emphasis, not everywhere.
        ember: {
          50: "#fdf6ec",
          100: "#faead0",
          200: "#f3d09f",
          300: "#eab164",
          400: "#e3953e",
          500: "#cc7521",
          600: "#ab5b18",
          700: "#8a4517",
          800: "#713918",
          900: "#5e2f16",
        },
        // Warm neutrals (instead of clinical slate/gray) for paper/ink feel.
        paper: {
          50: "#fbf9f6",
          100: "#f4f0e9",
          200: "#e8e1d5",
          300: "#d6cbb8",
          400: "#b3a58c",
          500: "#8c7f68",
          600: "#6b6152",
          700: "#4d4638",
          800: "#332e25",
          900: "#211d17",
          950: "#15120e",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(33, 29, 23, 0.06), 0 1px 1px rgba(33, 29, 23, 0.04)",
        card: "0 2px 8px rgba(33, 29, 23, 0.06), 0 1px 2px rgba(33, 29, 23, 0.05)",
      },
      keyframes: {
        "toast-in": {
          "0%": { opacity: 0, transform: "translateY(6px) scale(0.98)" },
          "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
        },
        "pop-in": {
          "0%": { opacity: 0, transform: "scale(0.96)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.15s ease-out",
        shimmer: "shimmer 1.6s infinite linear",
      },
    },
  },
  plugins: [],
};
