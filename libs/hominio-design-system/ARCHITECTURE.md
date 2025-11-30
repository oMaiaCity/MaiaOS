# Hominio Design System Architecture

This document outlines the architecture, principles, and best practices for the Hominio Design System.

## Table of Contents

1. [Overview](#overview)
2. [Atomic Design Principles](#atomic-design-principles)
3. [Panda CSS Integration](#panda-css-integration)
4. [Design Tokens](#design-tokens)
5. [Component Structure](#component-structure)
6. [Best Practices](#best-practices)
7. [Development Workflow](#development-workflow)

## Overview

The Hominio Design System is built using:
- **SvelteKit** - Component framework and routing
- **Panda CSS** - Type-safe, atomic CSS-in-JS styling system
- **Atomic Design** - Component organization methodology
- **Design Tokens** - Centralized design values

The system follows a **single source of truth** philosophy, where design decisions are made once and propagated consistently across all components.

## Atomic Design Principles

Our design system follows **Atomic Design** methodology, organizing components into a hierarchy:

### Atoms
**Smallest, indivisible components** that cannot be broken down further.

**Location:** `src/lib/components/atoms/`

**Examples:**
- `Label` - Text labels for descriptions and metadata
- `CallButton` - Primary call action button
- `Card` - Generic content container
- `GlassIconButton` - Icon button with glassmorphism styling
- `ProfileAvatar` - User avatar with initials
- `PreviewBackground` - Reusable preview background pattern

**Characteristics:**
- Single responsibility
- Highly reusable
- No dependencies on other components
- Accept props for customization
- Inherit global styles (typography, colors)

### Molecules
**Simple combinations of atoms** that form basic UI elements.

**Location:** `src/lib/components/molecules/`

**Examples:** (To be added as system grows)
- Form fields (Label + Input)
- Search bar (Input + Button)
- Navigation items (Icon + Label)

**Characteristics:**
- Composed of multiple atoms
- Still relatively simple
- Reusable across contexts

### Organisms
**Complex UI components** composed of atoms and molecules.

**Location:** `src/lib/components/organisms/`

**Examples:**
- `NavPill` - Main navigation component (combines CallButton, GlassIconButton, ProfileAvatar)

**Characteristics:**
- Complex, feature-rich components
- Composed of atoms/molecules
- May have internal state
- Context-specific but reusable

### Templates & Pages
**Full page layouts** and compositions (handled by SvelteKit routes).

**Location:** `src/routes/`

## Panda CSS Integration

### Configuration

**File:** `panda.config.mjs`

Panda CSS is configured with:
- **Preflight:** Enabled (CSS reset)
- **Include:** `['./src/**/*.{js,ts,svelte}']` - Scans all source files
- **Outdir:** `styled-system` - Generated CSS system output

### Usage in Components

#### Basic Styling
```svelte
<script>
    import { css } from 'styled-system/css';

    const buttonStyle = css({
        bg: 'primary.500',
        color: 'white',
        px: '4',
        py: '2',
        rounded: 'md'
    });
</script>

<button class={buttonStyle}>Click me</button>
```

#### Using Tokens
```svelte
<script>
    import { css } from 'styled-system/css';
    import { token } from 'styled-system/tokens';

    // Access token values programmatically
    const primaryColor = token('colors.primary.500');
</script>
```

#### Conditional Styles
```svelte
<script>
    import { css, cx } from 'styled-system/css';

    export let variant = 'primary';

    const baseStyle = css({
        px: '4',
        py: '2',
        rounded: 'md'
    });

    const variantStyle = css({
        bg: variant === 'primary' ? 'primary.500' : 'secondary.500'
    });
</script>

<button class={cx(baseStyle, variantStyle)}>Button</button>
```

### Global Styles

**File:** `panda.config.mjs` → `globalCss`

Global styles are defined in the Panda config and apply automatically:

```javascript
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
    body: {
        color: '{colors.primary.500}', // Global text color
    },
    'h1, h2, h3': {
        color: '{colors.primary.700}', // Heading colors
    },
    'h4, h5, h6, p, span, div': {
        color: '{colors.primary.500}', // Body text colors
    },
}
```

**Key Principle:** Components inherit global typography colors by default. Only override when necessary.

### CSS Layers

**File:** `src/app.css`

Panda CSS uses a layered approach:

```css
@layer reset, base, tokens, recipes, utilities;
```

- **reset:** CSS reset (preflight)
- **base:** Base element styles
- **tokens:** Design token values
- **recipes:** Component recipes
- **utilities:** Utility classes

## Design Tokens

### Color System

**Location:** `panda.config.mjs` → `theme.extend.tokens.colors`

Colors are organized into semantic palettes:

- **Primary** - Main brand color
- **Secondary** - Secondary brand color
- **Success** - Success states
- **Warning** - Warning states
- **Alert** - Error/danger states
- **Info** - Informational states
- **Accent** - Accent color (yellow)
- **Light** - Light backgrounds and UI elements
- **Dark** - Dark text and elements

**Color Scale Generation:**
Colors are generated programmatically using `chroma-js` via `gen-colors.js`:
- Base color at 500 level
- Automatic generation of 50-900 scale
- Light and dark variants

**Usage:**
```svelte
// Direct token reference
const style = css({
    bg: 'primary.500',
    color: 'primary.700'
});

// Semantic tokens
const glassStyle = css({
    bg: 'glass.panel.bg',
    borderColor: 'glass.border.default'
});
```

### Typography

**Location:** `panda.config.mjs` → `theme.extend.tokens.fonts`

**Font Families:**
- `sans` - Inter, system-ui, sans-serif (body text)
- `title` - Shrikhand, cursive (headings)

**Global Typography Colors:**
- `body` → `primary.500`
- `h1, h2, h3` → `primary.700`
- `h4-h6, p, span, div` → `primary.500`

**Principle:** Typography colors are inherited globally. Components should not override unless necessary.

### Radii (Border Radius)

**Location:** `panda.config.mjs` → `theme.extend.tokens.radii`

**Available Radii:**
- `xs` - 4px
- `sm` - 8px
- `md` - 12px
- `lg` - 16px
- `xl` - 20px
- `2xl` - 24px
- `3xl` - 32px
- `4xl` - 40px
- `full` - 9999px (fully rounded)
- `main` - xl (20px) - Main UI elements
- `card` - 2xl (24px) - Cards
- `button` - full - Buttons

### Semantic Tokens

**Location:** `panda.config.mjs` → `semanticTokens`

Semantic tokens provide abstract, context-aware values:

```javascript
semanticTokens: {
    colors: {
        glass: {
            'panel.bg': 'rgba(255, 255, 255, 0.1)',
            'panel.border': 'rgba(255, 255, 255, 0.2)',
            'border.default': 'rgba(255, 255, 255, 0.6)'
        },
        bg: {
            canvas: '{colors.light.50}',
            card: '{colors.light.100}',
            surface: '{colors.light.200}'
        }
    }
}
```

**Benefits:**
- Abstract away implementation details
- Easy theme switching
- Consistent naming across components

## Component Structure

### File Organization

```
src/
├── lib/
│   ├── components/
│   │   ├── atoms/          # Atomic components
│   │   ├── molecules/      # Molecule components
│   │   └── organisms/      # Organism components
│   └── styles/
│       └── fonts.css       # Font imports
├── routes/
│   ├── atoms/              # Atom demo pages
│   ├── components/         # Component demo pages
│   └── tokens/             # Token documentation pages
└── app.css                 # Panda CSS layers
```

### Component Template

```svelte
<script>
    import { css } from 'styled-system/css';

    // Props with defaults
    export let variant = 'default';
    export let size = 'md';

    // Styles using Panda CSS
    const componentStyle = css({
        // Use design tokens
        bg: 'primary.500',
        color: 'white',
        rounded: 'button',
        px: '4',
        py: '2',
        // Conditional styles
        ...(variant === 'outline' && {
            bg: 'transparent',
            borderWidth: '1px',
            borderColor: 'primary.500'
        })
    });
</script>

<div class={componentStyle}>
    <slot />
</div>
```

## Best Practices

### 1. Single Source of Truth

**✅ DO:**
- Define styles in `panda.config.mjs` (tokens, global styles)
- Use semantic tokens for abstract values
- Inherit global typography colors

**❌ DON'T:**
- Hardcode colors in components
- Override global typography unnecessarily
- Duplicate style definitions

### 2. Atomic Design Hierarchy

**✅ DO:**
- Keep atoms simple and focused
- Compose molecules from atoms
- Build organisms from atoms/molecules
- Reuse components across contexts

**❌ DON'T:**
- Create atoms that depend on other atoms
- Mix concerns (styling + logic) unnecessarily
- Duplicate component functionality

### 3. Design Token Usage

**✅ DO:**
- Use semantic tokens (`glass.panel.bg`, `bg.canvas`)
- Reference color tokens (`primary.500`, `light.300`)
- Use radius tokens (`card`, `button`, `main`)
- Generate colors programmatically

**❌ DON'T:**
- Hardcode hex colors
- Use arbitrary values for spacing/radii
- Create new tokens without justification

### 4. Component Props

**✅ DO:**
- Provide sensible defaults
- Use semantic prop names (`variant`, `size`, `state`)
- Accept style overrides via `className` prop
- Document props in component files

**❌ DON'T:**
- Require props for common use cases
- Expose internal implementation details
- Create too many variant props

### 5. Global Styles

**✅ DO:**
- Define global styles in `panda.config.mjs`
- Let components inherit typography colors
- Use global styles for base element styling
- Apply liquid glass borders globally

**❌ DON'T:**
- Override global styles in components unnecessarily
- Create component-specific global styles
- Use inline styles for design tokens

### 6. Reusability

**✅ DO:**
- Extract common patterns into atoms (`Label`, `PreviewBackground`)
- Create reusable utility components
- Share components across routes
- Use composition over duplication

**❌ DON'T:**
- Duplicate component code
- Create one-off components without considering reuse
- Hardcode component-specific styles

## Development Workflow

### Adding a New Component

1. **Create component file** in appropriate directory (`atoms/`, `molecules/`, `organisms/`)
2. **Define props** with sensible defaults
3. **Style with Panda CSS** using design tokens
4. **Create demo page** in `src/routes/[category]/[component-name]/+page.svelte`
5. **Add to navigation** in `src/routes/+layout.svelte`
6. **Document props** in component file

### Adding a New Design Token

1. **Define token** in `panda.config.mjs`
2. **Generate colors** if needed (run `bun run gen-colors.js`)
3. **Update semantic tokens** if creating abstract value
4. **Regenerate Panda CSS** (`bun run prepare`)
5. **Use in components** via token reference

### Regenerating Panda CSS

After making changes to `panda.config.mjs`:

```bash
cd libs/hominio-design-system
bun run prepare
```

Or watch for changes:

```bash
bun run panda:watch
```

### Color Scale Generation

To generate color scales from base colors:

```bash
cd libs/hominio-design-system
bun run gen-colors.js
```

This updates `panda.config.mjs` with generated color scales.

## Liquid Glass Aesthetic

The design system implements a **liquid glass** (glassmorphism) aesthetic:

### Key Characteristics

1. **Translucent Backgrounds**
   - Use `rgba()` colors with low opacity
   - Semantic token: `glass.panel.bg`

2. **Backdrop Blur**
   - Apply `backdropFilter: 'blur(10px)'`
   - Creates depth and layering

3. **Subtle Borders**
   - Light borders with transparency
   - Semantic token: `glass.border.default`

4. **No Shadows**
   - Clean, flat aesthetic
   - Depth created through blur and transparency

### Implementation

```svelte
const glassStyle = css({
    bg: 'glass.panel.bg',
    backdropFilter: 'blur(10px)',
    borderWidth: '1px',
    borderColor: 'glass.border.default',
    shadow: 'none' // No shadows for liquid glass
});
```

## Container Queries

The design system supports **container queries** for responsive components:

**Configuration:** `panda.config.mjs` → `utilities.extend`

```javascript
utilities: {
    extend: {
        containerType: {
            values: ['inline-size', 'normal', 'size']
        },
        containerName: {
            values: ['sidebar', 'main', 'card']
        }
    }
}
```

**Usage:**
```svelte
<div class={css({ containerType: 'inline-size' })}>
    <!-- Component adapts to container width -->
</div>
```

## Summary

The Hominio Design System follows these core principles:

1. **Single Source of Truth** - Design decisions made once, propagated everywhere
2. **Atomic Design** - Component hierarchy from atoms to organisms
3. **Type-Safe Styling** - Panda CSS provides compile-time safety
4. **Design Tokens** - Centralized, semantic design values
5. **Global Inheritance** - Components inherit typography and base styles
6. **Reusability** - Extract common patterns into reusable atoms
7. **Liquid Glass** - Consistent glassmorphism aesthetic

By following these principles and best practices, the design system remains maintainable, scalable, and consistent.

