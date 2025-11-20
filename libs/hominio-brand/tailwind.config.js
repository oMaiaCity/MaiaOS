/** @type {import('tailwindcss').Config} */
import { colors, shadows, blur, spacing } from './src/tokens/index.js';

export default {
	content: [
		// Services will extend this with their own content paths
		'./src/**/*.{html,js,svelte,ts}',
	],
	theme: {
		extend: {
			colors: {
				glass: {
					bg: {
						default: colors.glass.bg.default,
						hover: colors.glass.bg.hover,
						light: colors.glass.bg.light,
						strong: colors.glass.bg.strong,
						subtle: colors.glass.bg.subtle,
						minimal: colors.glass.bg.minimal,
					},
					border: {
						default: colors.glass.border.default,
						hover: colors.glass.border.hover,
						subtle: colors.glass.border.subtle,
						minimal: colors.glass.border.minimal,
					},
				},
				gradient: {
					background: {
						from: colors.gradient.background.from,
						via: colors.gradient.background.via,
						to: colors.gradient.background.to,
					},
					accent: {
						from: colors.gradient.accent.from,
						via: colors.gradient.accent.via,
						to: colors.gradient.accent.to,
					},
				},
				blobs: {
					blue: colors.blobs.blue,
					purple: colors.blobs.purple,
					emerald: colors.blobs.emerald,
				},
				alert: {
					warning: {
						bg: colors.alert.warning.bg,
						border: colors.alert.warning.border,
						text: colors.alert.warning.text,
					},
					error: {
						bg: colors.alert.error.bg,
						border: colors.alert.error.border,
						text: colors.alert.error.text,
					},
				},
				brand: {
					navy: {
						base: colors.brand.navy.base,
						light: colors.brand.navy.light,
						dark: colors.brand.navy.dark,
						glass: {
							bg: colors.brand.navy.glass.bg,
							bgHover: colors.brand.navy.glass.bgHover,
							border: colors.brand.navy.glass.border,
							borderHover: colors.brand.navy.glass.borderHover,
						},
					},
				},
			},
			boxShadow: {
				'glass': shadows.glass.default,
				'glass-hover': shadows.glass.hover,
				'glass-lifted': shadows.glass.lifted,
				'glass-subtle': shadows.glass.subtle,
			},
			backdropBlur: {
				'glass-xl': blur.glass.xl,
				'glass-md': blur.glass.md,
				'glass-sm': blur.glass.sm,
			},
			blur: {
				'3xl': blur.decorative['3xl'],
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
			},
		},
	},
	plugins: [],
};

