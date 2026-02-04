/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        // Monochromatic palette - primary design language
        bg: {
          pure: "var(--color-bg-pure)",
          elevated: "var(--color-bg-elevated)",
          surface: "var(--color-bg-surface)",
          subtle: "var(--color-bg-subtle)",
        },
        fg: {
          primary: "var(--color-fg-primary)",
          secondary: "var(--color-fg-secondary)",
          tertiary: "var(--color-fg-tertiary)",
          muted: "var(--color-fg-muted)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          emphasis: "var(--color-border-emphasis)",
          strong: "var(--color-border-strong)",
        },
        // Accent - use sparingly (primary CTA, step numbers, logo only)
        accent: {
          DEFAULT: "var(--color-success)", // Emerald
          muted: "rgba(52, 211, 153, 0.15)",
          subtle: "rgba(52, 211, 153, 0.08)",
        },
      },
      spacing: {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      transitionDuration: {
        hover: "var(--duration-hover)",
        standard: "var(--duration-standard)",
      },
      animation: {
        "fade-in-up": "fadeInUp var(--duration-standard) var(--ease-standard) forwards",
        "shimmer": "shimmer 2s linear infinite",
        "border-beam": "borderBeam 4s linear infinite",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "0 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        borderBeam: {
          "0%": { "--beam-position": "0%" },
          "100%": { "--beam-position": "100%" },
        },
      },
    },
  },
  plugins: [],
};
