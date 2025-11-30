/** @type {import('tailwindcss').Config} */
import { colors, shadows, blur } from './src/tokens/index.js';

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
			primary: {
				50: colors.brand.primary['50'],
				100: colors.brand.primary['100'],
				200: colors.brand.primary['200'],
				300: colors.brand.primary['300'],
				400: colors.brand.primary['400'],
				500: colors.brand.primary['500'],
				600: colors.brand.primary['600'],
				700: colors.brand.primary['700'],
				800: colors.brand.primary['800'],
				900: colors.brand.primary['900'],
			},
			secondary: {
				50: colors.brand.secondary['50'],
				100: colors.brand.secondary['100'],
				200: colors.brand.secondary['200'],
				300: colors.brand.secondary['300'],
				400: colors.brand.secondary['400'],
				500: colors.brand.secondary['500'],
				600: colors.brand.secondary['600'],
				700: colors.brand.secondary['700'],
				800: colors.brand.secondary['800'],
				900: colors.brand.secondary['900'],
				950: colors.brand.secondary['950'],
			},
			accent: {
				50: colors.brand.accent['50'],
				100: colors.brand.accent['100'],
				200: colors.brand.accent['200'],
				300: colors.brand.accent['300'],
				400: colors.brand.accent['400'],
				500: colors.brand.accent['500'],
				600: colors.brand.accent['600'],
				700: colors.brand.accent['700'],
				800: colors.brand.accent['800'],
				900: colors.brand.accent['900'],
				950: colors.brand.accent['950'],
			},
			success: {
				50: colors.brand.success['50'],
				100: colors.brand.success['100'],
				200: colors.brand.success['200'],
				300: colors.brand.success['300'],
				400: colors.brand.success['400'],
				500: colors.brand.success['500'],
				600: colors.brand.success['600'],
				700: colors.brand.success['700'],
				800: colors.brand.success['800'],
				900: colors.brand.success['900'],
				950: colors.brand.success['950'],
			},
			alert: {
				50: colors.brand.alert['50'],
				100: colors.brand.alert['100'],
				200: colors.brand.alert['200'],
				300: colors.brand.alert['300'],
				400: colors.brand.alert['400'],
				500: colors.brand.alert['500'],
				600: colors.brand.alert['600'],
				700: colors.brand.alert['700'],
				800: colors.brand.alert['800'],
				900: colors.brand.alert['900'],
				950: colors.brand.alert['950'],
			},
			// Text colors
			textColor: {
				title: colors.text.title, // Primary 900 for titles
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
			title: ['Shrikhand', 'cursive'],
		},
		},
	},
	plugins: [],
};

