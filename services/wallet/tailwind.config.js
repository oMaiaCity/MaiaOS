/** @type {import('tailwindcss').Config} */
import brandConfig from '@hominio/brand/tailwind.config.js';

export default {
	...brandConfig,
	content: [
		'./src/**/*.{html,js,svelte,ts}',
	],
};

