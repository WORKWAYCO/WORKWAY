<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { API_BASE_URL } from '$lib/config';

  const mcpConfigCode = `{
  "mcpServers": {
    "workway-construction": {
      "url": "${API_BASE_URL}/mcp",
      "transport": "sse"
    }
  }
}`;

  const connectExample = `// Connect to Procore production
"Connect to Procore so I can access project data"

// Or connect to sandbox for testing
"Connect to Procore sandbox environment"`;

  const skillsExample = `// Draft an RFI with AI
"Draft an RFI about the waterproofing membrane overlap not matching specs"

// Get executive summary of daily logs
"Summarize this week's daily logs for the Downtown Tower project"

// Review submittals for compliance issues
"Review pending submittals and flag any compliance concerns"`;
</script>

<svelte:head>
  <title>Documentation - WORKWAY Construction MCP</title>
  <meta name="description" content="Documentation for WORKWAY Construction MCP. 41 tools + 3 AI Skills for Procore automation." />
</svelte:head>

<Header />

<main class="content">
  <div class="container">
    <h1>Documentation</h1>
    <p>WORKWAY Construction MCP provides <strong>41 tools</strong> across 7 categories, plus <strong>3 AI-powered Skills</strong> for construction automation. Connect your AI agent to Procore in minutes.</p>

    <div class="stats-row">
      <div class="stat">
        <span class="stat-value">41</span>
        <span class="stat-label">MCP Tools</span>
      </div>
      <div class="stat">
        <span class="stat-value">7</span>
        <span class="stat-label">Categories</span>
      </div>
      <div class="stat">
        <span class="stat-value">3</span>
        <span class="stat-label">AI Skills</span>
      </div>
    </div>

    <h2>Quick Start</h2>
    
    <h3>1. Configure Your MCP Client</h3>
    <p>Add the WORKWAY Construction MCP server to your Claude Desktop or Codex configuration:</p>
    <pre><code>{mcpConfigCode}</code></pre>

    <h3>2. Connect to Procore</h3>
    <p>Use the <code>workway_connect_procore</code> tool to authenticate. You can connect to either production or sandbox:</p>
    <pre><code>{connectExample}</code></pre>
    <p class="note">The AI will return an authorization URL. Click it to complete OAuth authentication. Your tokens are securely stored and automatically refreshed.</p>

    <h3>3. Use AI Skills</h3>
    <p>Once connected, use natural language to invoke AI-powered Skills:</p>
    <pre><code>{skillsExample}</code></pre>

    <h2>Intelligence Layer (AI Skills)</h2>
    <p>Skills use <strong>Cloudflare Workers AI</strong> to produce outcomes, not just data. Each skill generates a draft that requires human review before action.</p>

    <div class="skill-card">
      <div class="skill-header">
        <Badge variant="accent">workway_skill_draft_rfi</Badge>
        <span class="skill-task">AI Task: generate</span>
      </div>
      <p>Generates professional RFIs from your intent. Includes subject, question body, impact statement, and spec references.</p>
      <div class="skill-params">
        <strong>Inputs:</strong> question_intent, spec_section, drawing_reference, priority, context
      </div>
    </div>

    <div class="skill-card">
      <div class="skill-header">
        <Badge variant="accent">workway_skill_daily_log_summary</Badge>
        <span class="skill-task">AI Task: summarize</span>
      </div>
      <p>Transforms daily logs into executive summaries. Includes key metrics, notable events, weather impact, and recommendations.</p>
      <div class="skill-params">
        <strong>Inputs:</strong> project_id, date_range, format (executive/detailed), include_recommendations
      </div>
    </div>

    <div class="skill-card">
      <div class="skill-header">
        <Badge variant="accent">workway_skill_submittal_review</Badge>
        <span class="skill-task">AI Task: classify</span>
      </div>
      <p>Reviews submittals and flags compliance issues. Pattern analysis identifies bottlenecks and delays.</p>
      <div class="skill-params">
        <strong>Inputs:</strong> project_id, focus (all/pending/overdue), spec_sections
      </div>
    </div>

    <h2>Tool Categories</h2>
    <p>41 MCP tools organized into 7 categories:</p>

    <div class="category-table">
      <div class="category-row header">
        <span>Category</span>
        <span>Tools</span>
        <span>Description</span>
      </div>
      <div class="category-row">
        <span class="category-name">procore</span>
        <span class="category-count">11</span>
        <span>Connect, list companies/projects, get RFIs, daily logs, submittals, photos, documents, schedule, create RFIs</span>
      </div>
      <div class="category-row">
        <span class="category-name">workflow</span>
        <span class="category-count">7</span>
        <span>Create, configure triggers, add actions, deploy, test, list, rollback workflows</span>
      </div>
      <div class="category-row">
        <span class="category-name">notifications</span>
        <span class="category-count">6</span>
        <span>Send email/Slack, notify, configure notifications, alert errors</span>
      </div>
      <div class="category-row">
        <span class="category-name">seeder</span>
        <span class="category-count">4</span>
        <span>Seed test data: RFIs, daily logs, sample data for sandbox testing</span>
      </div>
      <div class="category-row">
        <span class="category-name">skills</span>
        <span class="category-count">3</span>
        <span>AI-powered: draft_rfi, daily_log_summary, submittal_review</span>
      </div>
      <div class="category-row">
        <span class="category-name">templates</span>
        <span class="category-count">3</span>
        <span>List, create from, and get workflow templates</span>
      </div>
      <div class="category-row">
        <span class="category-name">debugging</span>
        <span class="category-count">3</span>
        <span>Diagnose, get unstuck, observe execution</span>
      </div>
    </div>

    <h2>Environment Support</h2>
    <p>WORKWAY supports both Procore <strong>production</strong> and <strong>sandbox</strong> environments. Each user can connect to either environment independently.</p>
    
    <h3>Production vs Sandbox</h3>
    <ul>
      <li><strong>Production</strong> — Real Procore data. Use for live projects.</li>
      <li><strong>Sandbox</strong> — Test environment. Use seeder tools to create sample data.</li>
    </ul>

    <h3>Switching Environments</h3>
    <p>To connect to a different environment, use the <code>environment</code> parameter:</p>
    <pre><code>// Production (default)
workway_connect_procore(environment: "production")

// Sandbox
workway_connect_procore(environment: "sandbox")</code></pre>

    <h2>API Endpoints</h2>
    
    <div class="endpoint">
      <Badge variant="accent">GET</Badge>
      <span class="endpoint-path">{API_BASE_URL}/mcp</span>
      <p>Server info and capabilities</p>
    </div>

    <div class="endpoint">
      <Badge variant="accent">GET</Badge>
      <span class="endpoint-path">{API_BASE_URL}/mcp/tools</span>
      <p>List all 41 available tools with categories</p>
    </div>

    <div class="endpoint">
      <Badge variant="blue">POST</Badge>
      <span class="endpoint-path">{API_BASE_URL}/mcp/tools/&#123;tool_name&#125;</span>
      <p>Execute a tool</p>
    </div>

    <div class="endpoint">
      <Badge variant="accent">GET</Badge>
      <span class="endpoint-path">{API_BASE_URL}/mcp/resources</span>
      <p>List available resources</p>
    </div>

    <h2>Authentication</h2>
    <p>WORKWAY uses OAuth 2.0 for Procore authentication. When you call <code>workway_connect_procore</code>, you'll receive an authorization URL. After completing the OAuth flow, your tokens are securely stored and automatically refreshed.</p>
    
    <h3>Security Features</h3>
    <ul>
      <li><strong>Token Encryption</strong> — All tokens encrypted with AES-256-GCM</li>
      <li><strong>User Isolation</strong> — Each user's tokens stored separately</li>
      <li><strong>Automatic Refresh</strong> — Tokens refreshed before expiration</li>
      <li><strong>Secure Storage</strong> — Cloudflare D1 with encryption at rest</li>
      <li><strong>Environment Separation</strong> — Separate credentials for sandbox and production</li>
    </ul>

    <h2>Workflow Templates</h2>
    <p>Pre-built templates for common construction automations:</p>
    <ul>
      <li><strong>rfi_overdue_alert</strong> — Daily notifications for overdue RFIs</li>
      <li><strong>weekly_project_summary</strong> — Monday morning project digest</li>
      <li><strong>submittal_status_digest</strong> — Daily submittal status report</li>
      <li><strong>daily_log_reminder</strong> — Afternoon reminder to submit daily logs</li>
      <li><strong>new_rfi_notification</strong> — Instant alerts when RFIs are created</li>
      <li><strong>submittal_approved_notification</strong> — Alerts when submittals are approved</li>
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
      <li>Email: <a href="mailto:support@workway.co">support@workway.co</a></li>
      <li>GitHub: <a href="https://github.com/WORKWAYCO/WORKWAY" target="_blank" rel="noopener noreferrer">WORKWAYCO/WORKWAY</a></li>
    </ul>
  </div>
</main>

<Footer />

<style>
  .content {
    padding: var(--space-lg) 0;
    min-height: calc(100vh - 128px);
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 var(--page-padding-x);
  }

  h1 {
    font-size: clamp(2rem, 4vw, 2.5rem);
    font-weight: 700;
    margin-bottom: var(--space-sm);
    letter-spacing: -0.025em;
    color: var(--color-fg-primary);
  }

  h2 {
    font-size: clamp(1.25rem, 2vw, 1.5rem);
    font-weight: 600;
    margin: var(--space-lg) 0 var(--space-sm);
    padding-top: var(--space-md);
    border-top: 1px solid var(--glass-border);
    letter-spacing: -0.02em;
    color: var(--color-fg-primary);
  }

  h3 {
    font-size: 18px;
    font-weight: 600;
    margin: var(--space-md) 0 12px;
    color: var(--color-fg-primary);
  }

  p {
    color: var(--color-fg-secondary);
    margin-bottom: var(--space-sm);
    line-height: 1.6;
  }

  .note {
    font-size: 14px;
    color: var(--color-fg-secondary);
    opacity: 0.8;
    font-style: italic;
  }

  code {
    font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
    font-size: 14px;
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    color: var(--color-fg-primary);
  }

  pre {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    overflow-x: auto;
    margin: var(--space-sm) 0;
  }

  pre code {
    background: none;
    padding: 0;
    font-size: 14px;
    line-height: 1.6;
  }

  .stats-row {
    display: flex;
    gap: var(--space-md);
    margin: var(--space-md) 0;
    padding: var(--space-sm) 0;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    min-width: 80px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-success);
  }

  .stat-label {
    font-size: 12px;
    color: var(--color-fg-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .skill-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    margin: var(--space-sm) 0;
  }

  .skill-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: 8px;
  }

  .skill-task {
    font-size: 12px;
    color: var(--color-fg-secondary);
    opacity: 0.7;
  }

  .skill-card p {
    margin-bottom: 8px;
  }

  .skill-params {
    font-size: 13px;
    color: var(--color-fg-secondary);
    opacity: 0.8;
  }

  .category-table {
    margin: var(--space-sm) 0;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .category-row {
    display: grid;
    grid-template-columns: 120px 60px 1fr;
    gap: var(--space-sm);
    padding: 12px var(--space-sm);
    border-bottom: 1px solid var(--glass-border);
  }

  .category-row:last-child {
    border-bottom: none;
  }

  .category-row.header {
    background: rgba(255, 255, 255, 0.05);
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-fg-secondary);
  }

  .category-name {
    font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
    font-size: 14px;
    color: var(--color-success);
  }

  .category-count {
    font-weight: 600;
    color: var(--color-fg-primary);
    text-align: center;
  }

  .category-row span:last-child {
    font-size: 14px;
    color: var(--color-fg-secondary);
  }

  .endpoint {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    margin: var(--space-sm) 0;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .endpoint-path {
    font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
    font-size: 14px;
    color: var(--color-fg-primary);
  }

  .endpoint p {
    width: 100%;
    margin-top: 8px;
    margin-bottom: 0;
    color: var(--color-fg-secondary);
  }

  ul {
    margin: var(--space-sm) 0;
    padding-left: 24px;
    color: var(--color-fg-secondary);
  }

  li {
    margin: 8px 0;
    line-height: 1.6;
  }

  li strong {
    color: var(--color-fg-primary);
  }

  a {
    color: var(--color-success);
    text-decoration: none;
    transition: opacity var(--duration-standard) var(--ease-standard);
  }

  a:hover {
    opacity: 0.8;
  }

  @media (max-width: 640px) {
    .category-row {
      grid-template-columns: 100px 50px 1fr;
    }
    
    .stats-row {
      flex-wrap: wrap;
    }
  }
</style>
