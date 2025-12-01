import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ['./src/**/*.{js,ts,svelte}'],

  // Files to exclude
  exclude: [],

  // The output directory for your css system
  outdir: 'styled-system',

  globalCss: {
    'ul, ol': {
      listStyle: 'none',
      margin: 0,
      padding: 0,
    },
    a: {
      textDecoration: 'none',
      color: 'inherit',
      borderRadius: '9999px', // Fully rounded
    },
    button: {
      borderRadius: '9999px', // Fully rounded
    },
    // Global hover background color (highlight color)
    'a:hover, button:hover': {
      backgroundColor: '{colors.primary.50}',
    },
    // Global typography colors
    body: {
      color: '{colors.primary.400}',
    },
    'h1, h2, h3': {
      color: '{colors.primary.500}',
    },
    'h4, h5, h6, p, span': {
      color: '{colors.primary.400}',
    },
    // Global liquid glass border style - apply to elements with explicit border width
    '[class*="border-"]:not([class*="border-0"]):not([class*="border-none"])': {
      borderColor: '{colors.glass.border.default}',
    },
    // Apply to form elements and buttons with borders
    'button[class*="border"], input[class*="border"], textarea[class*="border"], select[class*="border"]': {
      borderColor: '{colors.glass.border.default}',
    },
  },

  theme: {
    extend: {
      tokens: {
        fonts: {
          sans: { value: 'Inter, system-ui, sans-serif' },
          title: { value: 'Shrikhand, cursive' },
        },
        radii: {
          xs: { value: '4px' },
          sm: { value: '8px' },
          md: { value: '12px' },
          lg: { value: '16px' },
          xl: { value: '20px' },
          '2xl': { value: '24px' },
          '3xl': { value: '32px' },
          '4xl': { value: '40px' },
          full: { value: '9999px' },
        },
        colors: {
          primary: {
            50: { value: '#ccdaed' },
            100: { value: '#b4c4db' },
            200: { value: '#8698b9' },
            300: { value: '#5c6f97' },
            400: { value: '#334876' },
            500: { value: '#002455' },
            600: { value: '#001e4e' },
            700: { value: '#001847' },
            800: { value: '#001240' },
            900: { value: '#000839' },
            950: { value: '#000236' },
          },
          secondary: {
            50: { value: '#eaf4f3' },
            100: { value: '#d5e8e6' },
            200: { value: '#abd1ce' },
            300: { value: '#81bbb7' },
            400: { value: '#52a49f' },
            500: { value: '#008E89' },
            600: { value: '#00726e' },
            700: { value: '#005854' },
            800: { value: '#003e3c' },
            900: { value: '#002725' },
            950: { value: '#001f1a' },
          },
          accent: {
            50: { value: '#faf8e7' },
            100: { value: '#f6f1d0' },
            200: { value: '#f3e0a1' },
            300: { value: '#f4cd73' },
            400: { value: '#f9b844' },
            500: { value: '#FF9F00' },
            600: { value: '#dd7716' },
            700: { value: '#b7521c' },
            800: { value: '#8d321a' },
            900: { value: '#621613' },
            950: { value: '#4d090d' },
          },
          success: {
            50: { value: '#f6faf2' },
            100: { value: '#ecf4e5' },
            200: { value: '#d9e9ca' },
            300: { value: '#c6deb1' },
            400: { value: '#b3d397' },
            500: { value: '#9FC87E' },
            600: { value: '#82aa64' },
            700: { value: '#668e4a' },
            800: { value: '#4b7231' },
            900: { value: '#305719' },
            950: { value: '#234a0d' },
          },
          warning: {
            50: { value: '#fcef9a' },
            100: { value: '#fae287' },
            200: { value: '#f8c663' },
            300: { value: '#f7a943' },
            400: { value: '#f6882b' },
            500: { value: '#F4631E' },
            600: { value: '#d34d1c' },
            700: { value: '#b33819' },
            800: { value: '#922514' },
            900: { value: '#72120d' },
            950: { value: '#630808' },
          },
          alert: {
            50: { value: '#fbac7d' },
            100: { value: '#f69e6e' },
            200: { value: '#ec8251' },
            300: { value: '#e26536' },
            400: { value: '#d7431d' },
            500: { value: '#CB0404' },
            600: { value: '#af000a' },
            700: { value: '#94000c' },
            800: { value: '#79000c' },
            900: { value: '#5e0007' },
            950: { value: '#510004' },
          },
          info: {
            50: { value: '#c1f4f4' },
            100: { value: '#b2eaea' },
            200: { value: '#94d5d5' },
            300: { value: '#76c0c0' },
            400: { value: '#56acac' },
            500: { value: '#309898' },
            600: { value: '#267c7c' },
            700: { value: '#1c6261' },
            800: { value: '#134947' },
            900: { value: '#0a312f' },
            950: { value: '#062524' },
          },
          slate: {
            50: { value: '#fefeff' },
            100: { value: '#fcfdfe' },
            200: { value: '#f8fafc' },
            300: { value: '#f4f7fa' },
            400: { value: '#f0f5f8' },
            500: { value: '#e8f0f5' },
            600: { value: '#e0e8ed' },
            700: { value: '#d8e0e5' },
            800: { value: '#d0d7dc' },
            900: { value: '#c8cfd4' },
            950: { value: '#c4cbd0' },
          },
        },
      },
      semanticTokens: {
        colors: {
          glass: {
            panel: {
              bg: { value: 'rgba(255, 255, 255, 0.4)' },
              border: { value: 'rgba(255, 255, 255, 0.6)' },
              shadow: { value: '0 8px 30px rgb(0, 0, 0, 0.04)' },
            },
            border: {
              default: { value: 'rgba(255, 255, 255, 0.6)' },
            },
          },
          bg: {
            canvas: { value: '{colors.slate.50}' },
            card: { value: '{colors.slate.100}' },
            surface: { value: '{colors.slate.200}' },
          }
        },
        radii: {
          main: { value: '{radii.xl}' },
          card: { value: '{radii.2xl}' },
          button: { value: '{radii.full}' }, // Or can switch to radii.md/lg for squircle-like
        }
      },
    },
  },
  utilities: {
    extend: {
      // Custom utilities if needed, e.g. for specific glass properties
      containerType: {
        className: 'container-type',
        values: ['normal', 'size', 'inline-size'],
        transform(value) {
          return { containerType: value }
        }
      },
      containerName: {
        className: 'container-name',
        values: ['main', 'sidebar', 'card'], // Add common names if needed
        transform(value) {
          return { containerName: value }
        }
      }
    }
  },
  patterns: {
    extend: {
      container: {
        description: 'Applies container query styles',
        properties: {
          name: { type: 'string' },
          type: { type: 'enum', value: ['normal', 'size', 'inline-size'] }
        },
        transform(props) {
          const { name, type = 'inline-size', ...rest } = props
          return {
            containerType: type,
            containerName: name,
            ...rest
          }
        }
      }
    }
  }
})
