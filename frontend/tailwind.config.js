/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bgPrimary: "#0a0a0f",
        bgCard: "#12121a",
        bgElevated: "#1a1a2e",
        accentPurple: "#6c63ff",
        accentGold: "#f5c518",
        textPrimary: "#ffffff",
        textSecondary: "#a0a0b0",
      },
    },
  },
  plugins: [],
};

