# WORKWAY Brand Assets

## Official Logo

The WORKWAY logo is the Lucide "workflow" icon - a perfect representation of our platform's purpose.

### Logo Files

- **`logo-official.svg`** - 512x512 with #161616 background (rounded square)
- **`logo-github.svg`** - 512x512 with #161616 background (circle for GitHub profile)
- **`logo-square.svg`** - 24x24 base icon (no background, uses currentColor)

### Brand Colors

- **Background**: `#161616` (dark gray/black)
- **Icon/Text**: `#FFFFFF` (white) or `currentColor` for flexibility

### Usage Guidelines

1. **GitHub Organization Profile**: Use `logo-github.svg`
2. **Web Application**: Use `logo-square.svg` with appropriate size classes
3. **Marketing Materials**: Use `logo-official.svg`
4. **Favicon**: Use `logo-square.svg` or generate from `logo-official.svg`

### Icon Meaning

The workflow icon consists of:
- Two rounded rectangles representing workflow nodes/steps
- A connecting path showing data flow
- Perfect visual metaphor for connecting services (Gmail → Notion, etc.)

### Implementation Example

```html
<!-- In React/Web App -->
<svg xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     viewBox="0 0 24 24"
     fill="none"
     stroke="currentColor"
     stroke-width="2"
     stroke-linecap="round"
     stroke-linejoin="round"
     class="lucide lucide-workflow">
  <rect width="8" height="8" x="3" y="3" rx="2"/>
  <path d="M7 11v4a2 2 0 0 0 2 2h4"/>
  <rect width="8" height="8" x="13" y="13" rx="2"/>
</svg>
```

### License

The workflow icon is part of the Lucide icon set (MIT License).
WORKWAY brand implementation is Apache 2.0 Licensed.