<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>F→N</title>
</svelte:head>

{@render children()}
