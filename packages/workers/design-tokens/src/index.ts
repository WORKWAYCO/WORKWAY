/**
 * WORKWAY Design Tokens CDN Worker
 *
 * Zuhandenheit: The tool recedes - developers add one <link> tag,
 * design flows through automatically.
 *
 * "Weniger, aber besser" - This worker serves:
 * - /tokens.css - canonical CSS design tokens
 * - /fonts.css - Stack Sans Notch + JetBrains Mono (proxied from Google Fonts)
 * - /lucide.js - Lucide icons library (proxied with caching)
 * - /brand - brand assets page with logo downloads
 */

import TOKENS_CSS from './tokens.css';
import BRAND_HTML from './brand.html';

// Lucide version pinned for consistency across all WORKWAY properties
const LUCIDE_VERSION = '0.468.0';
const LUCIDE_CDN_URL = `https://unpkg.com/lucide@${LUCIDE_VERSION}/dist/umd/lucide.min.js`;

// Google Fonts URLs for WORKWAY canonical typefaces
const GOOGLE_FONTS_CSS_URL =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Stack+Sans+Notch:wght@200..700&display=swap';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // Serve tokens.css at root or /tokens.css
    if (path === '/' || path === '/tokens.css') {
      return new Response(TOKENS_CSS, {
        headers: {
          'Content-Type': 'text/css; charset=utf-8',
          // Aggressive caching: 24hr fresh, 7-day stale-while-revalidate
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          ...corsHeaders(),
        },
      });
    }

    // Serve fonts (proxied from Google Fonts for single-CDN convenience)
    if (path === '/fonts.css') {
      return await serveFonts(request);
    }

    // Serve Lucide icons library (proxied for version consistency)
    if (path === '/lucide.js') {
      return await serveLucide();
    }

    // Health check
    if (path === '/health') {
      return new Response('OK', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Brand assets page
    if (path === '/brand') {
      return new Response(BRAND_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          ...corsHeaders(),
        },
      });
    }

    // Serve brand SVG assets
    if (path.startsWith('/brand/')) {
      return serveBrandAsset(path);
    }

    // 404 for everything else
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};

/**
 * Proxy and cache Google Fonts CSS
 * Forwards User-Agent to get appropriate font format (woff2 for modern browsers)
 * Provides single-CDN convenience: developers add one link, fonts work
 */
async function serveFonts(request: Request): Promise<Response> {
  try {
    // Forward User-Agent to get appropriate font formats
    const userAgent = request.headers.get('User-Agent') || '';

    const response = await fetch(GOOGLE_FONTS_CSS_URL, {
      headers: {
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      return new Response('Failed to fetch fonts', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const css = await response.text();

    return new Response(css, {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        // Cache for 24 hours, stale-while-revalidate for 7 days
        // Font CSS rarely changes, safe to cache aggressively
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        ...corsHeaders(),
      },
    });
  } catch (error) {
    return new Response('Error fetching fonts', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Proxy and cache Lucide icons library from unpkg
 * Provides consistent versioning across all WORKWAY properties
 */
async function serveLucide(): Promise<Response> {
  try {
    const response = await fetch(LUCIDE_CDN_URL);

    if (!response.ok) {
      return new Response('Failed to fetch Lucide icons', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const script = await response.text();

    return new Response(script, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        // Aggressive caching: 7 days fresh, 30-day stale-while-revalidate
        // Safe to cache longer since we pin the version
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
        ...corsHeaders(),
      },
    });
  } catch (error) {
    return new Response('Error fetching Lucide icons', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

function corsHeaders(): Record<string, string> {
  return {
    // CORS - public CDN allows all origins
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Note: X-Frame-Options and CSP omitted - CSS files don't need frame/script protection
  };
}

/**
 * Serve brand SVG assets directly from CDN
 * Avoids dependency on GitHub raw URLs
 */
function serveBrandAsset(path: string): Response {
  const assets: Record<string, string> = {
    '/brand/icon-with-bg.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="80" fill="#161616"/>
  <g transform="translate(128, 128) scale(10.67, 10.67)">
    <rect width="8" height="8" x="3" y="3" rx="2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect width="8" height="8" x="13" y="13" rx="2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`,

    '/brand/icon-circular.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="256" fill="#161616"/>
  <g transform="translate(128, 128) scale(10.67, 10.67)">
    <rect width="8" height="8" x="3" y="3" rx="2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect width="8" height="8" x="13" y="13" rx="2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`,

    '/brand/icon-only.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="8" height="8" x="3" y="3" rx="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect width="8" height="8" x="13" y="13" rx="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`,

    '/brand/wordmark-white.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="280" height="48" viewBox="0 0 280 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="36" fill="white" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="40" font-weight="600" letter-spacing="-0.02em">WORKWAY</text>
</svg>`,

    '/brand/wordmark-black.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="280" height="48" viewBox="0 0 280 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="36" fill="#161616" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="40" font-weight="600" letter-spacing="-0.02em">WORKWAY</text>
</svg>`,

    '/brand/lockup-horizontal-light.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="340" height="48" viewBox="0 0 340 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0, 0) scale(2)">
    <rect width="8" height="8" x="3" y="3" rx="2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect width="8" height="8" x="13" y="13" rx="2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
  <text x="72" y="36" fill="white" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="40" font-weight="600" letter-spacing="-0.02em">WORKWAY</text>
</svg>`,

    '/brand/lockup-horizontal-dark.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="340" height="48" viewBox="0 0 340 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0, 0) scale(2)">
    <rect width="8" height="8" x="3" y="3" rx="2" stroke="#161616" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke="#161616" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect width="8" height="8" x="13" y="13" rx="2" stroke="#161616" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
  <text x="72" y="36" fill="#161616" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="40" font-weight="600" letter-spacing="-0.02em">WORKWAY</text>
</svg>`,

    '/brand/lockup-stacked-light.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="280" height="120" viewBox="0 0 280 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(112, 8) scale(2.33)">
    <rect width="8" height="8" x="3" y="3" rx="2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect width="8" height="8" x="13" y="13" rx="2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
  <text x="140" y="105" fill="white" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="36" font-weight="600" letter-spacing="-0.02em" text-anchor="middle">WORKWAY</text>
</svg>`,

    '/brand/lockup-stacked-dark.svg': `<?xml version="1.0" encoding="UTF-8"?>
<svg width="280" height="120" viewBox="0 0 280 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(112, 8) scale(2.33)">
    <rect width="8" height="8" x="3" y="3" rx="2" stroke="#161616" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M7 11v4a2 2 0 0 0 2 2h4" stroke="#161616" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect width="8" height="8" x="13" y="13" rx="2" stroke="#161616" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
  <text x="140" y="105" fill="#161616" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="36" font-weight="600" letter-spacing="-0.02em" text-anchor="middle">WORKWAY</text>
</svg>`,
  };

  const svg = assets[path];
  if (svg) {
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Disposition': `attachment; filename="${path.split('/').pop()}"`,
        ...corsHeaders(),
      },
    });
  }

  return new Response('Asset not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  });
}
