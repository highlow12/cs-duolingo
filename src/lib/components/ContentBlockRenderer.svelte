<script lang="ts">
	import type { ContentBlock } from '$lib/content/types';

	let { block } = $props<{ block: ContentBlock }>();
</script>

{#if block.type === 'text'}
	<p>{block.text}</p>
{:else if block.type === 'markdown'}
	{#if block.html}<div class="prose">{@html block.html}</div>{:else}<div class="plain-text">{block.markdown}</div>{/if}
{:else if block.type === 'code'}
	<pre class="code"><code class={`language-${block.language}`}>{block.code}</code></pre>
{:else if block.type === 'image'}
	<figure>
		<img src={block.src} alt={block.alt} />
		<figcaption>{block.alt}</figcaption>
	</figure>
{:else if block.type === 'diagram'}
	<div class="diagram" role="img" aria-label={block.alt}>
		<strong>{block.diagramType}</strong>
		<pre>{JSON.stringify(block.data, null, 2)}</pre>
	</div>
{/if}

<style>
	p {
		line-height: 1.7;
	}

	.plain-text,
	.code,
	.diagram pre {
		margin: var(--space-4) 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-muted);
		padding: var(--space-4);
		white-space: pre-wrap;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		line-height: 1.6;
	}

	figure {
		margin: 1rem 0;
	}

	img {
		max-width: 100%;
	}

	figcaption {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.diagram {
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--primary-soft) 38%, var(--surface));
		padding: var(--space-4);
	}
  .prose { line-height:1.8;overflow-wrap:anywhere; }
  .prose :global(h1) { font-size:1.6rem;line-height:1.4;letter-spacing:-.025em; }
  .prose :global(h2) { font-size:1.25rem;margin-top:1.75rem; }
  .prose :global(pre) { border:1px solid color-mix(in srgb,var(--primary) 35%,var(--border)); background:var(--code-bg);color:var(--code-text);padding:1.25rem;border-radius:var(--radius-md);line-height:1.7;white-space:pre; }
  .prose :global(pre code) { background:transparent;color:inherit;padding:0; }
  .prose :global(a) { color:var(--primary);text-underline-offset:3px; }
  .prose :global(img) { max-width:100%;height:auto; }
  .prose :global(table) { display:block;overflow-x:auto;border-collapse:collapse; }
  .prose :global(th),.prose :global(td) { border:1px solid var(--border);padding:.5rem .75rem; }
  .prose :global(blockquote) { margin:1rem 0;padding:.65rem 1rem;border-left:3px solid var(--primary);background:var(--primary-soft); }
</style>
