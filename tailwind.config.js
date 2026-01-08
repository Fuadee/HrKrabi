/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-muted": "var(--bg-muted)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "accent-purple": "var(--accent-purple)",
        "accent-pink": "var(--accent-pink)",
        "accent-soft": "var(--accent-soft)",
        "accent-soft-pink": "var(--accent-soft-pink)",
        ring: "var(--ring)"
      }
    }
  },
  plugins: []
};
