/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
				mono: ['var(--font-mono)', 'monospace']
			},
			typography: {
				DEFAULT: {
					css: {
						'--tw-prose-body': 'var(--color-fg-primary)',
						'--tw-prose-headings': 'var(--color-fg-primary)',
						'--tw-prose-links': 'var(--color-info)',
						'--tw-prose-bold': 'var(--color-fg-primary)',
						'--tw-prose-code': 'var(--color-fg-primary)',
						'--tw-prose-pre-bg': 'var(--color-bg-surface)',
						'--tw-prose-pre-code': 'var(--color-fg-primary)',
						'--tw-prose-quotes': 'var(--color-fg-muted)',
						'--tw-prose-hr': 'var(--color-border-default)',
						maxWidth: 'none',
						code: {
							backgroundColor: 'var(--color-bg-surface)',
							padding: '0.25rem 0.5rem',
							borderRadius: 'var(--radius-sm)',
							fontWeight: '400'
						},
						'code::before': {
							content: '""'
						},
						'code::after': {
							content: '""'
						},
						pre: {
							backgroundColor: 'var(--color-bg-surface)',
							border: '1px solid var(--color-border-default)',
							borderRadius: 'var(--radius-md)'
						}
					}
				}
			}
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
