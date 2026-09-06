import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/** Only the content builder parses Markdown; no parser ships in the application. */
export function compileMarkdown(markdown: string): string {
  return sanitizeHtml(marked.parse(markdown, { async: false }) as string, {
    allowedTags: ['p','br','strong','em','del','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','pre','code','hr','a','img','table','thead','tbody','tr','th','td'],
    allowedAttributes: { a:['href','title','rel','target','aria-label'], img:['src','alt','title'], code:['class'], ol:['start'] },
    allowedSchemes: ['http','https','mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => ({tagName:'a',attribs: /^https?:/i.test(attrs.href ?? '') ? {...attrs, target:'_blank',rel:'noopener noreferrer', 'aria-label':`${attrs.title ?? '외부 링크'} (새 탭)`} : attrs})
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src?.startsWith('/generated/assets/'),
  });
}
