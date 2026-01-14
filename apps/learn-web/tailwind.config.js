/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      spacing: {
        // Golden Ratio Scale (φ = 1.618)
        xs: "var(--space-xs)", // 0.5rem / 8px
        sm: "var(--space-sm)", // 1rem / 16px
        md: "var(--space-md)", // 1.618rem / ~26px
        lg: "var(--space-lg)", // 2.618rem / ~42px
        xl: "var(--space-xl)", // 4.236rem / ~68px
        "2xl": "var(--space-2xl)", // 6.854rem / ~110px
        "3xl": "var(--space-3xl)", // 11.089rem / ~177px
        // Page layout aliases
        "page-x": "var(--page-padding-x)",
        "page-y": "var(--page-padding-y)",
        section: "var(--section-gap)",
      },
      transitionDuration: {
        hover: "150ms",
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": "var(--color-fg-primary)",
            "--tw-prose-headings": "var(--color-fg-primary)",
            "--tw-prose-links": "var(--color-info)",
            "--tw-prose-bold": "var(--color-fg-primary)",
            "--tw-prose-code": "var(--color-fg-primary)",
            "--tw-prose-pre-bg": "var(--color-bg-surface)",
            "--tw-prose-pre-code": "var(--color-fg-primary)",
            "--tw-prose-quotes": "var(--color-fg-muted)",
            "--tw-prose-hr": "var(--color-border-default)",
            maxWidth: "none",
            code: {
              backgroundColor: "var(--color-bg-surface)",
              padding: "0.25rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              fontWeight: "400",
            },
            "code::before": {
              content: '""',
            },
            "code::after": {
              content: '""',
            },
            pre: {
              backgroundColor: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "var(--radius-md)",
            },
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
