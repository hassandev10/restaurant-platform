import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cream: {
          50: "#fdfbf7",
          100: "#faf8f5",
          200: "#f4f0e8",
          300: "#ede7db",
          400: "#dfd6c5",
        },
        forest: {
          50: "#f2f7f4",
          100: "#e1ede6",
          200: "#c4dccd",
          300: "#98c2aa",
          400: "#6aa584",
          500: "#448762",
          600: "#326c4d",
          700: "#27553e",
          800: "#224433",
          900: "#1b372a",
          950: "#0e1f17",
        },
        gold: {
          50: "#fbf8f1",
          100: "#f6eedd",
          200: "#eedcb9",
          300: "#e3c38d",
          400: "#d7a462",
          500: "#cc8943",
          600: "#bc6c25",
          700: "#9d4f20",
          800: "#7e3f20",
          900: "#67351d",
        },
      },
      fontFamily: {
        cairo: ["var(--font-cairo)", "system-ui", "sans-serif"],
        tajawal: ["var(--font-tajawal)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 10px -2px rgba(27, 55, 42, 0.05), 0 4px 20px -4px rgba(27, 55, 42, 0.08)",
        card: "0 1px 3px rgba(0, 0, 0, 0.04), 0 6px 16px -2px rgba(0, 0, 0, 0.06)",
        float: "0 8px 30px -4px rgba(27, 55, 42, 0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;
