<script lang="ts">
	// Landing page — the tool recedes, the outcome remains
	import { Search, Link, RefreshCw } from 'lucide-svelte';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
	<title>F→N — Fireflies to Notion Database Sync</title>
	<meta name="description" content="Sync Fireflies transcripts to Notion databases — not pages. Bulk import 900+ transcripts. $0 for 5 syncs/month, $5 for 100, $15 unlimited." />

	<!-- SEO -->
	<meta name="keywords" content="fireflies notion database, fireflies transcript sync, bulk import fireflies notion, fireflies.ai notion integration" />
	<link rel="canonical" href="https://fn.workway.co" />

	<!-- Open Graph -->
	<meta property="og:title" content="F→N — Fireflies to Notion Database Sync" />
	<meta property="og:description" content="Sync Fireflies transcripts to Notion databases — not pages. Bulk import 900+ transcripts tested." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://fn.workway.co" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="F→N — Fireflies to Notion Database Sync" />
	<meta name="twitter:description" content="Sync Fireflies transcripts to Notion databases — not pages. 900+ transcripts tested." />

	<!-- JSON-LD Structured Data -->
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		"name": "F→N",
		"applicationCategory": "BusinessApplication",
		"operatingSystem": "Web",
		"description": "Sync Fireflies.ai transcripts to Notion databases. Bulk import tested with 900+ transcripts.",
		"offers": [
			{
				"@type": "Offer",
				"name": "Free",
				"price": "0",
				"priceCurrency": "USD",
				"description": "5 syncs per month"
			},
			{
				"@type": "Offer",
				"name": "Pro",
				"price": "5",
				"priceCurrency": "USD",
				"description": "100 syncs per month"
			},
			{
				"@type": "Offer",
				"name": "Unlimited",
				"price": "15",
				"priceCurrency": "USD",
				"description": "Unlimited syncs, scheduled auto-sync"
			}
		],
		"provider": {
			"@type": "Organization",
			"name": "WORKWAY",
			"url": "https://workway.co"
		}
	}
	</script>`}

	<!-- FAQ Schema for AEO -->
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"mainEntity": [
			{
				"@type": "Question",
				"name": "How do I sync Fireflies transcripts to a Notion database?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "F→N syncs Fireflies transcripts to Notion databases (not pages). Connect Fireflies API key, authorize Notion, select database, sync. Each transcript becomes a queryable database row."
				}
			},
			{
				"@type": "Question",
				"name": "Does Fireflies have a Notion database integration?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Fireflies native integration syncs to Notion pages only. F→N syncs to databases — queryable, filterable, linkable to other databases via relation properties."
				}
			},
			{
				"@type": "Question",
				"name": "Can I bulk import Fireflies transcripts to Notion?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Yes. F→N bulk import tested with 900+ transcripts. Runs on Cloudflare Workers — no timeout limits. Select transcripts, choose database, sync."
				}
			},
			{
				"@type": "Question",
				"name": "How much does Fireflies to Notion sync cost?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Free: 5 syncs/month. Pro: $5/month for 100 syncs. Unlimited: $15/month for unlimited syncs plus scheduled auto-sync."
				}
			}
		]
	}
	</script>`}
</svelte:head>

<div class="min-h-screen flex flex-col">
	<Header />

	<!-- Hero -->
	<main class="flex-1">
		<section class="max-w-5xl mx-auto px-4 py-24 text-center">
			<h1 class="font-bold tracking-tight mb-6 leading-tight" style="font-size: clamp(2.5rem, 7vw, 4.5rem);">
				Fireflies transcripts<br />
				<span class="text-white/80">in Notion databases</span>
			</h1>
			<p class="text-white/60 max-w-2xl mx-auto mb-10 text-center leading-relaxed" style="font-size: clamp(1.125rem, 2vw, 1.5rem);">
				Not pages — databases. Queryable, filterable, linked to your work.
			</p>
			<div class="flex items-center justify-center gap-4">
				<a
					href="/auth/signup"
					class="bg-white text-black px-6 py-3 rounded-md font-medium hover:bg-white/90 transition-colors"
				>
					Start free
				</a>
				<a
					href="#how-it-works"
					class="border border-white/10 px-6 py-3 rounded-md font-medium hover:bg-white/5 transition-colors"
				>
					How it works
				</a>
			</div>
		</section>

		<!-- What you get -->
		<section id="how-it-works" class="border-t border-white/10">
			<div class="max-w-5xl mx-auto px-4 py-20">
				<h2 class="text-3xl font-bold mb-12 text-center">What this does</h2>
				<div class="grid md:grid-cols-3 gap-12">
					<div>
						<div class="w-10 h-10 bg-white/10 rounded-md flex items-center justify-center mb-4 text-white/80">
							<Search size={20} />
						</div>
						<h3 class="font-semibold text-lg mb-2">Database entries</h3>
						<p class="text-white/60 leading-relaxed">Each transcript becomes a row. Filter by date, participant, or keyword.</p>
					</div>
					<div>
						<div class="w-10 h-10 bg-white/10 rounded-md flex items-center justify-center mb-4 text-white/80">
							<Link size={20} />
						</div>
						<h3 class="font-semibold text-lg mb-2">Relation properties</h3>
						<p class="text-white/60 leading-relaxed">Link transcripts to projects, clients, or any other database.</p>
					</div>
					<div>
						<div class="w-10 h-10 bg-white/10 rounded-md flex items-center justify-center mb-4 text-white/80">
							<RefreshCw size={20} />
						</div>
						<h3 class="font-semibold text-lg mb-2">Bulk import</h3>
						<p class="text-white/60 leading-relaxed">Tested with 900+ transcripts. No timeouts — runs on Cloudflare.</p>
					</div>
				</div>
			</div>
		</section>

		<!-- CTA -->
		<section class="border-t border-white/10 bg-[#0a0a0a]">
			<div class="max-w-5xl mx-auto px-4 py-20 text-center">
				<h2 class="text-3xl font-bold mb-4">5 syncs free. No card required.</h2>
				<p class="text-white/60 mb-8 leading-relaxed">Pro: $5/mo for 100 syncs. Unlimited: $15/mo.</p>
				<a
					href="/auth/signup"
					class="inline-block bg-white text-black px-6 py-3 rounded-md font-medium hover:bg-white/90 transition-colors"
				>
					Start free
				</a>
			</div>
		</section>
	</main>

	<Footer />
</div>
