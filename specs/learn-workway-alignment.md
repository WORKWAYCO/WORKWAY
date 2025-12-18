# Learn WORKWAY Design Alignment

Align learn.workway.co with WORKWAY's design system and implement SEO/AEO best practices.

## Overview

The learn.workway.co platform needs to:
1. Use WORKWAY design tokens via CDN (pure black canvas, golden ratio spacing)
2. Implement comprehensive SEO meta tags
3. Add structured data for AEO (Answer Engine Optimization)
4. Ensure consistent typography and component patterns

## Feature: CDN Design Tokens Integration

Replace hardcoded styles with WORKWAY CDN design tokens.

### Acceptance Criteria
- Add WORKWAY CDN stylesheet link to app.html
- Add Stack Sans Notch and JetBrains Mono fonts
- Add Lucide icons via CDN
- Remove conflicting local styles that override CDN tokens
- Verify pure black (#000000) background, not grey variants

## Feature: Typography Alignment

Update typography to match WORKWAY design system.

### Acceptance Criteria
- H1: clamp(3.5rem, 9vw, 7rem), weight 600, line-height 1.05
- H2: clamp(2rem, 5vw, 3.5rem), weight 600, line-height 1.15
- Body: clamp(1rem, 1.5vw, 1.25rem), line-height 1.6
- Use CSS custom properties from CDN tokens
- Apply letter-spacing -0.025em on headings

## Feature: Spacing System Update

Implement golden ratio spacing from WORKWAY design tokens.

### Acceptance Criteria
- Use --space-xs (0.5rem) through --space-2xl (6.854rem)
- Update padding and margins to use token values
- Ensure consistent spacing across all pages
- Remove hardcoded px/rem values in favor of tokens

## Feature: Homepage SEO Meta Tags

Add comprehensive SEO meta tags to the homepage.

### Acceptance Criteria
- Title tag with primary keyword
- Meta description (outcome-focused, 150-160 chars)
- Canonical URL (https://learn.workway.co)
- Open Graph tags (og:title, og:description, og:type, og:url, og:image)
- Twitter card tags (twitter:card, twitter:title, twitter:description)

## Feature: Learning Paths SEO

Add SEO optimization to learning path pages.

### Acceptance Criteria
- Dynamic title tags per path (e.g., "Workflow Foundations | Learn WORKWAY")
- Unique meta descriptions per path
- Canonical URLs for each path
- Open Graph and Twitter tags

## Feature: Course Schema Structured Data

Implement Course schema for AEO on learning paths.

### Acceptance Criteria
- Add Course schema to each learning path
- Include provider (WORKWAY), name, description
- Add coursePrerequisites where applicable
- Include educationalLevel and timeRequired

## Feature: FAQPage Schema for AEO

Add FAQ structured data for common questions.

### Acceptance Criteria
- Create FAQ schema on homepage
- Questions: "What is WORKWAY?", "How do I build a workflow?", "What is defineWorkflow()?"
- Direct, concise answers optimized for AI extraction
- Valid JSON-LD in script tag

## Feature: Lesson Page SEO

Optimize individual lesson pages for search.

### Acceptance Criteria
- Dynamic title: "{Lesson Title} | {Path Name} | Learn WORKWAY"
- Meta description from lesson excerpt
- Breadcrumb structured data (BreadcrumbList schema)
- Previous/next lesson links with rel="prev"/rel="next"

## Feature: Component Pattern Alignment

Update UI components to match WORKWAY patterns.

### Acceptance Criteria
- Cards use --color-bg-elevated and border-white/10
- Buttons use button-primary class with consistent styling
- Icons use Lucide with consistent sizing (16, 20, 24px scale)
- Hover states use transition-colors with 150ms duration
