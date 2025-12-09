<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
	<title>Privacy Policy — F→N</title>
</svelte:head>

<div class="min-h-screen flex flex-col">
	<Header showPricing={false} />

	<main class="flex-1 py-20">
		<div class="max-w-3xl mx-auto px-4">
			<h1 class="text-4xl font-bold mb-4">Privacy Policy</h1>
			<p class="text-white/40 mb-12">Last updated: December 2024</p>

			<div class="space-y-10 text-white/80 leading-relaxed">
				<section>
					<h2 class="text-2xl font-semibold mb-4">Introduction</h2>
					<p>F→N is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service that synchronizes meeting transcripts from Fireflies.ai to Notion.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Information we collect</h2>

					<h3 class="text-lg font-medium mb-3 mt-6">Information you provide</h3>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Account information (email address)</li>
						<li>OAuth authentication tokens for Fireflies.ai and Notion</li>
						<li>Payment information (processed securely through Stripe)</li>
						<li>Sync preferences and configuration settings</li>
					</ul>

					<h3 class="text-lg font-medium mb-3 mt-6">Information automatically collected</h3>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Meeting transcripts and metadata from Fireflies.ai (during sync only)</li>
						<li>Notion workspace and database information</li>
						<li>Usage data and sync history</li>
					</ul>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">How we use your information</h2>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Provide, operate, and maintain the synchronization service</li>
						<li>Process transactions and manage subscriptions</li>
						<li>Transfer meeting transcripts from Fireflies.ai to Notion workspaces</li>
						<li>Send technical notices, updates, and support messages</li>
						<li>Monitor usage patterns and detect technical issues</li>
					</ul>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Third-party services</h2>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li><strong>Fireflies.ai</strong> — Accesses and retrieves meeting transcripts</li>
						<li><strong>Notion</strong> — Creates and updates database entries</li>
						<li><strong>Stripe</strong> — Processes payments and manages subscriptions</li>
						<li><strong>Cloudflare</strong> — Provides hosting, database, and security services</li>
					</ul>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Data security</h2>
					<p class="mb-4">We implement security measures including:</p>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Encryption of data in transit and at rest</li>
						<li>Secure OAuth 2.0 authentication</li>
						<li>Access controls and authentication requirements</li>
					</ul>
					<p class="mt-4 text-white/40">No method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Data retention</h2>
					<p>Personal information is retained as long as necessary for service provision. Upon account deletion, data is removed within 30 days, except where legally required.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Your rights</h2>
					<p class="mb-4">You may request:</p>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Access to your personal information</li>
						<li>Correction of inaccurate data</li>
						<li>Deletion of your personal information</li>
						<li>Data portability</li>
					</ul>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Contact</h2>
					<p>Questions about privacy? Email <a href="mailto:privacy@workway.co" class="text-white hover:underline">privacy@workway.co</a></p>
				</section>
			</div>
		</div>
	</main>

	<Footer />
</div>
