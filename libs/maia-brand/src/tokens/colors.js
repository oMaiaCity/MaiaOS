/**
 * Color tokens for Liquid Glass design system
 */

export const colors = {
	// Glass backgrounds
	glass: {
		bg: {
			default: 'rgba(255, 255, 255, 0.4)', // bg-white/40
			hover: 'rgba(255, 255, 255, 0.5)', // bg-white/50
			light: 'rgba(255, 255, 255, 0.6)', // bg-white/60
			strong: 'rgba(255, 255, 255, 0.8)', // bg-white/80
			subtle: 'rgba(255, 255, 255, 0.3)', // bg-white/30
			minimal: 'rgba(255, 255, 255, 0.05)', // bg-white/5
		},
		border: {
			default: 'rgba(255, 255, 255, 0.6)', // border-white/60
			hover: 'rgba(255, 255, 255, 0.8)', // border-white/80
			subtle: 'rgba(255, 255, 255, 0.5)', // border-white/50
			minimal: 'rgba(255, 255, 255, 0.1)', // border-white/10
		},
	},
	// Background gradients
	gradient: {
		background: {
			from: '#f8f9fa',
			via: '#f2f4f6',
			to: '#e9ecef',
		},
		accent: {
			from: '#eff6ff', // blue-50
			via: '#eef2ff', // indigo-50
			to: '#faf5ff', // purple-50
		},
	},
	// Decorative blobs
	blobs: {
		blue: 'rgba(191, 219, 254, 0.2)', // bg-blue-200/20
		purple: 'rgba(221, 214, 254, 0.2)', // bg-purple-200/20
		emerald: 'rgba(167, 243, 208, 0.2)', // bg-emerald-200/20
	},
	// Alert colors
	alert: {
		warning: {
			bg: 'rgba(254, 243, 199, 0.5)', // bg-yellow-50/50
			border: 'rgba(254, 240, 138, 1)', // border-yellow-100
			text: '#d97706', // text-yellow-600
		},
		error: {
			bg: 'rgba(254, 226, 226, 0.5)', // bg-red-50/50
			border: 'rgba(254, 202, 202, 1)', // border-red-100
			text: '#dc2626', // text-red-600
		},
	},
	// Text colors - using primary brand shades
	text: {
		primary: '#0042aa', // Primary 500 - primary text color
		secondary: '#2e64b9', // Primary 400 - secondary text
		tertiary: '#5c86c9', // Primary 300 - tertiary text
		muted: '#8aa8d8', // Primary 200 - muted text
		title: '#001a42', // Primary 800 - titles/headings
	},
	// Primary brand color
	brand: {
		primary: {
			50: '#e6ecf7',
			100: '#c4d4ed', // Button text/label color (lighter than 50, lighter than old 100)
			200: '#8aa8d8',
			300: '#5c86c9',
			400: '#2e64b9',
			500: '#0042aa', // Center color
			600: '#003486',
			700: '#002662', // Button hover
			800: '#001a42', // Buttons and navpill bg (slightly lighter)
			900: '#001225', // Title text (lighter than before)
			// Legacy/compatibility
			base: '#0042aa', // Same as 500
			light: '#2e64b9', // Same as 400
			dark: '#001225', // Same as 900
			glass: {
				bg: 'rgba(0, 26, 66, 0.15)', // primary-800/15
				bgHover: 'rgba(0, 26, 66, 0.25)', // primary-800/25
				border: 'rgba(0, 26, 66, 0.3)', // primary-800/30
				borderHover: 'rgba(0, 26, 66, 0.5)', // primary-800/50
			},
		},
		// Keep navy for backward compatibility, but map to primary
		navy: {
			50: '#e6ecf7',
			100: '#c4d4ed',
			200: '#8aa8d8',
			300: '#5c86c9',
			400: '#2e64b9',
			500: '#0042aa',
			600: '#003486',
			700: '#002662',
			800: '#001a42',
			900: '#001225',
			base: '#0042aa',
			light: '#2e64b9',
			dark: '#000a1a',
			glass: {
				bg: 'rgba(0, 26, 66, 0.15)',
				bgHover: 'rgba(0, 26, 66, 0.25)',
				border: 'rgba(0, 26, 66, 0.3)',
				borderHover: 'rgba(0, 26, 66, 0.5)',
			},
		},
		// Teal/Turquoise - Secondary Brand Color
		secondary: {
			50: '#e6f7f9',
			100: '#cceff3',
			200: '#99dfe7',
			300: '#66cfdb',
			400: '#45b8c8',
			500: '#2da6b4', // Center color
			600: '#258590',
			700: '#1c646c',
			800: '#134348',
			900: '#0a2224',
			950: '#051112',
			base: '#2da6b4', // Same as 500
			light: '#45b8c8', // Same as 400
			dark: '#0a2224', // Same as 900
		},
		// Yellow - Accent Brand Color
		accent: {
			50: '#fefce8',
			100: '#fef9c3',
			200: '#fef39e',
			300: '#fdee79',
			400: '#fde954',
			500: '#f4d03f', // Center color
			600: '#d4b035',
			700: '#b4902b',
			800: '#947022',
			900: '#745018',
			950: '#54380f',
			base: '#f4d03f', // Same as 500
			light: '#fde954', // Same as 400
			dark: '#745018', // Same as 900
		},
		// Success - Green Brand Color
		success: {
			50: '#ecfdf5',
			100: '#d1fae5',
			200: '#a7f3d0',
			300: '#6ee7b7',
			400: '#34d399',
			500: '#4ca984', // Center color
			600: '#059669',
			700: '#047857',
			800: '#065f46',
			900: '#064e3b',
			950: '#022c22',
			base: '#4ca984', // Same as 500
			light: '#34d399', // Same as 400
			dark: '#064e3b', // Same as 900
		},
		// Alert - Purple/Magenta Brand Color
		alert: {
			50: '#faf5f8',
			100: '#f5ebf1',
			200: '#ebd7e3',
			300: '#dbb8cd',
			400: '#c28ab1',
			500: '#a3376a', // Center color
			600: '#8d2d59',
			700: '#77264a',
			800: '#611f3b',
			900: '#4b182c',
			950: '#2d0c1a',
			base: '#a3376a', // Same as 500
			light: '#c28ab1', // Same as 400
			dark: '#4b182c', // Same as 900
		},
	},
}
