<script lang="ts">
	import type { ContentBlock } from '$lib/content/types';

	let { block } = $props<{ block: ContentBlock }>();
</script>

{#if block.type === 'text'}
	<p>{block.text}</p>
{:else if block.type === 'markdown'}
	<pre class="markdown">{block.markdown}</pre>
{:else if block.type === 'code'}
	<pre class="code"><code class={`language-${block.language}`}>{block.code}</code></pre>
{:else if block.type === 'image'}
	<figure>
		<img src={block.src} alt={block.alt} />
		<figcaption>{block.alt}</figcaption>
	</figure>
{:else if block.type === 'diagram'}
	<div class="diagram" role="img" aria-label={`${block.diagramType} diagram`}>
		<strong>{block.diagramType}</strong>
		<pre>{JSON.stringify(block.data, null, 2)}</pre>
	</div>
{/if}

<style>
	p {
		line-height: 1.7;
	}

	.markdown,
	.code,
	.diagram pre {
		margin: 0.75rem 0;
		border-radius: 0.7rem;
		background: #f1f5fb;
		padding: 1rem;
		white-space: pre-wrap;
		font-family: "SFMono-Regular", Consolas, monospace;
		line-height: 1.6;
	}

	figure {
		margin: 1rem 0;
	}

	img {
		max-width: 100%;
	}

	figcaption {
		color: #60708a;
		font-size: 0.9rem;
	}

	.diagram {
		border: 1px dashed #a9b8cf;
		border-radius: 0.7rem;
		padding: 1rem;
	}
</style>
