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
    },
    // Global typography colors
    body: {
      color: '{colors.primary.500}',
    },
    'h1, h2, h3': {
      color: '{colors.primary.700}',
    },
    'h4, h5, h6, p, span, div': {
      color: '{colors.primary.500}',
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
            50: { value: '#768bb6' },
            100: { value: '#6b7faa' },
            200: { value: '#546992' },
            300: { value: '#3d537a' },
            400: { value: '#263f64' },
            500: { value: '#0C2B4E' },
            600: { value: '#002446' },
            700: { value: '#001d3e' },
            800: { value: '#001636' },
            900: { value: '#000d2f' },
            950: { value: '#00072b' },
          },
          secondary: {
            50: { value: '#cefafa' },
            100: { value: '#c2f4f5' },
            200: { value: '#a9eaeb' },
            300: { value: '#8fdfe2' },
            400: { value: '#73d5d8' },
            500: { value: '#51CACF' },
            600: { value: '#41b1b7' },
            700: { value: '#32999e' },
            800: { value: '#238187' },
            900: { value: '#126a70' },
            950: { value: '#095f65' },
          },
          success: {
            50: { value: '#f8f9e6' },
            100: { value: '#f1f2d9' },
            200: { value: '#e1e6c0' },
            300: { value: '#d0dba7' },
            400: { value: '#becf8f' },
            500: { value: '#AAC478' },
            600: { value: '#92ab61' },
            700: { value: '#7a934b' },
            800: { value: '#637c35' },
            900: { value: '#4c6620' },
            950: { value: '#415b14' },
          },
          warning: {
            50: { value: '#faf7c7' },
            100: { value: '#f6efbb' },
            200: { value: '#eedfa1' },
            300: { value: '#e8cf89' },
            400: { value: '#e3be71' },
            500: { value: '#DEAC5B' },
            600: { value: '#c39448' },
            700: { value: '#a97d36' },
            800: { value: '#906724' },
            900: { value: '#775112' },
            950: { value: '#6a4708' },
          },
          alert: {
            50: { value: '#f9e7d2' },
            100: { value: '#f3dbc3' },
            200: { value: '#e8c3a7' },
            300: { value: '#deaa8f' },
            400: { value: '#d4917a' },
            500: { value: '#C97769' },
            600: { value: '#af6053' },
            700: { value: '#954a3e' },
            800: { value: '#7c342b' },
            900: { value: '#631f18' },
            950: { value: '#57130f' },
          },
          info: {
            50: { value: '#f2fbfb' },
            100: { value: '#e5f6f6' },
            200: { value: '#cceeec' },
            300: { value: '#b2e5e0' },
            400: { value: '#98dcd4' },
            500: { value: '#7DD3C6' },
            600: { value: '#66baad' },
            700: { value: '#50a195' },
            800: { value: '#39897e' },
            900: { value: '#217268' },
            950: { value: '#13675d' },
          },
          light: {
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
          dark: {
            50: { value: '#767676' },
            100: { value: '#6b6b6b' },
            200: { value: '#555555' },
            300: { value: '#404040' },
            400: { value: '#2d2d2d' },
            500: { value: '#1A1A1A' },
            600: { value: '#161616' },
            700: { value: '#121212' },
            800: { value: '#0d0d0d' },
            900: { value: '#070707' },
            950: { value: '#030303' },
          },
          accent: {
            50: { value: '#fdfbb3' },
            100: { value: '#fbf6a7' },
            200: { value: '#f8ed8e' },
            300: { value: '#f6e475' },
            400: { value: '#f5da5b' },
            500: { value: '#F4D03F' },
            600: { value: '#d8b732' },
            700: { value: '#bd9f26' },
            800: { value: '#a38819' },
            900: { value: '#89710c' },
            950: { value: '#7c6605' },
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
            canvas: { value: '{colors.light.50}' },
            card: { value: '{colors.light.100}' },
            surface: { value: '{colors.light.200}' },
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
