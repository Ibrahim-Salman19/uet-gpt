// Safe Clerk appearance: only plain CSS properties (no &:hover / &:focus
// pseudo-selector nesting - those throw at runtime in Clerk v7 SSR).
// Hover/focus states are handled by Clerk's built-in colorPrimary theming.
export const uetClerkAppearance = {
  variables: {
    colorPrimary: "oklch(84% 0.19 80.46)", // kinpaku-gold
    colorText: "oklch(88% 0 0)", // ks-text-warm
    colorTextSecondary: "oklch(72% 0 0)", // ks-text-muted
    colorBackground: "oklch(11% 0.006 95)", // ks-raised-lacquer
    colorInputBackground: "oklch(7% 0.006 95)", // ks-lacquer-black
    colorInputText: "oklch(88% 0 0)",
    colorNeutral: "oklch(88% 0 0)",
    borderRadius: "10px",
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    fontSize: "14px",
    spacingUnit: "16px",
  },
  elements: {
    card: {
      boxShadow: "0 10px 15px oklch(0 0 0 / 0.3), 0 4px 6px oklch(0 0 0 / 0.2)",
      border: "1px solid oklch(78% 0 0 / 0.16)",
      borderRadius: "14px",
      backgroundColor: "oklch(11% 0.006 95)",
    },
    headerTitle: {
      color: "oklch(84% 0.19 80.46)",
      fontWeight: "600",
      letterSpacing: "-0.02em",
    },
    headerSubtitle: {
      color: "oklch(72% 0 0)",
    },
    formButtonPrimary: {
      backgroundColor: "oklch(84% 0.19 80.46)",
      color: "oklch(4% 0.004 95)",
      borderRadius: "8px",
      fontWeight: "500",
    },
    formFieldInput: {
      borderRadius: "8px",
      border: "1px solid oklch(78% 0 0 / 0.16)",
      backgroundColor: "oklch(7% 0.006 95)",
      color: "oklch(88% 0 0)",
    },
    footerActionLink: {
      color: "oklch(84% 0.19 80.46)",
    },
    socialButtonsBlockButton: {
      border: "1px solid oklch(78% 0 0 / 0.16)",
      borderRadius: "8px",
      color: "oklch(88% 0 0)",
      backgroundColor: "oklch(11% 0.006 95)",
    },
    dividerLine: {
      backgroundColor: "oklch(78% 0 0 / 0.16)",
    },
    dividerText: {
      color: "oklch(62% 0 0)",
    },
    formFieldLabel: {
      color: "oklch(88% 0 0)",
      fontWeight: "500",
    },
    identityPreviewText: {
      color: "oklch(88% 0 0)",
    },
    identityPreviewEditButton: {
      color: "oklch(84% 0.19 80.46)",
    },
  },
} as const;
