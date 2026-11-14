<script lang="ts">
	import type { Snippet } from 'svelte';
	// Served with the app (not Google Fonts): no extra connections before text shows.
	import '@fontsource/russo-one/latin.css';
	import './app.css';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
