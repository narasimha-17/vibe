import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "rgb(var(--bg-app-rgb) / <alpha-value>)",
        panel: "rgb(var(--bg-panel-rgb) / <alpha-value>)",
        surface: "rgb(var(--bg-surface-rgb) / <alpha-value>)",
        "surface-hover": "var(--bg-surface-hover)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        "border-light": "rgb(var(--border-light-rgb) / <alpha-value>)",
        main: "rgb(var(--text-main-rgb) / <alpha-value>)",
        muted: "rgb(var(--text-muted-rgb) / <alpha-value>)",
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
        "primary-hover": "var(--primary-hover)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        success: "rgb(var(--success-rgb) / <alpha-value>)",
      },
      borderRadius: {
        xl2: "20px",
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
