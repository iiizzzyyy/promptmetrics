import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        xs: "552px",
        mdPlus: "728px",
        lgPlus: "904px",
        xlPlus: "1080px",
      },
      fontFamily: {
        heading: [
          "var(--font-geist-sans)",
          "Geist",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        body: [
          "var(--font-geist-sans)",
          "Geist",
          "Source Serif Pro",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "Geist Mono",
          "Courier New",
          "Courier",
          "Monaco",
          "monospace",
        ],
      },
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",

        card: "rgb(var(--card) / <alpha-value>)",
        "card-foreground": "rgb(var(--card-foreground) / <alpha-value>)",

        accent: "rgb(var(--accent))",
        "accent-foreground": "rgb(var(--accent-foreground))",

        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-foreground": "rgb(var(--primary-foreground) / <alpha-value>)",

        secondary: "rgb(var(--secondary) / <alpha-value>)",
        "secondary-foreground":
          "rgb(var(--secondary-foreground) / <alpha-value>)",

        muted: "rgb(var(--muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--muted-foreground) / <alpha-value>)",

        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",

        destructive: {
          DEFAULT: "rgb(239 68 68 / <alpha-value>)",
          foreground: "rgb(255 255 255 / <alpha-value>)",
        },

        pm: {
          bg: "#0a0a0a",
          "bg-raised": "#0d0d0d",
          surface: "#111111",
          "surface-hover": "#171717",
          fg: "#ededed",
          "fg-muted": "#a1a1a1",
          "fg-dim": "#6b6b6b",
          brand: "#389438",
          "brand-bright": "#5cc15c",
          border: "rgba(255, 255, 255, 0.1)",
          "border-subtle": "rgba(255, 255, 255, 0.06)",
          "border-medium": "rgba(255, 255, 255, 0.08)",
          glow: "rgba(56, 148, 56, 0.3)",
        },
      },
      boxShadow: {
        soft: "0 10px 25px -10px rgba(0,0,0,0.15)",
        card: "0 2px 10px -2px rgba(0,0,0,0.1)",
        glow: "0 0 0 1px rgba(56,148,56,.4), 0 4px 12px -2px rgba(56,148,56,.30)",
        "glow-lg": "0 0 0 1px rgba(56,148,56,.5), 0 8px 24px -4px rgba(56,148,56,.4)",
      },
    },
  },
  plugins: [],
};

export default config;
