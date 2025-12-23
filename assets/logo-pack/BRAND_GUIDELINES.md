# WORKWAY Brand Guidelines

## Philosophy

**Zuhandenheit** — The tool should recede; the outcome should remain.

**Weniger, aber besser** — Less, but better.

---

## Logo Elements

### Icon
The WORKWAY icon represents connected workflows — two nodes joined by a path. Based on the Lucide "workflow" icon.

### Wordmark
"WORKWAY" in Inter (or Stack Sans Notch) at weight 600 with -0.02em letter-spacing.

### Lockups
- **Horizontal**: Icon left, wordmark right
- **Stacked**: Icon above, wordmark below (for square/portrait placements)

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Near-black | `#161616` | Primary background, dark text |
| Pure white | `#FFFFFF` | Light text, light icons |

### When to Use Each Variant

| Background | Use |
|------------|-----|
| Dark (`#161616`, `#000000`) | Light variant (white icon/text) |
| Light (`#FFFFFF`, `#F5F5F5`) | Dark variant (dark icon/text) |

---

## Clearspace

Minimum padding around the logo should equal the height of the icon on all sides.

```
┌─────────────────────────────────┐
│                                 │
│     ╔═══╗                       │
│     ║   ║ ═══► WORKWAY          │
│     ╚═══╝                       │
│                                 │
└─────────────────────────────────┘
       ↑ clearspace = icon height
```

---

## Minimum Sizes

| Element | Minimum Width |
|---------|---------------|
| Icon only | 24px |
| Horizontal lockup | 120px |
| Stacked lockup | 80px |

---

## Prohibited Uses

**Do not:**

- ✗ Stretch or distort the logo
- ✗ Rotate the logo
- ✗ Add drop shadows or effects
- ✗ Change the logo colors (use provided variants)
- ✗ Crop or partially obscure the logo
- ✗ Place on busy backgrounds without sufficient contrast
- ✗ Outline or add strokes
- ✗ Animate the logo (except subtle fade-in)
- ✗ Use low-contrast color combinations

---

## File Formats

| Format | When to Use |
|--------|-------------|
| SVG | Web, scalable contexts, when text can load fonts |
| PNG | Social media, email signatures, documents |
| Favicon | Browser tabs, bookmarks |

---

## Typography

**Primary Font**: Inter (or Stack Sans Notch when available via CDN)

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
font-weight: 600;
letter-spacing: -0.02em;
```

**Monospace**: JetBrains Mono (for code contexts)

---

## CDN Resources

For web projects, use the WORKWAY design token CDN:

```html
<!-- Fonts -->
<link rel="stylesheet" href="https://cdn.workway.co/fonts.css" />

<!-- Design Tokens -->
<link rel="stylesheet" href="https://cdn.workway.co/tokens.css" />

<!-- Icons (Lucide) -->
<script src="https://cdn.workway.co/lucide.js"></script>
```

---

## Contact

Questions about brand usage? Reach out to the team.
