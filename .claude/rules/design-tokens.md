# Design Token Distribution

## CDN Pattern

Private/BYOO workflows inherit WORKWAY design automatically via CDN:

```html
<head>
  <!-- Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Stack+Sans+Notch:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <!-- Design Tokens - ONE LINE -->
  <link rel="stylesheet" href="https://cdn.workway.co/tokens.css" />
  <!-- Icons - version-pinned Lucide via CDN -->
  <script src="https://cdn.workway.co/lucide.js"></script>
</head>
```

## What the CDN Provides

- Color tokens: `--color-bg-pure`, `--color-fg-primary`, `--color-success`, etc.
- Short aliases: `--bg-pure`, `--fg-primary`, `--success` (backwards compatibility)
- Typography: `--font-sans`, `--font-mono`, `--text-h1`, `--text-body`, etc.
- Spacing: `--space-xs` to `--space-2xl` (Golden Ratio scale)
- Animation: `--ease-standard`, `--duration-standard`, etc.
- Base body styles: font-family, background, color, antialiasing

**Zuhandenheit achieved:** Developer adds one `<link>` tag. Design flows through. The mechanism disappears.

**CDN Worker location:** `packages/workers/design-tokens/`

## Color Palette (Pure Black Canvas)

```css
body {
  background: #000000;  /* Pure black - no grey */
  color: #ffffff;       /* Pure white */
}

/* Borders: subtle, purposeful */
.border {
  border-color: rgba(255, 255, 255, 0.1);
}

/* REJECT: Any of these */
/* background: #111111; ❌ */
/* background: #1a1a1a; ❌ */
/* background: rgb(30, 30, 30); ❌ */
```

## Typography Scale

```css
h1 {
  font-size: clamp(3.5rem, 9vw, 7rem);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.025em;
}

h2 {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 600;
  line-height: 1.15;
}

p {
  font-size: clamp(1rem, 1.5vw, 1.25rem);
  line-height: 1.6;
}
```

## Spacing (Golden Ratio φ = 1.618)

```css
:root {
  --space-xs: 0.5rem;      /* 8px */
  --space-sm: 1rem;        /* 16px */
  --space-md: 1.618rem;    /* φ¹ ≈ 26px */
  --space-lg: 2.618rem;    /* φ² ≈ 42px */
  --space-xl: 4.236rem;    /* φ³ ≈ 68px */
  --space-2xl: 6.854rem;   /* φ⁴ ≈ 110px */
}
```
