# SEO/AEO Strategy

## Page Targeting

Each outcome page targets:
- **SEO keywords**: Specific tool combinations (e.g., "zoom to notion automation")
- **AEO questions**: Direct answers for AI search (e.g., "How do I automatically sync Zoom meetings to Notion?")
- **Differentiation**: What competitors don't do

## Structured Data Requirements

Every landing page should include:

### SoftwareApplication Schema
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Product Name",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": [...]
}
```

### FAQPage Schema (for AEO)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I...",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Direct, concise answer for AI extraction"
      }
    }
  ]
}
```

## Meta Tags

Required for every page:
- `<title>` - Include primary keyword
- `<meta name="description">` - Outcome-focused, includes differentiator
- `<link rel="canonical">` - Absolute URL
- Open Graph tags (`og:title`, `og:description`, `og:type`, `og:url`)
- Twitter cards (`twitter:card`, `twitter:title`, `twitter:description`)
