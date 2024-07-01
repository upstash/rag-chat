<script>
	import { useChat } from '@ai-sdk/svelte'
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';

	const { input, handleSubmit, messages } = useChat();
	const loading = writable(false);

	const handleAddData = async () => {
		loading.set(true);
		try {
			await fetch('/api/add-data', { method: 'POST' });
		} catch (error) {
			console.error('Error adding data:', error);
		} finally {
			loading.set(false);
		}
	};
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	<h1>useChat</h1>
	<ul>
		{#each $messages as message}
			<li>{message.role}: {message.content}</li>
		{/each}
	</ul>
	<form on:submit={handleSubmit}>
		<input bind:value={$input} />
		<button type="submit">Send</button>
	</form>
	<button
		class="add-data-button"
		on:click={handleAddData}
		disabled={$loading}
	>
		{#if $loading} Loading... {/if}
		{#if !$loading} Add some data about France {/if}
	</button>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	}

	h1 {
		width: 100%;
	}

	.add-data-button {
		background-color: blue;
		color: white;
		font-weight: bold;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		margin-top: 1rem;
		cursor: pointer;
	}

	.add-data-button[disabled] {
		background-color: gray;
		cursor: not-allowed;
	}
</style>