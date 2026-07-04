export const uetClerkAppearance = {
  variables: {
    colorPrimary: "oklch(84% 0.19 80.46)", // ks-kinpaku-gold
    colorText: "oklch(88% 0 0)", // ks-text-warm
    colorTextSecondary: "oklch(72% 0 0)", // ks-text-muted
    colorBackground: "oklch(11% 0.006 95)", // ks-raised-lacquer
    colorInputBackground: "oklch(7% 0.006 95)", // ks-lacquer-black
    colorInputText: "oklch(88% 0 0)",
    borderRadius: "10px",
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    card: {
      boxShadow: "0 10px 15px oklch(0 0 0 / 0.3), 0 4px 6px oklch(0 0 0 / 0.2)",
      border: "1px solid oklch(78% 0 0 / 0.16)", // ks-rule
      borderRadius: "14px",
    },
    headerTitle: {
      color: "oklch(84% 0.19 80.46)", // ks-kinpaku-gold
      fontWeight: "600",
      letterSpacing: "-0.02em",
    },
    headerSubtitle: {
      color: "oklch(72% 0 0)",
    },
    formButtonPrimary: {
      backgroundColor: "oklch(84% 0.19 80.46)",
      color: "oklch(4% 0.004 95)", // dark text on gold button
      borderRadius: "8px",
      fontWeight: "500",
      transition: "all 150ms ease",
      "&:hover": {
        backgroundColor: "oklch(86% 0.07 84)",
      },
      "&:active": {
        backgroundColor: "oklch(77% 0.13 82)",
        transform: "scale(0.97)",
      },
    },
    formFieldInput: {
      borderRadius: "8px",
      border: "1px solid oklch(78% 0 0 / 0.16)",
      transition: "all 150ms ease",
      "&:focus": {
        borderColor: "oklch(84% 0.19 80.46)",
        boxShadow: "0 0 0 3px oklch(84% 0.19 80.46 / 0.2)",
      },
    },
    footerActionLink: {
      color: "oklch(84% 0.19 80.46)",
      "&:hover": { color: "oklch(86% 0.07 84)" },
    },
    socialButtonsBlockButton: {
      border: "1px solid oklch(78% 0 0 / 0.16)",
      borderRadius: "8px",
      color: "oklch(88% 0 0)",
      transition: "all 150ms ease",
      "&:hover": { backgroundColor: "oklch(15% 0.008 95)" },
    },
    dividerLine: {
      backgroundColor: "oklch(78% 0 0 / 0.16)",
    },
    formFieldLabel: {
      color: "oklch(88% 0 0)",
      fontWeight: "500",
    },
  },
};
