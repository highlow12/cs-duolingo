import { describe, expect, it } from 'vitest';
import { compileMarkdown } from '../../scripts/content/markdown';
describe('compiled Markdown boundary', () => {
  it('renders Korean headings and escaped code at build time', () => {
    const html=compileMarkdown('# 변수\n\n```python\nprint("<b>")\n```');
    expect(html).toContain('<h1>변수</h1>');expect(html).toContain('&lt;b&gt;');
  });
  it('removes executable HTML, unsafe links and external images', () => {
    const html=compileMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert)\n\n![remote](https://other.test/x.png)\n\n<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('<script');expect(html).not.toContain('javascript:');expect(html).not.toContain('onerror');expect(html).not.toContain('<img');
  });
  it('preserves local images and labels external links', () => {
    const html=compileMarkdown('![배열](/generated/assets/array.png)\n\n[설명](https://example.com)');
    expect(html).toContain('src="/generated/assets/array.png"');expect(html).toContain('noopener noreferrer');
  });
});
