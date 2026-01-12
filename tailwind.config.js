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
        "app-bg": "#F7F8FA",
        "app-bg-soft": "#F3F4F7",
        surface: "#FFFFFF",
        "surface-muted": "#F8FAFC",
        "border-soft": "#E9EBF0",
        "text-main": "#111827",
        "text-muted": "#6B7280",
        "lavender-tint": "#EEF0FF"
      },
      boxShadow: {
        soft: "0 12px 30px rgba(17,24,39,0.08)",
        card: "0 10px 24px rgba(17,24,39,0.08)",
        glow: "0 16px 28px rgba(221,42,123,0.22)"
      },
      borderRadius: {
        premium: "18px",
        "2xl": "1.25rem"
      },
      backgroundImage: {
        ig: "linear-gradient(90deg, #F58529, #DD2A7B, #8134AF, #515BD4)"
      }
    }
  },
  plugins: []
};
