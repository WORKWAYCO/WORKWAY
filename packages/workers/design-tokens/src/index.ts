/**
 * WORKWAY Design Tokens CDN Worker
 *
 * Zuhandenheit: The tool recedes - developers add one <link> tag,
 * design flows through automatically.
 *
 * "Weniger, aber besser" - This worker does one thing:
 * serve canonical CSS design tokens.
 */

import TOKENS_CSS from './tokens.css';

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
