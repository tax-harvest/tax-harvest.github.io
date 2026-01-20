import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			// GitHub Pages serves from root, fallback for SPA client-side routing
			fallback: '404.html'
		}),
		paths: {
			// Empty base path since we're using a custom domain (tax-harvest.github.io)
			base: ''
		}
	}
};

export default config;
