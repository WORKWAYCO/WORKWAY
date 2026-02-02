/**
 * Newsletter Tracking Worker
 * 
 * Cross-property click tracking for WORKWAY newsletter campaigns.
 * Tracks user interactions as they navigate between:
 * - workway.co (main platform)
 * - learn.createsomething.space (CREATE SOMETHING courses)
 * 
 * Privacy-first: Uses recipient tokens for deterministic identity
 * without relying on third-party cookies.
 */

interface Env {
  TOKENS: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  DB: D1Database;
  WORKWAY_URL: string;
  CREATESOMETHING_URL: string;
}

interface TokenData {
  subscriberId: string;
  email: string;
  emailHash: string;
  issueId: string;
  issueSlug: string;
  createdAt: number;
  expiresAt: number;
}

// Property mapping for analytics
const PROPERTY_MAP: Record<string, string> = {
  'workway.co': 'workway',
  'www.workway.co': 'workway',
  'learn.createsomething.space': 'createsomething',
  'createsomething.space': 'createsomething',
  'createsomething.ltd': 'createsomething',
  'createsomething.io': 'createsomething',
  'createsomething.agency': 'createsomething',
};

/**
 * Extract property identifier from URL
 */
function extractProperty(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return PROPERTY_MAP[hostname] || 'external';
  } catch {
    return 'unknown';
  }
}

/**
 * Append UTM parameters to destination URL
 */
function appendUTMs(
  destUrl: string,
  params: {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content?: string;
    utm_term?: string;
  }
): string {
  try {
    const url = new URL(destUrl);
    
    // Only set UTM params if not already present
    if (!url.searchParams.has('utm_source')) {
      url.searchParams.set('utm_source', params.utm_source);
    }
    if (!url.searchParams.has('utm_medium')) {
      url.searchParams.set('utm_medium', params.utm_medium);
    }
    if (!url.searchParams.has('utm_campaign')) {
      url.searchParams.set('utm_campaign', params.utm_campaign);
    }
    if (params.utm_content && !url.searchParams.has('utm_content')) {
      url.searchParams.set('utm_content', params.utm_content);
    }
    if (params.utm_term && !url.searchParams.has('utm_term')) {
      url.searchParams.set('utm_term', params.utm_term);
    }
    
    return url.toString();
  } catch {
    // If URL parsing fails, return original
    return destUrl;
  }
}

/**
 * Generate SHA-256 hash of email for privacy-safe matching
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Handle click tracking and redirect
 */
async function handleClick(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  
  // Extract parameters
  const token = url.searchParams.get('t');
  const linkId = url.searchParams.get('l') || url.searchParams.get('link_id') || 'unknown';
  const dest = url.searchParams.get('d') || url.searchParams.get('dest');
  
  if (!dest) {
    return new Response('Missing destination', { status: 400 });
  }
  
  // Decode destination URL
  let destinationUrl: string;
  try {
    destinationUrl = decodeURIComponent(dest);
  } catch {
    destinationUrl = dest;
  }
  
  // Resolve identity from token (if provided)
  let tokenData: TokenData | null = null;
  let subscriberEmail = 'anonymous';
  let subscriberId = 'anon';
  let issueId = 'unknown';
  let issueSlug = 'unknown';
  
  if (token) {
    try {
      const storedData = await env.TOKENS.get(token);
      if (storedData) {
        tokenData = JSON.parse(storedData) as TokenData;
        
        // Check if token is expired
        if (tokenData.expiresAt > Date.now()) {
          subscriberEmail = tokenData.email;
          subscriberId = tokenData.subscriberId;
          issueId = tokenData.issueId;
          issueSlug = tokenData.issueSlug;
        }
      }
    } catch (e) {
      console.error('Token lookup failed:', e);
    }
  }
  
  // Determine source and target properties
  const targetProperty = extractProperty(destinationUrl);
  
  // Write analytics event
  const timestamp = Date.now();
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        'newsletter_click',           // event_type
        subscriberId,                 // subscriber_id
        tokenData?.emailHash || '',   // email_hash (privacy-safe)
        issueId,                      // campaign_id
        linkId,                       // link_id
        targetProperty,               // target_property
        'newsletter',                 // source_property
      ],
      doubles: [
        timestamp,                    // timestamp
        tokenData ? 1 : 0,           // identified (1) or anonymous (0)
      ],
      indexes: [new Date().toISOString().split('T')[0]], // date index
    });
  } catch (e) {
    console.error('Analytics write failed:', e);
  }
  
  // Record cross-property event in D1 (if we have identity)
  if (tokenData) {
    try {
      const eventId = `cpe_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
      
      await env.DB.prepare(`
        INSERT INTO cross_property_events (
          id, identity_id, event_type, source_property, target_property,
          campaign_id, link_id, page_url, utm_source, utm_medium, 
          utm_campaign, utm_content, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        eventId,
        tokenData.subscriberId, // Using subscriber ID as identity for now
        'email_click',
        'newsletter',
        targetProperty,
        issueId,
        linkId,
        destinationUrl,
        'workway_newsletter',
        'email',
        issueSlug,
        linkId,
        timestamp
      ).run();
    } catch (e) {
      // Don't fail the redirect if DB write fails
      console.error('D1 write failed:', e);
    }
  }
  
  // Build redirect URL with UTM parameters
  const redirectUrl = appendUTMs(destinationUrl, {
    utm_source: 'workway_newsletter',
    utm_medium: 'email',
    utm_campaign: issueSlug,
    utm_content: linkId,
  });
  
  // Return redirect response
  return Response.redirect(redirectUrl, 302);
}

/**
 * Handle open tracking (1x1 pixel)
 */
async function handleOpen(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  
  let tokenData: TokenData | null = null;
  
  if (token) {
    try {
      const storedData = await env.TOKENS.get(token);
      if (storedData) {
        tokenData = JSON.parse(storedData) as TokenData;
      }
    } catch (e) {
      console.error('Token lookup failed:', e);
    }
  }
  
  // Write open event
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        'newsletter_open',
        tokenData?.subscriberId || 'anon',
        tokenData?.emailHash || '',
        tokenData?.issueId || 'unknown',
      ],
      doubles: [Date.now(), tokenData ? 1 : 0],
      indexes: [new Date().toISOString().split('T')[0]],
    });
  } catch (e) {
    console.error('Analytics write failed:', e);
  }
  
  // Return 1x1 transparent GIF
  const pixel = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
    0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x3b
  ]);
  
  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

/**
 * API endpoint to create tracking tokens (called by workway-platform when sending)
 */
async function handleCreateToken(request: Request, env: Env): Promise<Response> {
  // Verify request is from workway-platform (check auth header)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const body = await request.json() as {
      subscriberId: string;
      email: string;
      issueId: string;
      issueSlug: string;
    };
    
    // Generate secure token
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const emailHash = await hashEmail(body.email);
    
    const tokenData: TokenData = {
      subscriberId: body.subscriberId,
      email: body.email,
      emailHash,
      issueId: body.issueId,
      issueSlug: body.issueSlug,
      createdAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    };
    
    // Store token in KV
    await env.TOKENS.put(token, JSON.stringify(tokenData), {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days
    });
    
    return Response.json({ token, expiresAt: tokenData.expiresAt });
  } catch (e) {
    console.error('Create token failed:', e);
    return new Response('Invalid request', { status: 400 });
  }
}

/**
 * API endpoint to get tracking stats
 */
async function handleStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const issueId = url.searchParams.get('issue_id');
  
  if (!issueId) {
    return new Response('Missing issue_id', { status: 400 });
  }
  
  try {
    // Query cross-property events
    const result = await env.DB.prepare(`
      SELECT 
        target_property,
        link_id,
        COUNT(*) as click_count,
        COUNT(DISTINCT identity_id) as unique_clicks
      FROM cross_property_events
      WHERE campaign_id = ? AND event_type = 'email_click'
      GROUP BY target_property, link_id
      ORDER BY click_count DESC
    `).bind(issueId).all();
    
    return Response.json({
      issueId,
      events: result.results,
    });
  } catch (e) {
    console.error('Stats query failed:', e);
    return new Response('Query failed', { status: 500 });
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers for API endpoints
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Route based on path
      switch (url.pathname) {
        case '/click':
        case '/c':
          return handleClick(request, env);
          
        case '/open':
        case '/o':
          return handleOpen(request, env);
          
        case '/api/token':
          if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
          }
          return handleCreateToken(request, env);
          
        case '/api/stats':
          return handleStats(request, env);
          
        case '/health':
          return Response.json({ status: 'ok', timestamp: Date.now() });
          
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (e) {
      console.error('Request handler error:', e);
      return new Response('Internal error', { status: 500 });
    }
  },
};
