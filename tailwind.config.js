/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				paper: {
					50: '#FDFCFB',   // Lightest cream - modal backgrounds
					100: '#FAF8F5',  // Warm white - main paper surface
					200: '#F5F2ED',  // Soft parchment - secondary surfaces
					300: '#EDE8E0',  // Warm gray - borders, dividers
					400: '#DED6CA',  // Muted tan - disabled states
				},
				ink: {
					50: '#F7F6F5',
					100: '#E5E2DE',
					200: '#B8B2A8',
					300: '#8C857A',
					400: '#5E574D',
					500: '#3D372F',  // Default body text
					600: '#2A2520',  // Headlines
					700: '#1A1714',  // Maximum contrast
				},
				status: {
					gain: { light: '#E8F0E8', DEFAULT: '#4A6B4A', dark: '#2D422D' },
					loss: { light: '#F5EAEA', DEFAULT: '#8B5A5A', dark: '#5C3A3A' },
					warning: { light: '#F5F0E5', DEFAULT: '#8B7355', dark: '#5C4D3A' },
					info: { light: '#EAF0F5', DEFAULT: '#5A6B8B', dark: '#3A4A5C' },
				},
				accent: {
					50: '#F5F3F0',
					100: '#E8E4DE',
					200: '#D1C9BC',
					300: '#B5A894',
					400: '#9A8B72',
					500: '#7A6B52',
					600: '#5C503D',
					700: '#3D352A',
				},
			},
			fontFamily: {
				serif: ['Source Serif 4', 'Georgia', 'serif'],
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['JetBrains Mono', 'monospace'],
			},
			boxShadow: {
				'paper-sm': '0 1px 2px rgba(26, 23, 20, 0.04), 0 1px 3px rgba(26, 23, 20, 0.02)',
				'paper': '0 2px 4px rgba(26, 23, 20, 0.04), 0 4px 8px rgba(26, 23, 20, 0.02)',
				'paper-md': '0 4px 8px rgba(26, 23, 20, 0.04), 0 8px 16px rgba(26, 23, 20, 0.03)',
				'paper-lg': '0 8px 16px rgba(26, 23, 20, 0.05), 0 16px 32px rgba(26, 23, 20, 0.03)',
				'paper-lifted': '0 12px 24px rgba(26, 23, 20, 0.06), 0 24px 48px rgba(26, 23, 20, 0.04)',
				'paper-inset': 'inset 0 1px 2px rgba(26, 23, 20, 0.04)',
			},
			borderRadius: {
				'paper': '3px',
				'paper-lg': '6px',
			},
		},
	},
	plugins: []
};
