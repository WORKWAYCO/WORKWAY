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
 */

import TOKENS_CSS from './tokens.css';

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
