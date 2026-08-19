import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables (see globals.css) so the shade can go
        // darker automatically in dark mode, while still supporting
        // Tailwind's opacity modifiers (bg-brand/15, etc.) via the
        // "rgb(var(...) / <alpha-value>)" pattern.
        brand: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dark: "rgb(var(--accent-hover) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
