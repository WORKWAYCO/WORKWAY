<script lang="ts">
	import { ArrowRight, CheckCircle2, Code2, Terminal, Rocket } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Your First Workflow | WORKWAY Docs</title>
	<meta name="description" content="Step-by-step guide to building your first WORKWAY workflow. Connect Zoom to Notion with TypeScript." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Header -->
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/guides" class="hover:text-[var(--brand-text)]">Guides</a>
			<span>/</span>
			<span>Your First Workflow</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Your First Workflow</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Build a workflow that syncs Zoom recordings to Notion. You'll learn the core concepts while building something useful.
		</p>
	</div>

	<!-- What we're building -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">What We're Building</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 bg-[var(--color-hover)]">
			<p class="text-[var(--color-fg-secondary)] mb-4">
				When a Zoom recording completes, automatically create a Notion page with:
			</p>
			<ul class="space-y-2 text-[var(--color-fg-secondary)]">
				<li class="flex items-center gap-2">
					<CheckCircle2 size={16} class="text-[var(--color-success)]" />
					Meeting title and date
				</li>
				<li class="flex items-center gap-2">
					<CheckCircle2 size={16} class="text-[var(--color-success)]" />
					Recording link
				</li>
				<li class="flex items-center gap-2">
					<CheckCircle2 size={16} class="text-[var(--color-success)]" />
					Participant list
				</li>
			</ul>
		</div>
	</section>

	<!-- Step 1 -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm">1</div>
			<h2 class="text-xl font-semibold">Create the Project</h2>
		</div>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden mb-4">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]">$ workway workflow init zoom-to-notion
$ cd zoom-to-notion</code></pre>
		</div>
		<p class="text-[var(--color-fg-secondary)]">
			This creates a new workflow project with TypeScript configuration and a starter template.
		</p>
	</section>

	<!-- Step 2 -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm">2</div>
			<h2 class="text-xl font-semibold">Define the Workflow</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Replace the contents of <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">workflow.ts</code>:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workflow.ts</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} defineWorkflow, webhook {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>

<span class="text-[var(--brand-text-muted)]">export default</span> <span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  name: <span class="text-[var(--color-success)]">'Zoom to Notion'</span>,
  description: <span class="text-[var(--color-success)]">'Sync Zoom recordings to a Notion database'</span>,
  type: <span class="text-[var(--color-success)]">'integration'</span>,

  <span class="text-[var(--brand-text-muted)]">// Services we need</span>
  integrations: [
    {'{'} service: <span class="text-[var(--color-success)]">'zoom'</span>, scopes: [<span class="text-[var(--color-success)]">'read_recordings'</span>] {'}'},
    {'{'} service: <span class="text-[var(--color-success)]">'notion'</span>, scopes: [<span class="text-[var(--color-success)]">'write_pages'</span>] {'}'}
  ],

  <span class="text-[var(--brand-text-muted)]">// User configuration</span>
  inputs: {'{'}
    notionDatabase: {'{'}
      type: <span class="text-[var(--color-success)]">'notion_database_picker'</span>,
      label: <span class="text-[var(--color-success)]">'Notion Database'</span>,
      description: <span class="text-[var(--color-success)]">'Where to save recordings'</span>,
      required: <span class="text-[var(--color-success)]">true</span>
    {'}'}
  {'}'},

  <span class="text-[var(--brand-text-muted)]">// Trigger: when a recording completes</span>
  trigger: <span class="text-[var(--brand-text)]">webhook</span>({'{'}
    service: <span class="text-[var(--color-success)]">'zoom'</span>,
    event: <span class="text-[var(--color-success)]">'recording.completed'</span>
  {'}'}),

  <span class="text-[var(--brand-text-muted)]">// The workflow logic</span>
  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} trigger, inputs, integrations, log {'}'}) {'{'}
    <span class="text-[var(--brand-text-muted)]">const</span> recording = trigger.data.payload.object
    
    log.info(<span class="text-[var(--color-success)]">'Processing recording'</span>, {'{'} 
      topic: recording.topic,
      duration: recording.duration 
    {'}'})

    <span class="text-[var(--brand-text-muted)]">// Create Notion page</span>
    <span class="text-[var(--brand-text-muted)]">await</span> integrations.notion.pages.<span class="text-[var(--brand-text)]">create</span>({'{'}
      parent: {'{'} database_id: inputs.notionDatabase {'}'},
      properties: {'{'}
        <span class="text-[var(--color-success)]">'Title'</span>: {'{'}
          title: [{'{'} text: {'{'} content: recording.topic {'}'} {'}'}]
        {'}'},
        <span class="text-[var(--color-success)]">'Date'</span>: {'{'}
          date: {'{'} start: recording.start_time {'}'}
        {'}'},
        <span class="text-[var(--color-success)]">'Duration'</span>: {'{'}
          number: recording.duration
        {'}'},
        <span class="text-[var(--color-success)]">'Recording URL'</span>: {'{'}
          url: recording.share_url
        {'}'}
      {'}'}
    {'}'})

    log.info(<span class="text-[var(--color-success)]">'Created Notion page'</span>)
    <span class="text-[var(--brand-text-muted)]">return</span> {'{'} success: <span class="text-[var(--color-success)]">true</span>, topic: recording.topic {'}'}
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- Step 3 -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm">3</div>
			<h2 class="text-xl font-semibold">Connect OAuth (for testing)</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Connect your Zoom and Notion accounts for local testing:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-loose"><code class="text-[var(--color-fg-secondary)]">$ workway oauth connect zoom
$ workway oauth connect notion</code></pre>
		</div>
	</section>

	<!-- Step 4 -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm">4</div>
			<h2 class="text-xl font-semibold">Test Locally</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Create test data in <code class="font-mono text-sm bg-[var(--color-hover)] px-1.5 py-0.5 rounded">test-data.json</code>:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden mb-4">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">test-data.json</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]">{'{'}
  <span class="text-[var(--color-success)]">"inputs"</span>: {'{'}
    <span class="text-[var(--color-success)]">"notionDatabase"</span>: <span class="text-[var(--color-success)]">"your-database-id"</span>
  {'}'},
  <span class="text-[var(--color-success)]">"trigger"</span>: {'{'}
    <span class="text-[var(--color-success)]">"data"</span>: {'{'}
      <span class="text-[var(--color-success)]">"payload"</span>: {'{'}
        <span class="text-[var(--color-success)]">"object"</span>: {'{'}
          <span class="text-[var(--color-success)]">"topic"</span>: <span class="text-[var(--color-success)]">"Team Standup"</span>,
          <span class="text-[var(--color-success)]">"start_time"</span>: <span class="text-[var(--color-success)]">"2026-01-16T10:00:00Z"</span>,
          <span class="text-[var(--color-success)]">"duration"</span>: 30,
          <span class="text-[var(--color-success)]">"share_url"</span>: <span class="text-[var(--color-success)]">"https://zoom.us/rec/share/..."</span>
        {'}'}
      {'}'}
    {'}'}
  {'}'}
{'}'}</code></pre>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">Run the test:</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono"><code class="text-[var(--color-fg-secondary)]">$ workway workflow test --live</code></pre>
		</div>
	</section>

	<!-- Step 5 -->
	<section class="mb-12">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-[var(--brand-bg)] flex items-center justify-center font-bold text-sm">5</div>
			<h2 class="text-xl font-semibold">Publish</h2>
		</div>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			When you're ready, publish to the marketplace:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono"><code class="text-[var(--color-fg-secondary)]">$ workway workflow publish</code></pre>
		</div>
	</section>

	<!-- Key Concepts -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Key Concepts Covered</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Integrations</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Declared services with OAuth scopes. WORKWAY handles auth.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Inputs</div>
				<p class="text-sm text-[var(--brand-text-muted)]">User-configurable values with typed pickers.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Triggers</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Webhook events from connected services.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Execute</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Async function with typed context and integrations.</p>
			</div>
		</div>
	</section>

	<!-- Next Steps -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Next Steps</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/guides/ai-workflows" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Add AI</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Enhance with AI summarization using Workers AI.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/pricing" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Set Pricing</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Configure pricing for your marketplace workflow.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View guide <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>
