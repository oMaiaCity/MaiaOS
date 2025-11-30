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
            50: { value: '#d0d8ec' },
            100: { value: '#b9c2d8' },
            200: { value: '#8d97b3' },
            300: { value: '#636d8f' },
            400: { value: '#3b476c' },
            500: { value: '#12234a' },
            600: { value: '#091d43' },
            700: { value: '#01173d' },
            800: { value: '#001136' },
            900: { value: '#000730' },
            950: { value: '#00022d' },
          },
          secondary: {
            50: { value: '#effafa' },
            100: { value: '#e0f4f4' },
            200: { value: '#bfe9ea' },
            300: { value: '#9ddedf' },
            400: { value: '#77d3d4' },
            500: { value: '#47C8CA' },
            600: { value: '#37a1a2' },
            700: { value: '#297c7d' },
            800: { value: '#1a5959' },
            900: { value: '#0d3838' },
            950: { value: '#072929' },
          },
          success: {
            50: { value: '#bef3b2' },
            100: { value: '#b1e8a5' },
            200: { value: '#98d18d' },
            300: { value: '#80bb76' },
            400: { value: '#68a55f' },
            500: { value: '#508F49' },
            600: { value: '#3e783b' },
            700: { value: '#2c612d' },
            800: { value: '#1b4c1f' },
            900: { value: '#0b3712' },
            950: { value: '#042d0b' },
          },
          warning: {
            50: { value: '#faf393' },
            100: { value: '#f5e785' },
            200: { value: '#ebcf6b' },
            300: { value: '#e2b753' },
            400: { value: '#d79e3d' },
            500: { value: '#CD8629' },
            600: { value: '#b56e22' },
            700: { value: '#9c571b' },
            800: { value: '#824213' },
            900: { value: '#682d0c' },
            950: { value: '#5c2407' },
          },
          alert: {
            50: { value: '#fabc95' },
            100: { value: '#f4b088' },
            200: { value: '#e99970' },
            300: { value: '#de8059' },
            400: { value: '#d26844' },
            500: { value: '#c64d32' },
            600: { value: '#ab3c2a' },
            700: { value: '#912d21' },
            800: { value: '#771d19' },
            900: { value: '#5e0e10' },
            950: { value: '#520609' },
          },
          info: {
            50: { value: '#bef4f3' },
            100: { value: '#b1e8e8' },
            200: { value: '#98d2d1' },
            300: { value: '#80bcbb' },
            400: { value: '#67a7a5' },
            500: { value: '#4F928F' },
            600: { value: '#3e7b78' },
            700: { value: '#2d6462' },
            800: { value: '#1d4e4c' },
            900: { value: '#0d3938' },
            950: { value: '#052f2e' },
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
          accent: {
            50: { value: '#fffaef' },
            100: { value: '#fff5de' },
            200: { value: '#fdebbe' },
            300: { value: '#f9e19e' },
            400: { value: '#f4d77d' },
            500: { value: '#eece5b' },
            600: { value: '#c9a548' },
            700: { value: '#a37f36' },
            800: { value: '#7d5b25' },
            900: { value: '#573a15' },
            950: { value: '#442b0d' },
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
