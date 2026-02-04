<script lang="ts">
  import '../app.css';
  
  let { children } = $props();
</script>

<svelte:head>
  <meta name="theme-color" content="#000000" />
</svelte:head>

<!-- Grid background effect -->
<div class="bg-grid-fade" aria-hidden="true"></div>

{@render children()}

<style>
  .bg-grid-fade {
    position: fixed;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, black 30%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, black 30%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
</style>
