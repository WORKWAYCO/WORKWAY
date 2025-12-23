# WORKWAY Logo Pack

Official logo assets for WORKWAY.

## Quick Start

### For Dark Backgrounds
Use files with `-light` suffix (white icon/text):
- `svg/lockup-horizontal-light.svg`
- `svg/lockup-stacked-light.svg`
- `svg/wordmark-white.svg`

### For Light Backgrounds
Use files with `-dark` suffix (dark icon/text):
- `svg/lockup-horizontal-dark.svg`
- `svg/lockup-stacked-dark.svg`
- `svg/wordmark-black.svg`

### Icon Only
- `svg/icon-with-bg.svg` — Rounded square with #161616 background
- `svg/icon-circular.svg` — Circular with #161616 background
- `svg/icon-only.svg` — Transparent, uses `currentColor`

---

## Directory Structure

```
logo-pack/
├── README.md              ← You are here
├── BRAND_GUIDELINES.md    ← Full usage guidelines
├── svg/
│   ├── icon-with-bg.svg       Icon with rounded square bg
│   ├── icon-circular.svg      Icon with circular bg (GitHub)
│   ├── icon-only.svg          Transparent icon (currentColor)
│   ├── wordmark-white.svg     White text
│   ├── wordmark-black.svg     Dark text
│   ├── lockup-horizontal-light.svg
│   ├── lockup-horizontal-dark.svg
│   ├── lockup-stacked-light.svg
│   └── lockup-stacked-dark.svg
├── png/
│   ├── README.md              PNG generation instructions
│   └── icon-512.png           512×512 icon
├── social/
│   └── (generate as needed)
└── favicon/
    └── (copy from apps/learn-web/static/)
```

---

## Generating PNGs

Use the built-in PNG generator:

```bash
open ../logo-to-png.html
```

Or serve via HTTP for full functionality:
```bash
python -m http.server 8000
# Visit http://localhost:8000/assets/logo-to-png.html
```

---

## Brand Guidelines

See [BRAND_GUIDELINES.md](./BRAND_GUIDELINES.md) for:
- Color palette
- Clearspace requirements
- Minimum sizes
- Prohibited uses
- Typography

---

## Font Note

SVG wordmarks use Inter as a fallback. For the official WORKWAY font (Stack Sans Notch), the SVGs will render correctly when viewed in a browser with the CDN stylesheet loaded:

```html
<link rel="stylesheet" href="https://cdn.workway.co/fonts.css" />
```
