<script lang="ts">
	import { Cpu, ArrowRight, Zap, DollarSign } from 'lucide-svelte';
</script>

<svelte:head>
	<title>AI-Powered Workflows | WORKWAY Docs</title>
	<meta name="description" content="Build AI-powered workflows with Cloudflare Workers AI. Text generation, classification, summarization, and more." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Header -->
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/guides" class="hover:text-[var(--brand-text)]">Guides</a>
			<span>/</span>
			<span>AI-Powered Workflows</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">AI-Powered Workflows</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Add AI capabilities to your workflows using Cloudflare Workers AI. No API keys, 10-100x cheaper than external providers.
		</p>
	</div>

	<!-- Workflow Types -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">When to Use AI</h2>
		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<Zap size={20} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">type: 'ai-enhanced'</h3>
					<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded">~$0.01/exec</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-2">1-2 AI calls for classification, routing, or simple analysis.</p>
				<p class="text-sm text-[var(--color-fg-secondary)]">Examples: Email categorization, sentiment analysis, ticket routing</p>
			</div>

			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5">
				<div class="flex items-center gap-3 mb-3">
					<Cpu size={20} class="text-[var(--color-fg-secondary)]" />
					<h3 class="font-semibold">type: 'ai-native'</h3>
					<span class="text-xs bg-[var(--color-hover)] px-2 py-0.5 rounded">~$0.03/exec</span>
				</div>
				<p class="text-sm text-[var(--brand-text-muted)] mb-2">Multi-step AI pipelines for content generation and complex analysis.</p>
				<p class="text-sm text-[var(--color-fg-secondary)]">Examples: Meeting summaries, newsletter generation, research assistants</p>
			</div>
		</div>
	</section>

	<!-- Example: Smart Ticket Router -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Example: Smart Ticket Router</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Automatically categorize and route support tickets using AI:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workflow.ts</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} defineWorkflow, webhook {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>
<span class="text-[var(--brand-text-muted)]">import</span> {'{'} createAIClient, AIModels {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk/workers-ai'</span>

<span class="text-[var(--brand-text-muted)]">export default</span> <span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  name: <span class="text-[var(--color-success)]">'Smart Ticket Router'</span>,
  type: <span class="text-[var(--color-success)]">'ai-enhanced'</span>,

  integrations: [
    {'{'} service: <span class="text-[var(--color-success)]">'zendesk'</span>, scopes: [<span class="text-[var(--color-success)]">'read_tickets'</span>, <span class="text-[var(--color-success)]">'update_tickets'</span>] {'}'},
    {'{'} service: <span class="text-[var(--color-success)]">'slack'</span>, scopes: [<span class="text-[var(--color-success)]">'send_messages'</span>] {'}'}
  ],

  inputs: {'{'}
    teams: {'{'}
      type: <span class="text-[var(--color-success)]">'array'</span>,
      items: {'{'} name: <span class="text-[var(--color-success)]">'string'</span>, slackChannel: <span class="text-[var(--color-success)]">'string'</span> {'}'}
    {'}'}
  {'}'},

  trigger: <span class="text-[var(--brand-text)]">webhook</span>({'{'} service: <span class="text-[var(--color-success)]">'zendesk'</span>, event: <span class="text-[var(--color-success)]">'ticket.created'</span> {'}'}),

  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} trigger, inputs, integrations, env {'}'}) {'{'}
    <span class="text-[var(--brand-text-muted)]">const</span> ticket = trigger.data.ticket
    <span class="text-[var(--brand-text-muted)]">const</span> ai = <span class="text-[var(--brand-text)]">createAIClient</span>(env)

    <span class="text-[var(--brand-text-muted)]">// Classify with AI - fast model for simple task</span>
    <span class="text-[var(--brand-text-muted)]">const</span> result = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">generateText</span>({'{'}
      model: AIModels.LLAMA_2_7B,
      system: <span class="text-[var(--color-success)]">`Classify into: ${'$'}{inputs.teams.map(t => t.name).join(', ')}. Reply with only the category.`</span>,
      prompt: <span class="text-[var(--color-success)]">`${'$'}{ticket.subject}\n${'$'}{ticket.description}`</span>,
      max_tokens: 20
    {'}'})

    <span class="text-[var(--brand-text-muted)]">const</span> category = result.data.trim()
    <span class="text-[var(--brand-text-muted)]">const</span> team = inputs.teams.find(t => t.name === category) || inputs.teams[0]

    <span class="text-[var(--brand-text-muted)]">// Update ticket</span>
    <span class="text-[var(--brand-text-muted)]">await</span> integrations.zendesk.tickets.<span class="text-[var(--brand-text)]">update</span>(ticket.id, {'{'}
      tags: [team.name.toLowerCase()]
    {'}'})

    <span class="text-[var(--brand-text-muted)]">// Notify team</span>
    <span class="text-[var(--brand-text-muted)]">await</span> integrations.slack.chat.<span class="text-[var(--brand-text)]">postMessage</span>({'{'}
      channel: team.slackChannel,
      text: <span class="text-[var(--color-success)]">`New ${'$'}{team.name} ticket: ${'$'}{ticket.subject}`</span>
    {'}'})

    <span class="text-[var(--brand-text-muted)]">return</span> {'{'} success: <span class="text-[var(--color-success)]">true</span>, category: team.name {'}'}
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- Example: Meeting Summary -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Example: Meeting Summary Generator</h2>
		<p class="text-[var(--color-fg-secondary)] mb-4">
			Generate AI summaries from meeting transcripts:
		</p>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workflow.ts</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} defineWorkflow, webhook {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>
<span class="text-[var(--brand-text-muted)]">import</span> {'{'} createAIClient, AIModels {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk/workers-ai'</span>

<span class="text-[var(--brand-text-muted)]">export default</span> <span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  name: <span class="text-[var(--color-success)]">'Meeting Summary'</span>,
  type: <span class="text-[var(--color-success)]">'ai-native'</span>,

  integrations: [
    {'{'} service: <span class="text-[var(--color-success)]">'zoom'</span>, scopes: [<span class="text-[var(--color-success)]">'read_recordings'</span>] {'}'},
    {'{'} service: <span class="text-[var(--color-success)]">'notion'</span>, scopes: [<span class="text-[var(--color-success)]">'write_pages'</span>] {'}'}
  ],

  inputs: {'{'}
    notionDb: {'{'} type: <span class="text-[var(--color-success)]">'notion_database_picker'</span>, required: <span class="text-[var(--color-success)]">true</span> {'}'}
  {'}'},

  trigger: <span class="text-[var(--brand-text)]">webhook</span>({'{'} service: <span class="text-[var(--color-success)]">'zoom'</span>, event: <span class="text-[var(--color-success)]">'recording.transcript_completed'</span> {'}'}),

  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} trigger, inputs, integrations, env {'}'}) {'{'}
    <span class="text-[var(--brand-text-muted)]">const</span> recording = trigger.data.payload.object
    <span class="text-[var(--brand-text-muted)]">const</span> ai = <span class="text-[var(--brand-text)]">createAIClient</span>(env)

    <span class="text-[var(--brand-text-muted)]">// Get transcript</span>
    <span class="text-[var(--brand-text-muted)]">const</span> transcript = <span class="text-[var(--brand-text-muted)]">await</span> integrations.zoom.recordings
      .<span class="text-[var(--brand-text)]">getTranscript</span>(recording.id)

    <span class="text-[var(--brand-text-muted)]">// Generate summary</span>
    <span class="text-[var(--brand-text-muted)]">const</span> summary = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">generateText</span>({'{'}
      model: AIModels.LLAMA_3_8B,
      system: <span class="text-[var(--color-success)]">'Summarize this meeting transcript. Include key decisions and action items.'</span>,
      prompt: transcript,
      max_tokens: 1000
    {'}'})

    <span class="text-[var(--brand-text-muted)]">// Extract action items</span>
    <span class="text-[var(--brand-text-muted)]">const</span> actions = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">generateText</span>({'{'}
      model: AIModels.LLAMA_2_7B,
      system: <span class="text-[var(--color-success)]">'Extract action items as a bullet list. Format: - [Owner] Action'</span>,
      prompt: summary.data,
      max_tokens: 500
    {'}'})

    <span class="text-[var(--brand-text-muted)]">// Save to Notion</span>
    <span class="text-[var(--brand-text-muted)]">await</span> integrations.notion.pages.<span class="text-[var(--brand-text)]">create</span>({'{'}
      parent: {'{'} database_id: inputs.notionDb {'}'},
      properties: {'{'}
        <span class="text-[var(--color-success)]">'Title'</span>: {'{'} title: [{'{'} text: {'{'} content: recording.topic {'}'} {'}'}] {'}'},
        <span class="text-[var(--color-success)]">'Date'</span>: {'{'} date: {'{'} start: recording.start_time {'}'} {'}'}
      {'}'},
      children: [
        {'{'} type: <span class="text-[var(--color-success)]">'heading_2'</span>, heading_2: {'{'} text: <span class="text-[var(--color-success)]">'Summary'</span> {'}'} {'}'},
        {'{'} type: <span class="text-[var(--color-success)]">'paragraph'</span>, paragraph: {'{'} text: summary.data {'}'} {'}'},
        {'{'} type: <span class="text-[var(--color-success)]">'heading_2'</span>, heading_2: {'{'} text: <span class="text-[var(--color-success)]">'Action Items'</span> {'}'} {'}'},
        {'{'} type: <span class="text-[var(--color-success)]">'paragraph'</span>, paragraph: {'{'} text: actions.data {'}'} {'}'}
      ]
    {'}'})

    <span class="text-[var(--brand-text-muted)]">return</span> {'{'} success: <span class="text-[var(--color-success)]">true</span> {'}'}
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- Cost Optimization -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Cost Optimization Tips</h2>
		<div class="space-y-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Use the Right Model</div>
				<p class="text-sm text-[var(--brand-text-muted)]">
					<code class="font-mono bg-[var(--color-hover)] px-1 rounded">LLAMA_2_7B</code> for simple classification. 
					<code class="font-mono bg-[var(--color-hover)] px-1 rounded">LLAMA_3_8B</code> for complex reasoning.
				</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Limit Output Tokens</div>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Set <code class="font-mono bg-[var(--color-hover)] px-1 rounded">max_tokens</code> to the minimum needed. Classification? Use 10-20.
				</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Cache Results</div>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Use <code class="font-mono bg-[var(--color-hover)] px-1 rounded">cache: true</code> for repeated prompts. Cache at application level for custom keys.
				</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Avoid AI When Possible</div>
				<p class="text-sm text-[var(--brand-text-muted)]">
					Don't use AI for simple logic. <code class="font-mono bg-[var(--color-hover)] px-1 rounded">if/else</code> is free.
				</p>
			</div>
		</div>
	</section>

	<!-- Next Steps -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Next Steps</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk/workers-ai" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Workers AI Reference</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Full API reference for all AI methods.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					View reference <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/sdk/vectorize" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Build RAG Systems</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Semantic search and knowledge bases with Vectorize.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>
