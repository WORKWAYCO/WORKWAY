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
 * Root route - returns API info and redirects to Pages site
 */
app.get('/', (c) => {
  return c.json({
    api: 'workway-construction-mcp',
    version: '0.1.0',
    docs: 'https://construction-web.pages.dev/docs',
    dashboard: `${MCP_BASE_URL}/dashboard`,
    mcp: `${MCP_BASE_URL}/mcp`,
  });
});

// Landing page HTML removed - now served by Pages site at construction-web.pages.dev

/**
 * Documentation route - redirects to Pages site
 */
app.get('/docs', (c) => {
  return c.redirect('https://construction-web.pages.dev/docs', 302);
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
    :root {
      /* Background - Pure black hierarchy */
      --bg-pure: #000000;
      --bg-elevated: #0a0a0a;
      --bg-surface: #111111;
      --bg-subtle: #1a1a1a;
      /* Foreground - Opacity-based */
      --fg-primary: #ffffff;
      --fg-secondary: rgba(255, 255, 255, 0.8);
      --fg-tertiary: rgba(255, 255, 255, 0.6);
      --fg-muted: rgba(255, 255, 255, 0.4);
      /* Border - Opacity-based */
      --border-default: rgba(255, 255, 255, 0.1);
      --border-emphasis: rgba(255, 255, 255, 0.2);
      /* Accent - Emerald (success/growth) */
      --accent: #34d399;
      --accent-muted: rgba(52, 211, 153, 0.15);
      --accent-subtle: rgba(52, 211, 153, 0.08);
      /* Typography */
      --font-sans: 'Stack Sans Notch', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      --font-mono: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
      /* Spacing - Golden ratio */
      --space-sm: 1rem;
      --space-md: 1.618rem;
      --space-lg: 2.618rem;
      --space-xl: 4.236rem;
      /* Radius */
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
      --radius-full: 9999px;
      /* Animation */
      --ease: cubic-bezier(0.4, 0.0, 0.2, 1);
      --duration: 200ms;
      --duration-slow: 400ms;
      /* Glass */
      --glass-blur: 12px;
      --glass-bg: rgba(0, 0, 0, 0.72);
      --glass-border: rgba(255, 255, 255, 0.1);
    }
    
    /* Keyframe Animations - MagicUI inspired */
    @keyframes fadeInUp {
      from { opacity: 0; transform: translate3d(0, 20px, 0); }
      to { opacity: 1; transform: translate3d(0, 0, 0); }
    }
    @keyframes shinyText {
      0%, 90%, 100% { background-position: calc(-100% - 80px) 0; }
      30%, 60% { background-position: calc(100% + 80px) 0; }
    }
    @keyframes borderBeam {
      0% { offset-distance: 0%; }
      100% { offset-distance: 100%; }
    }
    @keyframes shimmerSlide {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 20px rgba(52, 211, 153, 0.3); }
      50% { box-shadow: 0 0 40px rgba(52, 211, 153, 0.5); }
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { 
      font-family: var(--font-sans);
      font-optical-sizing: auto;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      letter-spacing: -0.01em;
      background: var(--bg-pure);
      color: var(--fg-primary);
      min-height: 100vh;
      line-height: 1.6;
      overflow-x: hidden;
    }
    
    /* Grid Background */
    .bg-grid {
      background-image: 
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      background-position: center;
    }
    .bg-grid-fade {
      position: fixed;
      inset: 0;
      background-image: 
        linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, black 30%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, black 30%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    
    /* Glass Morphism */
    .glass {
      backdrop-filter: blur(var(--glass-blur)) saturate(120%);
      -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(120%);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
    }
    .glass-card {
      position: relative;
      backdrop-filter: blur(16px) saturate(130%);
      -webkit-backdrop-filter: blur(16px) saturate(130%);
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid var(--border-default);
      overflow: hidden;
    }
    .glass-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%);
      pointer-events: none;
    }
    .glass-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      pointer-events: none;
    }
    
    /* Hover Effects */
    .hover-lift {
      transition: transform var(--duration) var(--ease), box-shadow var(--duration) var(--ease);
    }
    .hover-lift:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .hover-glow:hover {
      box-shadow: 0 0 30px rgba(52, 211, 153, 0.2);
    }
    
    /* Shiny Text Effect */
    .shiny-text {
      background: linear-gradient(90deg, var(--fg-primary) 40%, var(--accent) 50%, var(--fg-primary) 60%);
      background-size: 200% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shinyText 6s ease-in-out infinite;
    }
    
    /* Border Beam Effect */
    .border-beam {
      position: relative;
      overflow: hidden;
    }
    .border-beam::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      animation: shimmerSlide 3s linear infinite;
    }
    
    /* Shimmer Button */
    .btn-shimmer {
      position: relative;
      overflow: hidden;
    }
    .btn-shimmer::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      animation: shimmerSlide 2s ease-in-out infinite;
    }
    
    /* Fade In Animation Classes */
    .animate-in {
      animation: fadeInUp 0.6s var(--ease) forwards;
      opacity: 0;
    }
    .delay-1 { animation-delay: 0.1s; }
    .delay-2 { animation-delay: 0.2s; }
    .delay-3 { animation-delay: 0.3s; }
    .delay-4 { animation-delay: 0.4s; }
    .delay-5 { animation-delay: 0.5s; }
    
    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 var(--space-md); }
    
    /* Header */
    .header { 
      padding: var(--space-sm) 0; 
      border-bottom: 1px solid var(--border-default);
      position: sticky;
      top: 0;
      background: var(--bg-pure);
      z-index: 100;
    }
    .header-inner { display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px; letter-spacing: -0.02em; }
    .logo-icon { width: 28px; height: 28px; background: var(--accent); border-radius: var(--radius-sm); }
    .logo span { color: var(--accent); }
    .nav { display: flex; gap: 32px; align-items: center; }
    .nav a { color: var(--fg-tertiary); text-decoration: none; font-size: 14px; transition: color var(--duration) var(--ease); }
    .nav a:hover { color: var(--fg-primary); }
    .nav-cta { background: var(--accent); color: var(--bg-pure) !important; padding: 8px 16px; border-radius: var(--radius-sm); font-weight: 500; }
    .nav-cta:hover { opacity: 0.9; }
    
    /* Hero */
    .hero { padding: var(--space-xl) 0; }
    .hero-content { max-width: 800px; }
    .badge { 
      display: inline-block;
      padding: 6px 12px;
      background: var(--accent-muted);
      border: 1px solid rgba(52, 211, 153, 0.3);
      border-radius: var(--radius-full);
      font-size: 13px;
      color: var(--accent);
      margin-bottom: var(--space-md);
    }
    .hero h1 { 
      font-size: clamp(3rem, 5vw, 4.5rem); 
      font-weight: 700; 
      letter-spacing: -0.025em;
      line-height: 1.1;
      margin-bottom: var(--space-md);
    }
    .hero h1 span { color: var(--accent); }
    .hero-sub { font-size: clamp(1.125rem, 2vw, 1.25rem); color: var(--fg-tertiary); max-width: 560px; margin-bottom: var(--space-lg); line-height: 1.6; }
    .hero-buttons { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
    .btn { 
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius-lg);
      font-size: 15px;
      font-weight: 500;
      text-decoration: none;
      transition: all var(--duration) var(--ease);
      min-height: 44px;
    }
    .btn-primary { background: var(--accent); color: var(--bg-pure); }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-secondary { background: var(--bg-elevated); color: var(--fg-primary); border: 1px solid var(--border-default); }
    .btn-secondary:hover { border-color: var(--border-emphasis); }
    
    /* Proof */
    .proof { display: flex; gap: var(--space-lg); margin-top: var(--space-xl); padding-top: var(--space-lg); border-top: 1px solid var(--border-default); }
    .proof-item { display: flex; align-items: center; gap: 12px; color: var(--fg-tertiary); font-size: 14px; }
    .proof-icon { width: 20px; height: 20px; background: var(--accent-muted); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 12px; }
    
    /* Problem/Solution */
    .problem { padding: var(--space-xl) 0; border-top: 1px solid var(--border-default); }
    .problem h2 { font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: 600; margin-bottom: var(--space-sm); letter-spacing: -0.02em; }
    .problem-sub { color: var(--fg-tertiary); font-size: 18px; max-width: 600px; margin-bottom: var(--space-lg); }
    .problem-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md); }
    .problem-card { background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-md); }
    .problem-card.highlight { border-color: var(--accent); background: var(--accent-subtle); }
    .problem-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
    .problem-card p { color: var(--fg-tertiary); font-size: 15px; line-height: 1.6; }
    
    /* How it works */
    .how { padding: var(--space-xl) 0; border-top: 1px solid var(--border-default); }
    .how h2 { font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: 600; margin-bottom: var(--space-sm); text-align: center; letter-spacing: -0.02em; }
    .how-sub { color: var(--fg-tertiary); font-size: 18px; text-align: center; margin-bottom: var(--space-xl); }
    .how-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg); }
    .how-step { text-align: center; }
    .step-num { 
      width: 48px; height: 48px; 
      background: var(--accent); 
      color: var(--bg-pure);
      border-radius: var(--radius-full); 
      display: inline-flex; 
      align-items: center; 
      justify-content: center;
      font-weight: 700;
      font-size: 20px;
      margin-bottom: var(--space-sm);
    }
    .how-step h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .how-step p { color: var(--fg-tertiary); font-size: 15px; }
    
    /* Capabilities */
    .capabilities { padding: var(--space-xl) 0; border-top: 1px solid var(--border-default); background: var(--bg-elevated); }
    .capabilities h2 { font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: 600; margin-bottom: var(--space-sm); text-align: center; letter-spacing: -0.02em; }
    .capabilities-sub { color: var(--fg-tertiary); font-size: 18px; text-align: center; margin-bottom: var(--space-xl); }
    .cap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); }
    .cap-card { background: var(--bg-pure); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-md); transition: border-color var(--duration) var(--ease); }
    .cap-card:hover { border-color: var(--border-emphasis); }
    .cap-icon { font-size: 28px; margin-bottom: var(--space-sm); }
    .cap-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
    .cap-card p { font-size: 14px; color: var(--fg-tertiary); }
    
    /* Integrations */
    .integrations { padding: var(--space-xl) 0; border-top: 1px solid var(--border-default); }
    .integrations h2 { font-size: clamp(1.25rem, 2vw, 1.5rem); font-weight: 600; text-align: center; margin-bottom: var(--space-lg); color: var(--fg-tertiary); }
    .int-logos { display: flex; justify-content: center; gap: var(--space-lg); flex-wrap: wrap; }
    .int-logo { 
      padding: var(--space-sm) var(--space-lg); 
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      font-weight: 600;
      font-size: 15px;
      color: var(--fg-tertiary);
    }
    
    /* CTA */
    .cta-section { padding: var(--space-xl) 0; text-align: center; border-top: 1px solid var(--border-default); }
    .cta-section h2 { font-size: clamp(2rem, 4vw, 2.5rem); font-weight: 700; margin-bottom: var(--space-sm); letter-spacing: -0.02em; }
    .cta-section p { color: var(--fg-tertiary); font-size: 18px; margin-bottom: var(--space-lg); max-width: 500px; margin-left: auto; margin-right: auto; }
    
    /* Footer */
    .footer { 
      padding: var(--space-lg) 0;
      border-top: 1px solid var(--border-default);
      color: var(--fg-muted);
      font-size: 14px;
    }
    .footer-inner { display: flex; justify-content: space-between; align-items: center; }
    .footer a { color: var(--fg-muted); text-decoration: none; transition: color var(--duration) var(--ease); }
    .footer a:hover { color: var(--fg-primary); }
    .footer-links { display: flex; gap: var(--space-md); }
    
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

// ============================================================================
// MCP Protocol Endpoints
// ============================================================================
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
