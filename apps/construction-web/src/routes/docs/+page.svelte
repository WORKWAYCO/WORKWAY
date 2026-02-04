<script lang="ts">
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import { API_BASE_URL } from '$lib/config';

  const mcpConfigCode = `{
  "mcpServers": {
    "procore": {
      "url": "${API_BASE_URL}/mcp"
    }
  }
}`;
</script>

<svelte:head>
  <title>Documentation - WORKWAY</title>
</svelte:head>

<Header />

<main class="content">
  <div class="container">
    <h1>Getting Started</h1>
    <p>WORKWAY is an AI-native automation layer for construction. Connect your AI agent to Procore in minutes.</p>

    <h2>Quick Start</h2>
    
    <h3>1. Configure Your MCP Client</h3>
    <p>Add the Procore MCP server to your AI client configuration:</p>
    <pre><code>{mcpConfigCode}</code></pre>

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
      <Badge variant="accent">GET</Badge>
      <span class="endpoint-path">{API_BASE_URL}/mcp</span>
      <p>Server info and capabilities</p>
    </div>

    <div class="endpoint">
      <Badge variant="accent">GET</Badge>
      <span class="endpoint-path">{API_BASE_URL}/mcp/tools</span>
      <p>List all available tools</p>
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
</style>
