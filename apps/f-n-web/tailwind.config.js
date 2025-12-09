/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Pure minimalism: black, white, grey
				black: '#000000',
				white: '#FFFFFF',
				grey: {
					100: '#171717',
					200: '#262626',
					300: '#404040',
					400: '#525252',
					500: '#737373',
					600: '#A3A3A3',
					700: '#D4D4D4',
					800: '#E5E5E5',
					900: '#F5F5F5'
				}
			},
			fontFamily: {
				sans: [
					'Stack Sans Notch',
					'system-ui',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'sans-serif'
				],
				mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Inconsolata', 'monospace']
			}
		}
	},
	plugins: []
};
