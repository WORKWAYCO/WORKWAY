# WORKWAY Logo Pack

## Overview

Create a comprehensive logo pack for WORKWAY that Danny and the team can share with partners, use in marketing materials, and reference for brand consistency.

**Philosophy**: Zuhandenheit—the brand recedes, recognition remains. Weniger, aber besser—only essential variations, no bloat.

**Inspiration**: Webflow's brand guidelines (https://brand.webflow.com/design-guidelines#logo-usage)

**Existing Assets**:
- `/assets/logo-official.svg` - 512×512 rounded square, #161616 bg, white workflow icon
- `/assets/logo-github.svg` - 512×512 circular, #161616 bg
- `/assets/logo-square.svg` - 24×24 icon, uses currentColor
- `/assets/workway-oauth-icon.png` - 512×512 OAuth icon

**Brand Foundation**:
- Primary color: #161616 (near-black)
- Foreground: #FFFFFF (pure white)
- Font: Stack Sans Notch (Google Fonts, served via cdn.workway.co/fonts.css)
- Icon: Lucide workflow icon (two connected nodes)

**Deliverable Location**: `/assets/logo-pack/`

## Features

### Create wordmark SVG
Create `assets/logo-pack/wordmark.svg` with "WORKWAY" text in Stack Sans Notch font.
- Use SVG text element with font-family: "Stack Sans Notch", sans-serif
- White (#FFFFFF) fill color on transparent background
- Font-weight: 600 (semi-bold)
- Letter-spacing: -0.02em for tight, modern feel
- Create both `wordmark-white.svg` (white text) and `wordmark-black.svg` (black text)
- Viewbox sized to fit text with minimal padding

### Create horizontal lockup SVG
Create `assets/logo-pack/lockup-horizontal.svg` combining icon + wordmark.
- Icon on left, wordmark on right
- Gap between icon and wordmark equals icon height × 0.5
- Two variants: `lockup-horizontal-dark.svg` (for light backgrounds) and `lockup-horizontal-light.svg` (for dark backgrounds)
- Proper viewBox to contain both elements with clearspace

### Create stacked lockup SVG
Create `assets/logo-pack/lockup-stacked.svg` with icon above wordmark.
- Icon centered above wordmark
- Gap between icon and wordmark equals icon height × 0.4
- Two variants: `lockup-stacked-dark.svg` and `lockup-stacked-light.svg`
- Suitable for square/portrait placements

### Generate PNG exports
Create PNG versions of all logo variants using the existing `logo-to-png.html` tool or Node.js canvas.
- Sizes: 256×256, 512×512, 1024×1024 for square assets
- Icon-only PNGs: `icon-256.png`, `icon-512.png`, `icon-1024.png`
- Lockup PNGs at appropriate aspect ratios
- Both light (white icon/text) and dark (black icon/text) variants

### Create social media assets
Create optimized images for social platforms in `assets/logo-pack/social/`.
- Open Graph image: 1200×630px with centered lockup on #161616 background
- Twitter card: 1200×600px variant
- LinkedIn banner: 1584×396px with horizontal lockup
- Favicon package: 16×16, 32×32, 180×180 (apple-touch), 192×192 (android)

### Write brand guidelines document
Create `assets/logo-pack/BRAND_GUIDELINES.md` documenting proper logo usage.
- Clearspace: Minimum padding equal to icon height on all sides
- Minimum sizes: Icon alone 24px, lockup 120px wide
- Color usage: When to use light vs dark variants
- Prohibited uses: Don't stretch, rotate, add effects, change colors, crop
- Background requirements: Sufficient contrast (light logos on dark, dark logos on light)
- File format guidance: When to use SVG vs PNG
- Include visual examples using markdown image references

### Create downloadable zip structure
Organize `assets/logo-pack/` with clear folder structure for easy distribution.
- `/svg/` - All vector files (icon, wordmark, lockups)
- `/png/` - All raster exports organized by size
- `/social/` - Platform-specific assets
- `/favicon/` - Favicon package
- `README.md` - Quick reference guide pointing to full brand guidelines
- `BRAND_GUIDELINES.md` - Complete usage documentation

### Verification
Confirm logo pack is complete and usable.
- All SVG files validate (no broken paths or missing fonts)
- PNG files exist at specified sizes
- Brand guidelines document is comprehensive
- Folder structure is intuitive
- Test SVG files render correctly in browser
