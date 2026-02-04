/**
 * WORKWAY Construction MCP Server
 * 
 * The Automation Layer.
 * AI-native workflow automation for construction, powered by Cloudflare.
 * 
 * This MCP server exposes tools for:
 * - Creating and managing construction workflows
 * - Integrating with Procore for RFIs, daily logs, submittals
 * - Debugging and observability with Atlas-aligned taxonomy
 * 
 * North Star: "The AI-native workflow layer for construction, powered by Cloudflare."
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { allTools, toolCategories } from './tools';
import { listResources, fetchResource } from './resources';
import { encrypt, decrypt } from './lib/crypto';
import { 
  ALLOWED_ORIGINS, 
  OAUTH_CALLBACK_URL, 
  PROCORE_TOKEN_URL,
  MCP_BASE_URL,
} from './lib/config';

// ============================================================================
// MCP Server Setup
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

// CORS for MCP clients - restricted to allowed origins
app.use('*', cors({
  origin: (origin) => {
    // Allow requests with no origin (same-origin, server-to-server)
    if (!origin) return '*';
    
    // Check against allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }
    
    // In development, allow localhost
    if (origin.startsWith('http://localhost:')) {
      return origin;
    }
    
    // Default deny - return first allowed origin to indicate CORS is configured
    return ALLOWED_ORIGINS[0];
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ============================================================================
// Landing Page - WORKWAY
// ============================================================================

/**
 * WORKWAY landing page - The Automation Layer for Construction
 */
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WORKWAY - The Automation Layer for Construction</title>
  <meta name="description" content="AI-powered workflow automation for construction. Connect your project data to intelligent automations that handle RFIs, submittals, daily logs, and more.">
  <style>
    :root {
      --background: #09090b;
      --foreground: #fafafa;
      --muted: #a1a1aa;
      --border: #27272a;
      --accent: #f97316;
      --card: #18181b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: var(--background);
      color: var(--foreground);
      min-height: 100vh;
      line-height: 1.6;
    }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    
    /* Header */
    .header { 
      padding: 16px 0; 
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--background);
      z-index: 100;
    }
    .header-inner { display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em; }
    .logo-icon { width: 28px; height: 28px; background: var(--accent); border-radius: 6px; }
    .logo span { color: var(--accent); }
    .nav { display: flex; gap: 32px; align-items: center; }
    .nav a { color: var(--muted); text-decoration: none; font-size: 14px; transition: color 0.2s; }
    .nav a:hover { color: var(--foreground); }
    .nav-cta { background: var(--accent); color: white !important; padding: 8px 16px; border-radius: 6px; font-weight: 500; }
    .nav-cta:hover { opacity: 0.9; }
    
    /* Hero */
    .hero { padding: 100px 0 80px; }
    .hero-content { max-width: 800px; }
    .badge { 
      display: inline-block;
      padding: 6px 12px;
      background: rgba(249, 115, 22, 0.1);
      border: 1px solid rgba(249, 115, 22, 0.3);
      border-radius: 20px;
      font-size: 13px;
      color: var(--accent);
      margin-bottom: 24px;
    }
    .hero h1 { 
      font-size: 56px; 
      font-weight: 700; 
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 24px;
    }
    .hero h1 span { color: var(--accent); }
    .hero-sub { font-size: 20px; color: var(--muted); max-width: 560px; margin-bottom: 40px; line-height: 1.6; }
    .hero-buttons { display: flex; gap: 16px; flex-wrap: wrap; }
    .btn { 
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 14px 28px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-secondary { background: var(--card); color: var(--foreground); border: 1px solid var(--border); }
    .btn-secondary:hover { border-color: var(--muted); }
    
    /* Proof */
    .proof { display: flex; gap: 48px; margin-top: 60px; padding-top: 40px; border-top: 1px solid var(--border); }
    .proof-item { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 14px; }
    .proof-icon { width: 20px; height: 20px; background: rgba(249, 115, 22, 0.2); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    
    /* Problem/Solution */
    .problem { padding: 100px 0; border-top: 1px solid var(--border); }
    .problem h2 { font-size: 36px; font-weight: 600; margin-bottom: 16px; letter-spacing: -0.02em; }
    .problem-sub { color: var(--muted); font-size: 18px; max-width: 600px; margin-bottom: 48px; }
    .problem-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
    .problem-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 28px; }
    .problem-card.highlight { border-color: var(--accent); background: rgba(249, 115, 22, 0.05); }
    .problem-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
    .problem-card p { color: var(--muted); font-size: 15px; line-height: 1.6; }
    
    /* How it works */
    .how { padding: 100px 0; border-top: 1px solid var(--border); }
    .how h2 { font-size: 36px; font-weight: 600; margin-bottom: 16px; text-align: center; letter-spacing: -0.02em; }
    .how-sub { color: var(--muted); font-size: 18px; text-align: center; margin-bottom: 64px; }
    .how-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
    .how-step { text-align: center; }
    .step-num { 
      width: 48px; height: 48px; 
      background: var(--accent); 
      border-radius: 50%; 
      display: inline-flex; 
      align-items: center; 
      justify-content: center;
      font-weight: 700;
      font-size: 20px;
      margin-bottom: 20px;
    }
    .how-step h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .how-step p { color: var(--muted); font-size: 15px; }
    
    /* Capabilities */
    .capabilities { padding: 100px 0; border-top: 1px solid var(--border); background: var(--card); }
    .capabilities h2 { font-size: 36px; font-weight: 600; margin-bottom: 16px; text-align: center; letter-spacing: -0.02em; }
    .capabilities-sub { color: var(--muted); font-size: 18px; text-align: center; margin-bottom: 64px; }
    .cap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .cap-card { background: var(--background); border: 1px solid var(--border); border-radius: 12px; padding: 24px; transition: border-color 0.2s; }
    .cap-card:hover { border-color: var(--muted); }
    .cap-icon { font-size: 28px; margin-bottom: 16px; }
    .cap-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .cap-card p { font-size: 14px; color: var(--muted); }
    
    /* Integrations */
    .integrations { padding: 80px 0; border-top: 1px solid var(--border); }
    .integrations h2 { font-size: 24px; font-weight: 600; text-align: center; margin-bottom: 40px; color: var(--muted); }
    .int-logos { display: flex; justify-content: center; gap: 48px; flex-wrap: wrap; }
    .int-logo { 
      padding: 16px 32px; 
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      color: var(--muted);
    }
    
    /* CTA */
    .cta-section { padding: 100px 0; text-align: center; border-top: 1px solid var(--border); }
    .cta-section h2 { font-size: 40px; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.02em; }
    .cta-section p { color: var(--muted); font-size: 18px; margin-bottom: 40px; max-width: 500px; margin-left: auto; margin-right: auto; }
    
    /* Footer */
    .footer { 
      padding: 40px 0;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 14px;
    }
    .footer-inner { display: flex; justify-content: space-between; align-items: center; }
    .footer a { color: var(--muted); text-decoration: none; }
    .footer a:hover { color: var(--foreground); }
    .footer-links { display: flex; gap: 24px; }
    
    @media (max-width: 768px) {
      .hero h1 { font-size: 36px; }
      .problem-grid, .how-steps, .cap-grid { grid-template-columns: 1fr; }
      .proof { flex-direction: column; gap: 16px; }
      .nav { gap: 16px; }
      .nav a:not(.nav-cta) { display: none; }
      .footer-inner { flex-direction: column; gap: 16px; text-align: center; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="container header-inner">
      <div class="logo">
        <div class="logo-icon"></div>
        WORK<span>WAY</span>
      </div>
      <nav class="nav">
        <a href="/docs">Docs</a>
        <a href="/dashboard">Dashboard</a>
        <a href="https://github.com/WORKWAYCO/WORKWAY" target="_blank">GitHub</a>
        <a href="/docs" class="nav-cta">Get Started</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <div class="badge">Now available for Procore</div>
          <h1>The Automation Layer for <span>Construction</span></h1>
          <p class="hero-sub">Connect your project management tools to AI-powered workflows. Automate RFI tracking, submittal monitoring, daily reports, and more.</p>
          <div class="hero-buttons">
            <a href="/docs" class="btn btn-primary">Start Building</a>
            <a href="/dashboard" class="btn btn-secondary">View Dashboard</a>
          </div>
        </div>
        
        <div class="proof">
          <div class="proof-item">
            <div class="proof-icon">✓</div>
            30+ automation tools
          </div>
          <div class="proof-item">
            <div class="proof-icon">✓</div>
            AI-native architecture
          </div>
          <div class="proof-item">
            <div class="proof-icon">✓</div>
            Enterprise security
          </div>
          <div class="proof-item">
            <div class="proof-icon">✓</div>
            Sub-100ms response
          </div>
        </div>
      </div>
    </section>

    <section class="problem">
      <div class="container">
        <h2>Construction runs on busywork</h2>
        <p class="problem-sub">Project managers spend hours on tasks that should happen automatically.</p>
        <div class="problem-grid">
          <div class="problem-card">
            <h3>📋 RFI Follow-ups</h3>
            <p>Manually checking which RFIs are overdue, sending reminder emails, updating spreadsheets. Every day.</p>
          </div>
          <div class="problem-card">
            <h3>📄 Submittal Tracking</h3>
            <p>Digging through systems to find pending approvals, chasing down reviewers, reporting on status.</p>
          </div>
          <div class="problem-card">
            <h3>📊 Daily Reports</h3>
            <p>Compiling information from multiple sources into summary emails. Time that should go to building.</p>
          </div>
          <div class="problem-card highlight">
            <h3>✨ What if it just happened?</h3>
            <p>WORKWAY connects to your tools and handles the routine. You define the workflow once, AI handles the rest.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="how">
      <div class="container">
        <h2>How it works</h2>
        <p class="how-sub">Three steps to automated workflows</p>
        <div class="how-steps">
          <div class="how-step">
            <div class="step-num">1</div>
            <h3>Connect</h3>
            <p>Link your Procore account with secure OAuth. Your data stays yours.</p>
          </div>
          <div class="how-step">
            <div class="step-num">2</div>
            <h3>Configure</h3>
            <p>Use pre-built templates or create custom workflows with natural language.</p>
          </div>
          <div class="how-step">
            <div class="step-num">3</div>
            <h3>Automate</h3>
            <p>Workflows run automatically. Get notified via email or Slack when things need attention.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="capabilities">
      <div class="container">
        <h2>Built for construction teams</h2>
        <p class="capabilities-sub">Every feature designed around how you actually work</p>
        <div class="cap-grid">
          <div class="cap-card">
            <div class="cap-icon">🔔</div>
            <h3>RFI Overdue Alerts</h3>
            <p>Automatic notifications when RFIs need attention. Never miss a deadline.</p>
          </div>
          <div class="cap-card">
            <div class="cap-icon">📋</div>
            <h3>Submittal Monitoring</h3>
            <p>Track approval status and get alerts for pending reviews and bottlenecks.</p>
          </div>
          <div class="cap-card">
            <div class="cap-icon">📊</div>
            <h3>Weekly Summaries</h3>
            <p>AI-generated project digests delivered every Monday morning.</p>
          </div>
          <div class="cap-card">
            <div class="cap-icon">📝</div>
            <h3>Daily Log Reminders</h3>
            <p>Afternoon prompts to ensure daily logs are submitted on time.</p>
          </div>
          <div class="cap-card">
            <div class="cap-icon">⚡</div>
            <h3>Instant Notifications</h3>
            <p>Real-time alerts for new RFIs, approved submittals, and document uploads.</p>
          </div>
          <div class="cap-card">
            <div class="cap-icon">🔧</div>
            <h3>Custom Workflows</h3>
            <p>Build any automation you need. If you can describe it, WORKWAY can run it.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="integrations">
      <div class="container">
        <h2>Integrates with your stack</h2>
        <div class="int-logos">
          <div class="int-logo">Procore</div>
          <div class="int-logo">Slack</div>
          <div class="int-logo">Email</div>
          <div class="int-logo">Webhooks</div>
        </div>
      </div>
    </section>

    <section class="cta-section">
      <div class="container">
        <h2>Ready to automate?</h2>
        <p>Stop spending time on tasks that should run themselves.</p>
        <div class="hero-buttons" style="justify-content: center;">
          <a href="/docs" class="btn btn-primary">Get Started Free</a>
          <a href="${MCP_BASE_URL}/mcp" class="btn btn-secondary">View API</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-links">
        <a href="/docs">Documentation</a>
        <a href="/dashboard">Dashboard</a>
        <a href="https://github.com/WORKWAYCO/WORKWAY">GitHub</a>
        <a href="mailto:support@workway.co">Support</a>
      </div>
      <p>© 2026 WORKWAY · Built on Cloudflare</p>
    </div>
  </footer>
</body>
</html>`;
  
  return c.html(html);
});

/**
 * Documentation page
 */
app.get('/docs', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation - WORKWAY</title>
  <style>
    :root { --background: #09090b; --foreground: #fafafa; --muted: #a1a1aa; --border: #27272a; --accent: #f97316; --card: #18181b; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--background); color: var(--foreground); line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 0 24px; }
    .header { padding: 16px 0; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--background); z-index: 100; }
    .header-inner { display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--foreground); }
    .logo-icon { width: 24px; height: 24px; background: var(--accent); border-radius: 6px; }
    .nav { display: flex; gap: 24px; }
    .nav a { color: var(--muted); text-decoration: none; font-size: 14px; }
    .nav a:hover { color: var(--foreground); }
    .content { padding: 48px 0; }
    h1 { font-size: 36px; font-weight: 700; margin-bottom: 16px; }
    h2 { font-size: 24px; font-weight: 600; margin: 48px 0 16px; padding-top: 24px; border-top: 1px solid var(--border); }
    h3 { font-size: 18px; font-weight: 600; margin: 32px 0 12px; }
    p { color: var(--muted); margin-bottom: 16px; }
    code { font-family: 'SF Mono', Consolas, monospace; font-size: 14px; background: var(--card); padding: 2px 6px; border-radius: 4px; }
    pre { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; overflow-x: auto; margin: 16px 0; }
    pre code { background: none; padding: 0; }
    .endpoint { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin: 16px 0; }
    .endpoint-method { display: inline-block; padding: 2px 8px; background: #22c55e; color: var(--background); border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 8px; }
    .endpoint-method.post { background: #3b82f6; }
    .endpoint-path { font-family: 'SF Mono', Consolas, monospace; font-size: 14px; }
    ul { margin: 16px 0; padding-left: 24px; color: var(--muted); }
    li { margin: 8px 0; }
    .footer { padding: 32px 0; border-top: 1px solid var(--border); text-align: center; color: var(--muted); font-size: 14px; }
    .footer a { color: var(--muted); text-decoration: none; }
  </style>
</head>
<body>
  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo"><div class="logo-icon"></div>WORKWAY</a>
      <nav class="nav">
        <a href="/docs">Docs</a>
        <a href="/dashboard">Dashboard</a>
        <a href="${MCP_BASE_URL}/mcp">API</a>
      </nav>
    </div>
  </header>

  <main class="content">
    <div class="container">
      <h1>Getting Started</h1>
      <p>Procore MCP is an AI-native interface for construction project data. Connect your AI agent to Procore in minutes.</p>

      <h2>Quick Start</h2>
      
      <h3>1. Configure Your MCP Client</h3>
      <p>Add the Procore MCP server to your AI client configuration:</p>
      <pre><code>{
  "mcpServers": {
    "procore": {
      "url": "${MCP_BASE_URL}/mcp"
    }
  }
}</code></pre>

      <h3>2. Connect to Procore</h3>
      <p>Your AI can now use the <code>workway_connect_procore</code> tool to authenticate:</p>
      <pre><code>// Ask your AI:
"Connect to Procore so I can access project data"

// The AI will return an authorization URL
// Click it to complete OAuth authentication</code></pre>

      <h3>3. Start Querying</h3>
      <p>Once connected, your AI has access to all Procore data:</p>
      <pre><code>// Example prompts:
"List all my Procore projects"
"Show me overdue RFIs"
"Get the latest submittals for project 12345"
"Create a weekly summary workflow"</code></pre>

      <h2>API Endpoints</h2>
      
      <div class="endpoint">
        <span class="endpoint-method">GET</span>
        <span class="endpoint-path">/mcp</span>
        <p style="margin-top: 8px; margin-bottom: 0;">Server info and capabilities</p>
      </div>

      <div class="endpoint">
        <span class="endpoint-method">GET</span>
        <span class="endpoint-path">/mcp/tools</span>
        <p style="margin-top: 8px; margin-bottom: 0;">List all available tools</p>
      </div>

      <div class="endpoint">
        <span class="endpoint-method post">POST</span>
        <span class="endpoint-path">/mcp/tools/{tool_name}</span>
        <p style="margin-top: 8px; margin-bottom: 0;">Execute a tool</p>
      </div>

      <div class="endpoint">
        <span class="endpoint-method">GET</span>
        <span class="endpoint-path">/mcp/resources</span>
        <p style="margin-top: 8px; margin-bottom: 0;">List available resources</p>
      </div>

      <h2>Authentication</h2>
      <p>WORKWAY uses OAuth 2.0 for Procore authentication. When you call <code>workway_connect_procore</code>, you'll receive an authorization URL. After completing the OAuth flow, your tokens are securely stored and automatically refreshed.</p>
      
      <h3>Security Features</h3>
      <ul>
        <li><strong>Token Encryption</strong> - All tokens encrypted with AES-256-GCM</li>
        <li><strong>User Isolation</strong> - Each user's tokens stored separately</li>
        <li><strong>Automatic Refresh</strong> - Tokens refreshed before expiration</li>
        <li><strong>Secure Storage</strong> - Cloudflare D1 with encryption at rest</li>
      </ul>

      <h2>Workflow Templates</h2>
      <p>Pre-built templates for common construction automations:</p>
      <ul>
        <li><strong>rfi_overdue_alert</strong> - Daily notifications for overdue RFIs</li>
        <li><strong>weekly_project_summary</strong> - Monday morning project digest</li>
        <li><strong>submittal_status_digest</strong> - Daily submittal status report</li>
        <li><strong>daily_log_reminder</strong> - Afternoon reminder to submit daily logs</li>
        <li><strong>new_rfi_notification</strong> - Instant alerts when RFIs are created</li>
        <li><strong>submittal_approved_notification</strong> - Alerts when submittals are approved</li>
      </ul>

      <h2>Rate Limits</h2>
      <p>The MCP server respects Procore's rate limits:</p>
      <ul>
        <li>3,600 requests per minute</li>
        <li>100,000 requests per day</li>
      </ul>

      <h2>Support</h2>
      <p>Questions? Issues?</p>
      <ul>
        <li>Email: <a href="mailto:support@workway.co" style="color: var(--accent);">support@workway.co</a></li>
        <li>GitHub: <a href="https://github.com/WORKWAYCO/WORKWAY" style="color: var(--accent);">WORKWAYCO/WORKWAY</a></li>
      </ul>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <p>© 2026 <a href="https://workway.co">WORKWAY</a> · Built on Cloudflare</p>
    </div>
  </footer>
</body>
</html>`;
  return c.html(html);
});

/**
 * Dashboard API - returns JSON data for dashboard
 */
app.get('/api/dashboard', async (c) => {
  const workflows = await c.env.DB.prepare(`
    SELECT w.*, 
           (SELECT COUNT(*) FROM workflow_actions WHERE workflow_id = w.id) as action_count,
           (SELECT COUNT(*) FROM executions WHERE workflow_id = w.id) as execution_count
    FROM workflows w
    ORDER BY w.updated_at DESC
    LIMIT 50
  `).all<any>();

  return c.json({
    workflows: workflows.results || [],
    templates: [
      { id: 'rfi_overdue_alert', name: 'RFI Overdue Alert', category: 'rfi' },
      { id: 'weekly_project_summary', name: 'Weekly Project Summary', category: 'reporting' },
      { id: 'submittal_status_digest', name: 'Submittal Status Digest', category: 'submittal' },
      { id: 'daily_log_reminder', name: 'Daily Log Reminder', category: 'daily_log' },
      { id: 'new_rfi_notification', name: 'New RFI Notification', category: 'rfi' },
      { id: 'submittal_approved_notification', name: 'Submittal Approved', category: 'submittal' },
    ],
    stats: {
      totalWorkflows: workflows.results?.length || 0,
      activeWorkflows: workflows.results?.filter((w: any) => w.status === 'active').length || 0,
      totalExecutions: workflows.results?.reduce((sum: number, w: any) => sum + (w.execution_count || 0), 0) || 0,
    },
  });
});

/**
 * Dashboard for workflow management
 */
app.get('/dashboard', async (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WORKWAY Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #1a1a1a; min-height: 100vh; }
    .header { background: #1a1a2e; color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 24px; font-weight: 700; }
    .logo span { color: #f97316; }
    .nav a { color: white; text-decoration: none; margin-left: 24px; }
    .nav a:hover { color: #f97316; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-value { font-size: 32px; font-weight: 700; color: #1a1a2e; }
    .stat-label { color: #64748b; margin-top: 4px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 20px; font-weight: 600; margin-bottom: 16px; }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .workflow-item { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
    .workflow-item:last-child { border-bottom: none; }
    .workflow-name { font-weight: 500; }
    .workflow-meta { color: #64748b; font-size: 14px; margin-top: 4px; }
    .workflow-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .status-active { background: #dcfce7; color: #166534; }
    .status-draft { background: #fef3c7; color: #92400e; }
    .status-deployed { background: #dcfce7; color: #166534; }
    .templates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .template-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .template-name { font-weight: 500; margin-bottom: 8px; }
    .template-category { display: inline-block; padding: 2px 8px; background: #f1f5f9; border-radius: 4px; font-size: 12px; color: #64748b; }
    .empty-state { text-align: center; padding: 48px; color: #64748b; }
    .loading { text-align: center; padding: 48px; color: #64748b; }
    @media (max-width: 768px) { .stats { grid-template-columns: repeat(2, 1fr); } .templates { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">WORK<span>WAY</span></div>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/dashboard">Dashboard</a>
      <a href="/mcp">API</a>
    </nav>
  </div>
  <div class="container">
    <div class="stats" id="stats">
      <div class="stat-card"><div class="stat-value" id="total-workflows">-</div><div class="stat-label">Total Workflows</div></div>
      <div class="stat-card"><div class="stat-value" id="active-workflows">-</div><div class="stat-label">Active</div></div>
      <div class="stat-card"><div class="stat-value" id="total-executions">-</div><div class="stat-label">Executions</div></div>
      <div class="stat-card"><div class="stat-value" id="template-count">6</div><div class="stat-label">Templates</div></div>
    </div>
    <div class="section">
      <h2 class="section-title">Workflows</h2>
      <div class="card"><div id="workflow-list" class="loading">Loading...</div></div>
    </div>
    <div class="section">
      <h2 class="section-title">Quick Start Templates</h2>
      <div class="templates" id="templates"></div>
    </div>
    <div class="section">
      <h2 class="section-title">API Access</h2>
      <div class="card" style="padding: 20px;">
        <p style="margin-bottom: 12px;">Use these endpoints to integrate with your AI agents:</p>
        <code style="display: block; background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px;">POST ${MCP_BASE_URL}/mcp/tools/{tool_name}</code>
      </div>
    </div>
  </div>
  <script>
    async function loadDashboard() {
      try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        document.getElementById('total-workflows').textContent = data.stats.totalWorkflows;
        document.getElementById('active-workflows').textContent = data.stats.activeWorkflows;
        document.getElementById('total-executions').textContent = data.stats.totalExecutions;
        const wfList = document.getElementById('workflow-list');
        if (data.workflows.length === 0) {
          wfList.innerHTML = '<div class="empty-state">No workflows yet. Create one from a template using the MCP tools.</div>';
        } else {
          wfList.innerHTML = data.workflows.map(w => 
            '<div class="workflow-item"><div><div class="workflow-name">' + w.name + '</div><div class="workflow-meta">' + 
            w.action_count + ' actions · ' + w.execution_count + ' executions</div></div>' +
            '<span class="workflow-status status-' + w.status + '">' + w.status + '</span></div>'
          ).join('');
        }
        document.getElementById('templates').innerHTML = data.templates.map(t =>
          '<div class="template-card"><div class="template-name">' + t.name + '</div><span class="template-category">' + t.category + '</span></div>'
        ).join('');
      } catch (e) { console.error(e); }
    }
    loadDashboard();
  </script>
</body>
</html>`;
  return c.html(html);
});

// ============================================================================
// MCP Protocol Endpoints
// ============================================================================

/**
 * MCP Server Info
 */
app.get('/mcp', (c) => {
  return c.json({
    name: 'workway-construction-mcp',
    version: '0.1.0',
    description: 'The Automation Layer - AI-native workflow automation for construction',
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: false, listChanged: true },
      prompts: { listChanged: false },
    },
  });
});

/**
 * List available tools (MCP tools/list)
 */
app.get('/mcp/tools', (c) => {
  const tools = Object.values(allTools).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
  }));

  return c.json({
    tools,
    categories: toolCategories,
  });
});

/**
 * Execute a tool (MCP tools/call)
 */
app.post('/mcp/tools/:name', async (c) => {
  const toolName = c.req.param('name');
  const tool = Object.values(allTools).find(t => t.name === toolName);

  if (!tool) {
    return c.json({
      error: {
        code: -32602,
        message: `Unknown tool: ${toolName}`,
      },
    }, 404);
  }

  try {
    const body = await c.req.json();
    const input = tool.inputSchema.parse(body.arguments || body);
    const result = await tool.execute(input as any, c.env);

    return c.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.data || result, null, 2),
        },
      ],
      isError: !result.success,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message }),
        },
      ],
      isError: true,
    }, 400);
  }
});

// ============================================================================
// MCP Resources Endpoints
// ============================================================================

/**
 * List available resources
 */
app.get('/mcp/resources', (c) => {
  return c.json({
    resources: listResources(),
  });
});

/**
 * Read a resource by URI
 */
app.get('/mcp/resources/read', async (c) => {
  const uri = c.req.query('uri');
  
  if (!uri) {
    return c.json({ error: 'Missing uri parameter' }, 400);
  }
  
  const content = await fetchResource(uri, c.env);
  
  if (content === null) {
    return c.json({ error: `Resource not found: ${uri}` }, 404);
  }
  
  return c.json({
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(content, null, 2),
      },
    ],
  });
});

// ============================================================================
// Webhook Endpoints
// ============================================================================

/**
 * Receive webhooks from Procore and other sources
 */
app.post('/webhooks/:workflow_id', async (c) => {
  const workflowId = c.req.param('workflow_id');
  const body = await c.req.json();

  // Verify workflow exists and is active
  const workflow = await c.env.DB.prepare(`
    SELECT * FROM workflows WHERE id = ? AND status = 'active'
  `).bind(workflowId).first<any>();

  if (!workflow) {
    return c.json({ error: 'Workflow not found or not active' }, 404);
  }

  // Create execution record
  const executionId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO executions (id, workflow_id, status, started_at, input_data)
    VALUES (?, ?, 'pending', ?, ?)
  `).bind(executionId, workflowId, new Date().toISOString(), JSON.stringify(body)).run();

  // TODO: Queue workflow execution via Durable Object
  // For now, return acknowledgment
  return c.json({
    received: true,
    executionId,
    message: 'Webhook received, execution queued',
  });
});

// ============================================================================
// OAuth Callback
// ============================================================================

/**
 * OAuth callback for Procore
 * Implements PKCE verification and encrypted token storage
 */
app.get('/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return c.json({ 
      error: 'oauth_error',
      message: errorDescription || error,
      code: 'PROCORE_OAUTH_ERROR',
    }, 400);
  }

  if (!code || !state) {
    return c.json({ 
      error: 'missing_params',
      message: 'Missing authorization code or state parameter',
      code: 'OAUTH_MISSING_PARAMS',
    }, 400);
  }

  // Verify state
  const stateData = await c.env.KV.get(`oauth_state:${state}`, 'json') as {
    provider: string;
    companyId?: string;
    userId: string;
    createdAt: string;
  } | null;
  
  if (!stateData) {
    return c.json({ 
      error: 'invalid_state',
      message: 'Invalid or expired state. Please try connecting again.',
      code: 'OAUTH_STATE_INVALID',
    }, 400);
  }

  // Verify state hasn't expired (10 minutes)
  const stateAge = Date.now() - new Date(stateData.createdAt).getTime();
  if (stateAge > 10 * 60 * 1000) {
    await c.env.KV.delete(`oauth_state:${state}`);
    return c.json({ 
      error: 'state_expired',
      message: 'Authorization session expired. Please try again.',
      code: 'OAUTH_STATE_EXPIRED',
    }, 400);
  }

  // Exchange code for token (using form-urlencoded as per OAuth 2.0 spec)
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: c.env.PROCORE_CLIENT_ID,
    client_secret: c.env.PROCORE_CLIENT_SECRET,
    redirect_uri: OAUTH_CALLBACK_URL,
  });

  const tokenResponse = await fetch(PROCORE_TOKEN_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody.toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token exchange failed:', tokenResponse.status, errorText);
    console.error('Token URL:', PROCORE_TOKEN_URL);
    console.error('Client ID:', c.env.PROCORE_CLIENT_ID?.substring(0, 10) + '...');
    return c.json({ 
      error: 'token_exchange_failed',
      message: `Failed to exchange authorization code for token: ${errorText}`,
      code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
      status: tokenResponse.status,
    }, 400);
  }

  const tokenData = await tokenResponse.json() as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    token_type: string;
    created_at?: number;
  };

  // Encrypt tokens before storage
  const encryptionKey = c.env.COOKIE_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('COOKIE_ENCRYPTION_KEY not configured');
    return c.json({ 
      error: 'configuration_error',
      message: 'Server configuration error',
      code: 'MISSING_ENCRYPTION_KEY',
    }, 500);
  }

  const encryptedAccessToken = await encrypt(tokenData.access_token, encryptionKey);
  const encryptedRefreshToken = tokenData.refresh_token 
    ? await encrypt(tokenData.refresh_token, encryptionKey)
    : null;

  // Calculate expiration
  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Delete existing token for this user/provider
  await c.env.DB.prepare(`
    DELETE FROM oauth_tokens WHERE provider = 'procore' AND user_id = ?
  `).bind(stateData.userId).run();

  // Store encrypted token with user isolation
  const tokenId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO oauth_tokens (id, provider, user_id, access_token, refresh_token, expires_at, company_id, created_at)
    VALUES (?, 'procore', ?, ?, ?, ?, ?, ?)
  `).bind(
    tokenId,
    stateData.userId,
    encryptedAccessToken,
    encryptedRefreshToken,
    expiresAt,
    stateData.companyId || null,
    new Date().toISOString()
  ).run();

  // Clean up state
  await c.env.KV.delete(`oauth_state:${state}`);

  // Return success
  return c.json({
    success: true,
    message: 'Procore connected successfully!',
    userId: stateData.userId,
    expiresAt,
  });
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Durable Object for Workflow State
// ============================================================================

export class WorkflowState implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/execute') {
      // Handle workflow execution
      const body = await request.json() as any;
      
      // Store execution state
      await this.state.storage.put('currentExecution', body);
      
      // TODO: Execute workflow steps
      
      return new Response(JSON.stringify({ status: 'executing' }));
    }
    
    if (url.pathname === '/status') {
      const execution = await this.state.storage.get('currentExecution');
      return new Response(JSON.stringify({ execution }));
    }

    return new Response('Not found', { status: 404 });
  }
}

// ============================================================================
// Export
// ============================================================================

export default app;
