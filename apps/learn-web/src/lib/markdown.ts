/**
 * Markdown Renderer with Syntax Highlighting
 *
 * Uses marked for markdown parsing and shiki for syntax highlighting.
 * Follows the WORKWAY design system with pure black canvas.
 */

import { marked } from 'marked';
import { codeToHtml, type BundledLanguage } from 'shiki';

// Languages commonly used in WORKWAY documentation
const SUPPORTED_LANGUAGES: Record<string, BundledLanguage> = {
	typescript: 'typescript',
	ts: 'typescript',
	javascript: 'javascript',
	js: 'javascript',
	bash: 'bash',
	sh: 'bash',
	shell: 'bash',
	json: 'json',
	yaml: 'yaml',
	yml: 'yaml',
	css: 'css',
	html: 'html',
	markdown: 'markdown',
	md: 'markdown',
	sql: 'sql',
	python: 'python',
	py: 'python'
};

/**
 * Highlight a code block using shiki
 */
async function highlightCode(code: string, lang: string): Promise<string> {
	const language = SUPPORTED_LANGUAGES[lang.toLowerCase()] || 'typescript';

	try {
		const html = await codeToHtml(code, {
			lang: language,
			theme: 'github-dark',
			transformers: [
				{
					pre(node) {
						// Add custom styling classes
						node.properties.class = 'shiki-code-block';
						node.properties.style =
							'background-color: var(--color-bg-pure); border: 1px solid var(--color-border-default); border-radius: var(--radius-md); padding: var(--space-md); overflow-x: auto; margin: var(--space-md) 0;';
					},
					code(node) {
						node.properties.style =
							'font-family: var(--font-mono); font-size: var(--text-sm); line-height: 1.6;';
					}
				}
			]
		});
		return html;
	} catch {
		// Fallback to plain code block if highlighting fails
		return `<pre class="shiki-code-block" style="background-color: var(--color-bg-pure); border: 1px solid var(--color-border-default); border-radius: var(--radius-md); padding: var(--space-md); overflow-x: auto; margin: var(--space-md) 0;"><code style="font-family: var(--font-mono); font-size: var(--text-sm); line-height: 1.6;">${escapeHtml(code)}</code></pre>`;
	}
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Render markdown to HTML with syntax highlighting
 */
export async function renderMarkdown(markdown: string): Promise<string> {
	// Collect all code blocks for highlighting
	const codeBlocks: Array<{ placeholder: string; code: string; lang: string }> = [];
	let blockIndex = 0;

	// Replace code blocks with placeholders
	const markdownWithPlaceholders = markdown.replace(
		/```(\w+)?\n([\s\S]*?)```/g,
		(_, lang, code) => {
			const placeholder = `__CODE_BLOCK_${blockIndex}__`;
			codeBlocks.push({ placeholder, code: code.trim(), lang: lang || 'typescript' });
			blockIndex++;
			return placeholder;
		}
	);

	// Configure marked with custom renderer for headings with IDs
	const renderer = new marked.Renderer();

	renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
		// Generate slug from heading text
		const slug = text
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^\w-]/g, '');
		return `<h${depth} id="${slug}">${text}</h${depth}>`;
	};

	marked.setOptions({
		gfm: true,
		breaks: false
	});

	marked.use({ renderer });

	// Parse markdown to HTML (synchronous)
	let html = await marked.parse(markdownWithPlaceholders);

	// Highlight code blocks and replace placeholders
	for (const block of codeBlocks) {
		const highlightedCode = await highlightCode(block.code, block.lang);
		html = html.replace(`<p>${block.placeholder}</p>`, highlightedCode);
		html = html.replace(block.placeholder, highlightedCode);
	}

	// Style inline code
	html = html.replace(
		/<code>([^<]+)<\/code>/g,
		'<code style="font-family: var(--font-mono); font-size: 0.9em; background-color: var(--color-bg-surface); padding: 0.2em 0.4em; border-radius: var(--radius-sm); border: 1px solid var(--color-border-default);">$1</code>'
	);

	return html;
}

/**
 * Pre-render markdown at build time for faster page loads
 * This is used in the page load function
 */
export { renderMarkdown as preRenderMarkdown };
