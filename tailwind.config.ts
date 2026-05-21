const config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        uetPrimary: {
          DEFAULT: "oklch(0.35 0.07 265)",
          hover: "oklch(0.3 0.08 265)",
          active: "oklch(0.25 0.09 265)",
          foreground: "oklch(0.95 0.005 30)",
          muted: "oklch(0.85 0.02 265)",
        },
        uetGold: {
          DEFAULT: "oklch(0.68 0.14 75)",
          hover: "oklch(0.72 0.14 75)",
          active: "oklch(0.64 0.13 75)",
          foreground: "oklch(0.2 0.02 265)",
          muted: "oklch(0.85 0.04 75)",
        },
      },
      fontFamily: {
        sans: ["Geist", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        xs: "6px",
        sm: "8px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        "2xl": "28px",
      },
      spacing: {
        "0": "0px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
        "24": "96px",
      },
      animation: {
        "stagger-fade-in": "stagger-fade-in 600ms var(--ease-out-expo) forwards",
        shimmer: "shimmer 2s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "slide-up": "slide-up 400ms var(--ease-out-quart)",
      },
      keyframes: {
        "stagger-fade-in": {
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
