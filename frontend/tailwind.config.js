/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0F1115",
        midnight: "#07080A",
        obsidian: "#1E222B",
        borderline: "#2E3440",
        emerald: "#10B981",
        cobalt: "#3B82F6",
        amber: "#D97706"
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular"]
      }
    }
  },
  plugins: []
};
