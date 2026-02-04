<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Button from '$lib/components/Button.svelte';
  import { API_BASE_URL } from '$lib/config';

  interface ServerInfo {
    api: string;
    version: string;
    docs: string;
    dashboard: string;
    mcp: string;
  }

  interface ToolsResponse {
    tools: Array<{ name: string; description: string }>;
    categories: Record<string, string[]>;
  }

  let serverInfo: ServerInfo | null = $state(null);
  let toolsData: ToolsResponse | null = $state(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let lastUpdated = $state<Date | null>(null);

  async function fetchServerStatus() {
    loading = true;
    error = null;
    
    try {
      const [infoRes, toolsRes] = await Promise.all([
        fetch(`${API_BASE_URL}`),
        fetch(`${API_BASE_URL}/mcp/tools`)
      ]);

      if (!infoRes.ok || !toolsRes.ok) {
        throw new Error('Failed to fetch server status');
      }

      serverInfo = await infoRes.json();
      toolsData = await toolsRes.json();
      lastUpdated = new Date();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchServerStatus();
  });

  const categoryDescriptions: Record<string, string> = {
    workflow: 'Create and manage automation workflows',
    procore: 'Connect and query Procore data',
    notifications: 'Send alerts via email, Slack, webhooks',
    templates: 'Pre-built workflow templates',
    debugging: 'Diagnose and troubleshoot issues',
    skills: 'AI-powered Intelligence Layer',
    seeder: 'Generate test data for sandbox'
  };
</script>

<svelte:head>
  <title>Dashboard - WORKWAY Construction MCP</title>
  <meta name="description" content="Live status dashboard for WORKWAY Construction MCP server." />
</svelte:head>

<Header />

<main class="content">
  <div class="container">
    <div class="header-row">
      <div>
        <h1>MCP Server Dashboard</h1>
        <p>Live status and capabilities of the WORKWAY Construction MCP server.</p>
      </div>
      <Button variant="secondary" onclick={fetchServerStatus}>
        Refresh
      </Button>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Connecting to MCP server...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <h3>Connection Error</h3>
        <p>{error}</p>
        <Button variant="primary" onclick={fetchServerStatus}>Retry</Button>
      </div>
    {:else if serverInfo && toolsData}
      <!-- Server Status -->
      <section class="status-section">
        <div class="status-header">
          <h2>Server Status</h2>
          <Badge variant="accent">Online</Badge>
        </div>
        
        <div class="status-grid">
          <div class="status-card">
            <span class="status-label">API</span>
            <span class="status-value">{serverInfo.api}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Version</span>
            <span class="status-value">{serverInfo.version}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Total Tools</span>
            <span class="status-value highlight">{toolsData.tools.length}</span>
          </div>
          <div class="status-card">
            <span class="status-label">Categories</span>
            <span class="status-value">{Object.keys(toolsData.categories).length}</span>
          </div>
        </div>

        {#if lastUpdated}
          <p class="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</p>
        {/if}
      </section>

      <!-- Quick Actions -->
      <section class="actions-section">
        <h2>Quick Actions</h2>
        <div class="actions-grid">
          <a href="{API_BASE_URL}/oauth/start?environment=production" class="action-card" target="_blank" rel="noopener noreferrer">
            <div class="action-icon">🏢</div>
            <div class="action-content">
              <h3>Connect Production</h3>
              <p>Link your live Procore account</p>
            </div>
          </a>
          <a href="{API_BASE_URL}/oauth/start?environment=sandbox" class="action-card" target="_blank" rel="noopener noreferrer">
            <div class="action-icon">🧪</div>
            <div class="action-content">
              <h3>Connect Sandbox</h3>
              <p>Link Procore sandbox for testing</p>
            </div>
          </a>
          <a href="/docs" class="action-card">
            <div class="action-icon">📚</div>
            <div class="action-content">
              <h3>Documentation</h3>
              <p>Learn how to use the MCP tools</p>
            </div>
          </a>
          <a href="{API_BASE_URL}/mcp/tools" class="action-card" target="_blank" rel="noopener noreferrer">
            <div class="action-icon">🔧</div>
            <div class="action-content">
              <h3>View All Tools</h3>
              <p>Raw JSON list of all tools</p>
            </div>
          </a>
        </div>
      </section>

      <!-- Tool Categories -->
      <section class="categories-section">
        <h2>Tool Categories</h2>
        <div class="categories-grid">
          {#each Object.entries(toolsData.categories) as [category, tools]}
            <div class="category-card">
              <div class="category-header">
                <span class="category-name">{category}</span>
                <Badge variant="default">{tools.length} tools</Badge>
              </div>
              <p class="category-desc">{categoryDescriptions[category] || 'Tools for ' + category}</p>
              <ul class="tool-list">
                {#each tools.slice(0, 4) as tool}
                  <li>{tool.replace('workway_', '').replace('skill_', '')}</li>
                {/each}
                {#if tools.length > 4}
                  <li class="more">+{tools.length - 4} more</li>
                {/if}
              </ul>
            </div>
          {/each}
        </div>
      </section>

      <!-- Endpoints -->
      <section class="endpoints-section">
        <h2>API Endpoints</h2>
        <div class="endpoints-list">
          <div class="endpoint-item">
            <code>{API_BASE_URL}</code>
            <span class="endpoint-desc">Server info</span>
          </div>
          <div class="endpoint-item">
            <code>{API_BASE_URL}/mcp</code>
            <span class="endpoint-desc">MCP protocol endpoint</span>
          </div>
          <div class="endpoint-item">
            <code>{API_BASE_URL}/mcp/tools</code>
            <span class="endpoint-desc">List all tools</span>
          </div>
          <div class="endpoint-item">
            <code>{API_BASE_URL}/oauth/callback</code>
            <span class="endpoint-desc">OAuth callback</span>
          </div>
        </div>
      </section>
    {/if}
  </div>
</main>

<Footer />

<style>
  .content {
    padding: var(--space-lg) 0;
    min-height: calc(100vh - 128px);
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 var(--page-padding-x);
  }

  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  h1 {
    font-size: clamp(2rem, 4vw, 2.5rem);
    font-weight: 700;
    margin-bottom: var(--space-xs);
    letter-spacing: -0.025em;
    color: var(--color-fg-primary);
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: var(--space-sm);
    color: var(--color-fg-primary);
  }

  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-fg-primary);
    margin: 0;
  }

  p {
    color: var(--color-fg-secondary);
    margin: 0;
    line-height: 1.5;
  }

  section {
    margin-bottom: var(--space-lg);
    padding-top: var(--space-md);
    border-top: 1px solid var(--glass-border);
  }

  section:first-of-type {
    border-top: none;
    padding-top: 0;
  }

  /* Loading & Error States */
  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
    text-align: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--glass-border);
    border-top-color: var(--color-success);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--space-sm);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state h3 {
    color: #ef4444;
    margin-bottom: var(--space-xs);
  }

  .error-state p {
    margin-bottom: var(--space-sm);
  }

  /* Status Section */
  .status-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-sm);
  }

  .status-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .status-label {
    font-size: 12px;
    color: var(--color-fg-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-fg-primary);
    font-family: 'JetBrains Mono', monospace;
  }

  .status-value.highlight {
    color: var(--color-success);
    font-size: 24px;
  }

  .last-updated {
    font-size: 12px;
    color: var(--color-fg-secondary);
    opacity: 0.7;
    margin-top: var(--space-sm);
  }

  /* Actions Section */
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-sm);
  }

  .action-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    display: flex;
    gap: var(--space-sm);
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .action-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--color-success);
  }

  .action-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .action-content h3 {
    margin-bottom: 2px;
  }

  .action-content p {
    font-size: 13px;
  }

  /* Categories Section */
  .categories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-sm);
  }

  .category-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
  }

  .category-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .category-name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-success);
  }

  .category-desc {
    font-size: 13px;
    margin-bottom: 8px;
  }

  .tool-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tool-list li {
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--color-fg-secondary);
    padding: 2px 0;
  }

  .tool-list li.more {
    color: var(--color-fg-secondary);
    opacity: 0.6;
    font-style: italic;
  }

  /* Endpoints Section */
  .endpoints-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .endpoint-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 8px var(--space-sm);
    background: rgba(255, 255, 255, 0.03);
    border-radius: var(--radius-sm);
  }

  .endpoint-item code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: var(--color-success);
    background: none;
  }

  .endpoint-desc {
    font-size: 13px;
    color: var(--color-fg-secondary);
  }

  @media (max-width: 640px) {
    .header-row {
      flex-direction: column;
    }

    .status-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .actions-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
