<!--
  Alert Component

  Reusable alert component with semantic design tokens.
  Replaces hardcoded bg-{color}-500/10 patterns across F→N.

  Usage:
    <Alert type="success">Notion connected successfully</Alert>
    <Alert type="error">Invalid credentials</Alert>
    <Alert type="info">Before you start, you'll need...</Alert>

  Zuhandenheit: The mechanism recedes. Alerts just work.
-->
<script lang="ts">
	import { Check, AlertCircle, Info } from 'lucide-svelte';

	interface Props {
		type?: 'success' | 'error' | 'info';
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { type = 'info', class: className = '', children }: Props = $props();

	const config = {
		success: {
			icon: Check,
			bg: 'var(--color-success-background)',
			text: 'var(--color-success)',
			border: 'var(--color-success-border)'
		},
		error: {
			icon: AlertCircle,
			bg: 'var(--color-error-background)',
			text: 'var(--color-error)',
			border: 'var(--color-error-border)'
		},
		info: {
			icon: Info,
			bg: 'var(--color-info-background)',
			text: 'var(--color-info)',
			border: 'var(--color-info-border)'
		}
	};

	const alertConfig = $derived(config[type]);
	const Icon = $derived(alertConfig.icon);
</script>

<div
	class="p-4 rounded-[var(--brand-radius)] text-sm flex items-center gap-2 {className}"
	style:background-color={alertConfig.bg}
	style:border="1px solid {alertConfig.border}"
	style:color={alertConfig.text}
>
	<Icon size={16} />
	{@render children?.()}
</div>
