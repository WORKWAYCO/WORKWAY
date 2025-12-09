<script lang="ts">
	import { Check } from 'lucide-svelte';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const tiers = [
		{
			name: 'Free',
			price: '$0',
			period: '/mo',
			description: 'Try it',
			features: [
				'5 syncs/month',
				'Manual trigger',
				'Database entries',
				'Deduplication'
			],
			cta: 'Start free',
			href: '/auth/signup',
			highlighted: false
		},
		{
			name: 'Pro',
			price: '$5',
			period: '/mo',
			description: '100 syncs',
			features: [
				'100 syncs/month',
				'Bulk import — 900+ tested',
				'Date range filter',
				'Priority support',
				'Price locked forever'
			],
			cta: 'Get Pro',
			href: '/auth/signup?plan=pro',
			highlighted: true
		},
		{
			name: 'Unlimited',
			price: '$15',
			period: '/mo',
			description: 'No limits',
			features: [
				'Unlimited syncs',
				'Scheduled auto-sync',
				'Email on completion',
				'12-month history',
				'Cloudflare Workers — no timeouts',
				'Price locked forever'
			],
			cta: 'Get Unlimited',
			href: '/auth/signup?plan=unlimited',
			highlighted: false
		}
	];
</script>

<svelte:head>
	<title>Pricing — F→N | $0/5 syncs, $5/100 syncs, $15/unlimited</title>
	<meta name="description" content="F→N pricing: $0 for 5 syncs/month, $5 for 100 syncs, $15 unlimited. Bulk import 900+ transcripts. Early adopter prices locked." />

	<!-- SEO -->
	<link rel="canonical" href="https://fn.workway.co/pricing" />

	<!-- Open Graph -->
	<meta property="og:title" content="F→N Pricing — $0/5, $5/100, $15/unlimited" />
	<meta property="og:description" content="Fireflies to Notion database sync. $0 for 5 syncs/month. $5 for 100. $15 unlimited. Prices locked for early adopters." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://fn.workway.co/pricing" />

	<!-- JSON-LD Pricing Schema -->
	{@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "Product",
		"name": "F→N",
		"description": "Fireflies to Notion database sync. Bulk import tested with 900+ transcripts.",
		"offers": [
			{
				"@type": "Offer",
				"name": "Free",
				"price": "0",
				"priceCurrency": "USD",
				"description": "5 syncs/month, manual trigger, deduplication"
			},
			{
				"@type": "Offer",
				"name": "Pro",
				"price": "5",
				"priceCurrency": "USD",
				"description": "100 syncs/month, bulk import (900+ tested), date filter"
			},
			{
				"@type": "Offer",
				"name": "Unlimited",
				"price": "15",
				"priceCurrency": "USD",
				"description": "Unlimited syncs, scheduled auto-sync, 12-month history"
			}
		]
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
				"name": "How much does F→N cost?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Free: $0 for 5 syncs/month. Pro: $5/month for 100 syncs. Unlimited: $15/month for unlimited syncs plus auto-sync."
				}
			},
			{
				"@type": "Question",
				"name": "What is early adopter pricing?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Sign up now, keep current prices forever — even if we raise them later. Price locked to your account."
				}
			}
		]
	}
	</script>`}
</svelte:head>

<div class="min-h-screen flex flex-col">
	<Header showPricing={false} />

	<main class="flex-1 py-20">
		<div class="max-w-5xl mx-auto px-4">
			<div class="text-center mb-16">
				<h1 class="text-4xl font-bold mb-4 leading-tight">Pricing</h1>
				<p class="text-xl text-white/60 leading-relaxed">
					Current prices locked for early adopters.
				</p>
			</div>

			<div class="grid md:grid-cols-3 gap-8">
				{#each tiers as tier}
					<div
						class="rounded-md p-8 flex flex-col border {tier.highlighted ? 'border-white/30 ring-2 ring-white/10' : 'border-white/10'}"
					>
							<h2 class="text-2xl font-bold mb-2">{tier.name}</h2>
						<div class="mb-4">
							<span class="text-4xl font-bold">{tier.price}</span>
							<span class="text-white/60">{tier.period}</span>
						</div>
						<p class="text-white/60 mb-6 leading-relaxed">{tier.description}</p>

						<ul class="space-y-3 mb-8 flex-1">
							{#each tier.features as feature}
								<li class="flex items-start gap-2 leading-relaxed">
									<span class="text-green-500 mt-0.5 shrink-0"><Check size={16} /></span>
									<span>{feature}</span>
								</li>
							{/each}
						</ul>

						<a
							href={tier.href}
							class="block w-full py-3 rounded-md font-medium text-center transition-colors {tier.highlighted ? 'bg-white text-black hover:bg-white/90' : 'border border-white/10 hover:bg-white/5'}"
						>
							{tier.cta}
						</a>
					</div>
				{/each}
			</div>

			<!-- FAQ -->
			<div class="mt-20">
				<h2 class="text-2xl font-bold text-center mb-12">Questions</h2>
				<div class="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
					<div>
						<h3 class="font-semibold mb-2">What's a sync?</h3>
						<p class="text-white/60 leading-relaxed">
							One transcript → one sync. Ten transcripts = ten syncs.
						</p>
					</div>
					<div>
						<h3 class="font-semibold mb-2">Large backlogs?</h3>
						<p class="text-white/60 leading-relaxed">
							Tested with 900+ transcripts. Cloudflare Workers — no timeouts.
						</p>
					</div>
					<div>
						<h3 class="font-semibold mb-2">Price lock?</h3>
						<p class="text-white/60 leading-relaxed">
							Sign up now, keep this price forever — even if we raise it later.
						</p>
					</div>
					<div>
						<h3 class="font-semibold mb-2">Cancel?</h3>
						<p class="text-white/60 leading-relaxed">
							Anytime. No contracts. Dashboard → cancel → done.
						</p>
					</div>
				</div>
			</div>
		</div>
	</main>

	<Footer />
</div>
