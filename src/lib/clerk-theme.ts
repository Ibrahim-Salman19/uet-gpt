export const uetClerkAppearance = {
  variables: {
    colorPrimary: "oklch(0.35 0.07 265)",
    colorText: "oklch(0.15 0.01 265)",
    colorTextSecondary: "oklch(0.35 0.01 265)",
    colorBackground: "oklch(0.985 0.003 265)",
    colorInputBackground: "oklch(1 0 0)",
    colorInputText: "oklch(0.15 0.01 265)",
    borderRadius: "10px",
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    card: {
      boxShadow: "0 10px 15px oklch(0 0 0 / 0.05), 0 4px 6px oklch(0 0 0 / 0.03)",
      border: "1px solid oklch(0.88 0.008 265)",
      borderRadius: "14px",
    },
    headerTitle: {
      color: "oklch(0.35 0.07 265)",
      fontWeight: "600",
      letterSpacing: "-0.02em",
    },
    headerSubtitle: {
      color: "oklch(0.35 0.01 265)",
    },
    formButtonPrimary: {
      backgroundColor: "oklch(0.35 0.07 265)",
      borderRadius: "8px",
      fontWeight: "500",
      transition: "all 150ms ease",
      "&:hover": {
        backgroundColor: "oklch(0.3 0.08 265)",
      },
      "&:active": {
        backgroundColor: "oklch(0.25 0.09 265)",
        transform: "scale(0.97)",
      },
    },
    formFieldInput: {
      borderRadius: "8px",
      border: "1px solid oklch(0.88 0.008 265)",
      transition: "all 150ms ease",
      "&:focus": {
        borderColor: "oklch(0.68 0.14 75)",
        boxShadow: "0 0 0 3px oklch(0.85 0.04 75)",
      },
    },
    footerActionLink: {
      color: "oklch(0.35 0.07 265)",
      "&:hover": { color: "oklch(0.3 0.08 265)" },
    },
    socialButtonsBlockButton: {
      border: "1px solid oklch(0.88 0.008 265)",
      borderRadius: "8px",
      transition: "all 150ms ease",
      "&:hover": { backgroundColor: "oklch(0.93 0.008 265)" },
    },
    dividerLine: {
      backgroundColor: "oklch(0.88 0.008 265)",
    },
    formFieldLabel: {
      color: "oklch(0.35 0.01 265)",
      fontWeight: "500",
    },
  },
};
