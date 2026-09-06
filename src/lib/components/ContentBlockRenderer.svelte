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
  .prose { line-height:1.8;overflow-wrap:anywhere; }
  .prose :global(h1) { font-size:1.65rem;line-height:1.4;letter-spacing:-.025em; }
  .prose :global(h2) { font-size:1.3rem;margin-top:1.5rem; }
  .prose :global(pre) { background:#15243c;color:#edf3ff;padding:1.25rem;border-radius:.75rem;line-height:1.7;white-space:pre; }
  .prose :global(pre code) { background:transparent;color:inherit;padding:0; }
  .prose :global(a) { color:var(--primary);text-underline-offset:3px; }
  .prose :global(a[target='_blank'])::after { content:' ↗'; }
  .prose :global(img) { max-width:100%;height:auto; }
  .prose :global(table) { display:block;overflow-x:auto;border-collapse:collapse; }
  .prose :global(th),.prose :global(td) { border:1px solid var(--border);padding:.5rem .75rem; }
  .prose :global(blockquote) { margin:1rem 0;padding:.5rem 1rem;border-left:3px solid var(--primary);background:var(--primary-soft); }
</style>
