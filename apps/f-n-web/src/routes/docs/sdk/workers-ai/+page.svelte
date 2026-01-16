<script lang="ts">
	import { Cpu, ArrowRight, Copy, Check } from 'lucide-svelte';

	let copied = $state<number | null>(null);

	async function copyCode(code: string, index: number) {
		await navigator.clipboard.writeText(code);
		copied = index;
		setTimeout(() => copied = null, 2000);
	}

	const models = [
		{ name: 'Llama 2 7B', alias: 'LLAMA_2_7B', cost: '$0.005', context: '4096', best: 'Fast, simple tasks' },
		{ name: 'Llama 3 8B', alias: 'LLAMA_3_8B', cost: '$0.01', context: '8192', best: 'Balanced (default)' },
		{ name: 'Mistral 7B', alias: 'MISTRAL_7B', cost: '$0.02', context: '8192', best: 'Complex reasoning' },
		{ name: 'BGE Small', alias: 'BGE_SMALL', cost: '$0.001', context: '-', best: 'Fast embeddings' },
		{ name: 'BGE Base', alias: 'BGE_BASE', cost: '$0.002', context: '-', best: 'Quality embeddings' },
		{ name: 'Stable Diffusion XL', alias: 'STABLE_DIFFUSION_XL', cost: '$0.02/img', context: '-', best: 'Image generation' },
		{ name: 'Whisper', alias: 'WHISPER', cost: '$0.006/min', context: '-', best: 'Speech-to-text' },
	];
</script>

<svelte:head>
	<title>Workers AI | WORKWAY Docs</title>
	<meta name="description" content="Cloudflare Workers AI integration for WORKWAY workflows. Text generation, embeddings, images, and audio." />
</svelte:head>

<div class="p-6 md:p-10 max-w-4xl">
	<!-- Header -->
	<div class="mb-12">
		<div class="flex items-center gap-2 text-sm text-[var(--brand-text-muted)] mb-4">
			<a href="/docs" class="hover:text-[var(--brand-text)]">Docs</a>
			<span>/</span>
			<a href="/docs/sdk" class="hover:text-[var(--brand-text)]">SDK</a>
			<span>/</span>
			<span>Workers AI</span>
		</div>
		<h1 class="text-3xl md:text-4xl font-bold mb-4">Workers AI</h1>
		<p class="text-lg text-[var(--color-fg-secondary)] max-w-2xl">
			Cloudflare-native AI for text generation, embeddings, images, and audio. No API keys required. 10-100x cheaper than external providers.
		</p>
	</div>

	<!-- Quick Example -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Quick Example</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<div class="px-4 py-2 border-b border-[var(--brand-border)] bg-[var(--color-hover)]">
				<span class="text-xs font-mono text-[var(--brand-text-muted)]">workflow.ts</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">import</span> {'{'} defineWorkflow {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk'</span>
<span class="text-[var(--brand-text-muted)]">import</span> {'{'} createAIClient, AIModels {'}'} <span class="text-[var(--brand-text-muted)]">from</span> <span class="text-[var(--color-success)]">'@workway/sdk/workers-ai'</span>

<span class="text-[var(--brand-text-muted)]">export default</span> <span class="text-[var(--brand-text)]">defineWorkflow</span>({'{'}
  name: <span class="text-[var(--color-success)]">'AI Email Processor'</span>,
  type: <span class="text-[var(--color-success)]">'ai-native'</span>,

  <span class="text-[var(--brand-text-muted)]">async</span> <span class="text-[var(--brand-text)]">execute</span>({'{'} env {'}'}) {'{'}
    <span class="text-[var(--brand-text-muted)]">const</span> ai = <span class="text-[var(--brand-text)]">createAIClient</span>(env)

    <span class="text-[var(--brand-text-muted)]">const</span> result = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">generateText</span>({'{'}
      prompt: <span class="text-[var(--color-success)]">'Summarize this email...'</span>,
      model: AIModels.LLAMA_3_8B,
      max_tokens: 512
    {'}'})

    <span class="text-[var(--brand-text-muted)]">return</span> {'{'} summary: result.data {'}'}
  {'}'}
{'}'})</code></pre>
		</div>
	</section>

	<!-- Available Models -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Available Models</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--brand-border)]">
						<th class="text-left py-3 px-4 font-semibold">Model</th>
						<th class="text-left py-3 px-4 font-semibold">Alias</th>
						<th class="text-left py-3 px-4 font-semibold">Cost/1M</th>
						<th class="text-left py-3 px-4 font-semibold">Best For</th>
					</tr>
				</thead>
				<tbody>
					{#each models as model}
						<tr class="border-b border-[var(--brand-border)]">
							<td class="py-3 px-4">{model.name}</td>
							<td class="py-3 px-4 font-mono text-xs text-[var(--color-success)]">{model.alias}</td>
							<td class="py-3 px-4 text-[var(--brand-text-muted)]">{model.cost}</td>
							<td class="py-3 px-4 text-[var(--brand-text-muted)]">{model.best}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Text Generation -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Text Generation</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">const</span> ai = <span class="text-[var(--brand-text)]">createAIClient</span>(env)

<span class="text-[var(--brand-text-muted)]">const</span> result = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">generateText</span>({'{'}
  prompt: <span class="text-[var(--color-success)]">'Write a product description for...'</span>,
  model: AIModels.LLAMA_3_8B,      <span class="text-[var(--brand-text-muted)]">// Default</span>
  temperature: 0.7,                 <span class="text-[var(--brand-text-muted)]">// Default: 0.7</span>
  max_tokens: 1024,                 <span class="text-[var(--brand-text-muted)]">// Default: 1024</span>
  system: <span class="text-[var(--color-success)]">'You are a helpful assistant'</span>,
  cache: <span class="text-[var(--color-success)]">true</span>                       <span class="text-[var(--brand-text-muted)]">// Enable caching</span>
{'}'})

console.log(result.data) <span class="text-[var(--brand-text-muted)]">// Generated text</span></code></pre>
		</div>
	</section>

	<!-- Embeddings -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Embeddings</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">const</span> embeddings = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">generateEmbeddings</span>({'{'}
  text: <span class="text-[var(--color-success)]">'Search query or document text'</span>,
  model: AIModels.BGE_BASE  <span class="text-[var(--brand-text-muted)]">// Default</span>
{'}'})

console.log(embeddings.data) <span class="text-[var(--brand-text-muted)]">// [[0.1, 0.2, ...], ...]</span></code></pre>
		</div>
	</section>

	<!-- Image Generation -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Image Generation</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">const</span> image = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">generateImage</span>({'{'}
  prompt: <span class="text-[var(--color-success)]">'A futuristic city at sunset'</span>,
  model: AIModels.STABLE_DIFFUSION_XL,
  negative_prompt: <span class="text-[var(--color-success)]">'blurry, low quality'</span>,
  width: 1024,
  height: 1024
{'}'})

<span class="text-[var(--brand-text-muted)]">// Returns image as ArrayBuffer</span></code></pre>
		</div>
	</section>

	<!-- Speech to Text -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Speech to Text</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">const</span> transcript = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">transcribeAudio</span>({'{'}
  audio: audioBuffer,  <span class="text-[var(--brand-text-muted)]">// ArrayBuffer</span>
  model: AIModels.WHISPER,
  language: <span class="text-[var(--color-success)]">'en'</span>
{'}'})

console.log(transcript.data) <span class="text-[var(--brand-text-muted)]">// Transcribed text</span></code></pre>
		</div>
	</section>

	<!-- Sentiment Analysis -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Sentiment Analysis</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">const</span> sentiment = <span class="text-[var(--brand-text-muted)]">await</span> ai.<span class="text-[var(--brand-text)]">analyzeSentiment</span>({'{'}
  text: <span class="text-[var(--color-success)]">'This product is amazing!'</span>
{'}'})

<span class="text-[var(--brand-text-muted)]">{'// { sentiment: "POSITIVE", confidence: 0.95 }'}</span></code></pre>
		</div>
	</section>

	<!-- Streaming -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Streaming Responses</h2>
		<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] overflow-hidden">
			<pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code class="text-[var(--color-fg-secondary)]"><span class="text-[var(--brand-text-muted)]">for await</span> (<span class="text-[var(--brand-text-muted)]">const</span> chunk <span class="text-[var(--brand-text-muted)]">of</span> ai.<span class="text-[var(--brand-text)]">streamText</span>({'{'} prompt: <span class="text-[var(--color-success)]">'...'</span> {'}'})) {'{'}
  console.log(chunk) <span class="text-[var(--brand-text-muted)]">{'// Streamed text chunk'}</span>
{'}'}</code></pre>
		</div>
	</section>

	<!-- Cost Comparison -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Cost Comparison</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-[var(--brand-border)]">
						<th class="text-left py-3 px-4 font-semibold">Provider</th>
						<th class="text-left py-3 px-4 font-semibold">Model</th>
						<th class="text-left py-3 px-4 font-semibold">Cost/1M tokens</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-b border-[var(--brand-border)] bg-[var(--color-success-background)]">
						<td class="py-3 px-4 font-semibold">Workers AI</td>
						<td class="py-3 px-4">Llama 3 8B</td>
						<td class="py-3 px-4 text-[var(--color-success)]">$0.01</td>
					</tr>
					<tr class="border-b border-[var(--brand-border)]">
						<td class="py-3 px-4">OpenAI</td>
						<td class="py-3 px-4">GPT-4o-mini</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">$0.15-0.60</td>
					</tr>
					<tr>
						<td class="py-3 px-4">Anthropic</td>
						<td class="py-3 px-4">Claude Haiku</td>
						<td class="py-3 px-4 text-[var(--brand-text-muted)]">$0.25-1.25</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<!-- Why Workers AI -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold mb-4">Why Workers AI?</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">No API Keys</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Works instantly with Cloudflare binding. Zero configuration.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Data Privacy</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Data stays within Cloudflare network. Never leaves the edge.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Cost Efficiency</div>
				<p class="text-sm text-[var(--brand-text-muted)]">10-100x cheaper than external providers.</p>
			</div>
			<div class="border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-4">
				<div class="font-semibold mb-2">Edge Latency</div>
				<p class="text-sm text-[var(--brand-text-muted)]">Runs close to users globally. Fast inference.</p>
			</div>
		</div>
	</section>

	<!-- Next Steps -->
	<section>
		<h2 class="text-xl font-semibold mb-4">Next Steps</h2>
		<div class="grid md:grid-cols-2 gap-4">
			<a href="/docs/sdk/vectorize" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">Vectorize</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Build RAG systems with semantic search.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Learn more <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
			<a href="/docs/guides/ai-workflows" class="group border border-[var(--brand-border)] rounded-[var(--brand-radius)] p-5 hover:border-[var(--color-fg-secondary)]/50 transition-colors">
				<h3 class="font-semibold mb-2 group-hover:text-[var(--brand-text)]">AI Workflow Guide</h3>
				<p class="text-sm text-[var(--brand-text-muted)]">Build a complete AI-powered workflow.</p>
				<span class="inline-flex items-center gap-1 mt-3 text-xs text-[var(--color-fg-secondary)]">
					Start building <ArrowRight size={12} class="group-hover:translate-x-0.5 transition-transform" />
				</span>
			</a>
		</div>
	</section>
</div>
