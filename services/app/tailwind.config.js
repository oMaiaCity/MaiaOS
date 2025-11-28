/** @type {import('tailwindcss').Config} */
import brandConfig from '@hominio/brand/tailwind.config.js';

export default {
	...brandConfig,
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./src-tauri/**/*.{html,js,svelte,ts}',
		'../../libs/hominio-brand/src/**/*.{html,js,svelte,ts}'
	],
};

