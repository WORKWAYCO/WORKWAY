<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
	<title>Terms of Service — F→N</title>
</svelte:head>

<div class="min-h-screen flex flex-col">
	<Header showPricing={false} />

	<main class="flex-1 py-20">
		<div class="max-w-3xl mx-auto px-4">
			<h1 class="text-4xl font-bold mb-4">Terms of Service</h1>
			<p class="text-white/40 mb-12">Last updated: December 2024</p>

			<div class="space-y-10 text-white/80 leading-relaxed">
				<section>
					<h2 class="text-2xl font-semibold mb-4">Agreement to terms</h2>
					<p>These Terms of Service govern your access to F→N, a service that syncs meeting transcripts from Fireflies.ai to Notion. By using the service, you agree to be bound by these terms.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Use of service</h2>

					<h3 class="text-lg font-medium mb-3 mt-6">Eligibility</h3>
					<p>You must be at least 18 years old with legal capacity to enter this agreement.</p>

					<h3 class="text-lg font-medium mb-3 mt-6">Account registration</h3>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Provide accurate, complete, current information</li>
						<li>Maintain account credential security</li>
						<li>Take responsibility for all account activities</li>
						<li>Notify immediately of unauthorized access</li>
					</ul>

					<h3 class="text-lg font-medium mb-3 mt-6">Third-party integrations</h3>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Maintain valid Fireflies.ai and Notion accounts</li>
						<li>Grant necessary data access permissions</li>
						<li>Comply with both platforms' terms of service</li>
					</ul>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Acceptable use</h2>
					<p class="mb-4">You agree not to:</p>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Use the service for illegal purposes</li>
						<li>Attempt unauthorized system access</li>
						<li>Interfere with service operations</li>
						<li>Reverse engineer or decompile the service</li>
						<li>Resell access without authorization</li>
					</ul>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Subscriptions and payments</h2>
					<ul class="list-disc list-inside space-y-2 ml-4">
						<li>Monthly billing through Stripe</li>
						<li>Early adopter pricing is locked for your account lifetime</li>
						<li>Cancel anytime; access continues through billing period end</li>
						<li>No refunds for partial months</li>
					</ul>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Data and content</h2>
					<p class="mb-4">You retain all rights to your transcripts and data. F→N receives a limited license to access, process, and transfer data solely for synchronization purposes.</p>
					<p>We won't sell or share your data with third parties except as described in our Privacy Policy.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Service availability</h2>
					<p>The service is provided "as is" and "as available" without guarantees of continuous availability or error-free operation. F→N is not responsible for API outages or changes from Fireflies.ai or Notion.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Limitation of liability</h2>
					<p>Maximum liability equals amounts paid in the preceding 12 months. We exclude indirect, consequential, or punitive damages.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Termination</h2>
					<p class="mb-4">You may cancel your subscription and delete your account anytime through your dashboard.</p>
					<p>We reserve the right to suspend or terminate accounts for term violations, fraudulent activity, or non-payment.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Changes to terms</h2>
					<p>We may modify these terms with notification. Continued use constitutes acceptance of the new terms.</p>
				</section>

				<section>
					<h2 class="text-2xl font-semibold mb-4">Contact</h2>
					<p>Questions? Email <a href="mailto:legal@workway.co" class="text-white hover:underline">legal@workway.co</a></p>
				</section>
			</div>
		</div>
	</main>

	<Footer />
</div>
