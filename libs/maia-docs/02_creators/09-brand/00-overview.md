# Brand (Design System)

**Brand** is a shared design system that defines the visual language across all actors. It provides consistent tokens for colors, typography, spacing, and component styles.

## Philosophy

> Brand is the IDENTITY of your application. It ensures visual consistency across all actors.

- **Brand** defines design tokens (colors, spacing, typography) and shared component styles
- **StyleEngine** compiles brand definitions to CSS
- **Actors** reference brand via `brand` property (required)
- **Actors** can also have local styles via `style` property (optional) for customization
- **StyleEngine merges** brand + style at runtime (brand first, style overrides)

## Brand Definition

Create a file named `brand.style.maia`:

```json
{
  "$schema": "@schema/style",
  "$id": "@style/brand",
  
  "tokens": {
    "colors": {
      "primary": "#3b82f6",
      "secondary": "#8b5cf6",
      "success": "#10b981",
      "danger": "#ef4444",
      "warning": "#f59e0b",
      "background": "#ffffff",
      "surface": "#f3f4f6",
      "text": "#1f2937",
      "textMuted": "#6b7280",
      "border": "#e5e7eb"
    },
    "spacing": {
      "xs": "0.25rem",
      "sm": "0.5rem",
      "md": "1rem",
      "lg": "1.5rem",
      "xl": "2rem",
      "2xl": "3rem"
    },
    "typography": {
      "fontFamily": "'Inter', sans-serif",
      "fontSizeBase": "16px",
      "fontSizeSmall": "14px",
      "fontSizeLarge": "18px",
      "fontSizeH1": "2rem",
      "fontSizeH2": "1.5rem",
      "fontSizeH3": "1.25rem",
      "lineHeight": "1.5",
      "fontWeight": "400",
      "fontWeightBold": "600"
    },
    "borderRadius": {
      "none": "0",
      "sm": "0.25rem",
      "md": "0.5rem",
      "lg": "0.75rem",
      "full": "9999px"
    },
    "shadows": {
      "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
    }
  },
  
  "components": {
    "todoApp": {
      "fontFamily": "var(--font-family)",
      "maxWidth": "800px",
      "margin": "0 auto",
      "padding": "var(--spacing-xl)"
    },
    "button": {
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "borderRadius": "var(--border-radius-md)",
      "border": "none",
      "cursor": "pointer",
      "fontWeight": "var(--font-weight-bold)",
      "transition": "all 0.2s"
    },
    "buttonPrimary": {
      "backgroundColor": "var(--color-primary)",
      "color": "white",
      ":hover": {
        "opacity": "0.9"
      }
    },
    "input": {
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "border": "1px solid var(--color-border)",
      "borderRadius": "var(--border-radius-md)",
      "fontSize": "var(--font-size-base)",
      "width": "100%",
      ":focus": {
        "outline": "none",
        "borderColor": "var(--color-primary)",
        "boxShadow": "var(--shadow-sm)"
      }
    }
  },
  "selectors": {
    "h1": {
      "fontSize": "var(--font-size-h1)",
      "fontWeight": "var(--font-weight-bold)",
      "color": "var(--color-text)",
      "marginBottom": "var(--spacing-lg)"
    }
  }
}
```

## Selectors Section

The `selectors` section allows you to define CSS selector-based styles (typically used in brand styles for global element styling).

**Use selectors for:**
- Global element styles (`h1`, `p`, `button`, etc.)
- Pseudo-classes (`:host`, `:hover`, `:focus`)
- Media queries (`@media (min-width: 768px)`)
- Advanced CSS selectors

**Example:**
```json
{
  "selectors": {
    ":host": {
      "fontFamily": "var(--font-family)",
      "fontSize": "var(--font-size-base)",
      "color": "var(--color-text)"
    },
    "h1": {
      "fontSize": "var(--font-size-h1)",
      "fontWeight": "var(--font-weight-bold)",
      "marginBottom": "var(--spacing-lg)"
    },
    "button:hover": {
      "opacity": "0.9"
    },
    "@media (min-width: 768px)": {
      "h1": {
        "fontSize": "var(--font-size-h1-large)"
      }
    }
  }
}
```

**Note:** The `selectors` section is typically used in brand styles for global application styling. Actor-specific styles usually use the `components` section with nested data-attribute syntax.

## Design Tokens

### Colors
Define your color palette:

```json
{
  "colors": {
    "primary": "#3b82f6",          // Main brand color
    "secondary": "#8b5cf6",        // Secondary actions
    "success": "#10b981",          // Success states
    "danger": "#ef4444",           // Errors/destructive actions
    "warning": "#f59e0b",          // Warnings
    "info": "#06b6d4",             // Informational
    
    "background": "#ffffff",        // Main background
    "surface": "#f3f4f6",          // Cards, panels
    "overlay": "rgba(0,0,0,0.5)",  // Modals, overlays
    
    "text": "#1f2937",             // Primary text
    "textMuted": "#6b7280",        // Secondary text
    "textInverse": "#ffffff",       // Text on dark backgrounds
    
    "border": "#e5e7eb",           // Default borders
    "borderDark": "#d1d5db"        // Darker borders
  }
}
```

### Spacing
Consistent spacing scale:

```json
{
  "spacing": {
    "xs": "0.25rem",    // 4px
    "sm": "0.5rem",     // 8px
    "md": "1rem",       // 16px
    "lg": "1.5rem",     // 24px
    "xl": "2rem",       // 32px
    "2xl": "3rem",      // 48px
    "3xl": "4rem"       // 64px
  }
}
```

### Typography
Font styles:

```json
{
  "typography": {
    "fontFamily": "'Inter', 'Helvetica Neue', sans-serif",
    "fontFamilyMono": "'Fira Code', monospace",
    
    "fontSizeBase": "16px",
    "fontSizeSmall": "14px",
    "fontSizeLarge": "18px",
    "fontSizeH1": "2rem",
    "fontSizeH2": "1.5rem",
    "fontSizeH3": "1.25rem",
    "fontSizeH4": "1.125rem",
    
    "lineHeight": "1.5",
    "lineHeightTight": "1.25",
    "lineHeightLoose": "1.75",
    
    "fontWeight": "400",
    "fontWeightMedium": "500",
    "fontWeightBold": "600",
    "fontWeightExtraBold": "700"
  }
}
```

### Border Radius
Rounded corners:

```json
{
  "borderRadius": {
    "none": "0",
    "sm": "0.25rem",
    "md": "0.5rem",
    "lg": "0.75rem",
    "xl": "1rem",
    "full": "9999px"
  }
}
```

### Shadows
Elevation shadows:

```json
{
  "shadows": {
    "none": "none",
    "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
  }
}
```

## Using Tokens in Styles

Tokens are compiled to CSS custom properties:

```css
/* Generated from tokens */
:host {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --spacing-md: 1rem;
  --font-family: 'Inter', sans-serif;
  --border-radius-md: 0.5rem;
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

Reference in styles:

```json
{
  "styles": {
    ".button": {
      "backgroundColor": "var(--color-primary)",
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "borderRadius": "var(--border-radius-md)",
      "boxShadow": "var(--shadow-sm)"
    }
  }
}
```

## Component Styles

Define reusable component styles. Use nested `data` syntax for conditional styling:

```json
{
  "components": {
    "button": {
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "borderRadius": "var(--border-radius-md)",
      "border": "none",
      "cursor": "pointer",
      "fontWeight": "var(--font-weight-bold)",
      "transition": "all 0.2s",
      "fontSize": "var(--font-size-base)",
      ":hover": {
        "opacity": "0.9"
      }
    },
    "buttonViewSwitch": {
      "padding": "var(--spacing-xs) var(--spacing-md)",
      "background": "transparent",
      "color": "var(--colors-textSecondary)",
      "border": "1px solid var(--colors-border)",
      "borderRadius": "var(--radii-sm)",
      "cursor": "pointer",
      "transition": "all 0.2s ease",
      "data": {
        "active": {
          "true": {
            "background": "var(--colors-primary)",
            "color": "white",
            "borderColor": "var(--colors-primary)",
            "fontWeight": "600"
          }
        }
      }
    },
    "card": {
      "display": "flex",
      "alignItems": "center",
      "padding": "var(--spacing-sm) var(--spacing-md)",
      "background": "var(--colors-surface)",
      "borderRadius": "0",
      "border": "1px solid var(--colors-border)",
      "transition": "all 0.2s ease",
      "data": {
        "isDragged": {
          "true": {
            "opacity": "0.3",
            "pointerEvents": "none"
          }
        },
        "done": {
          "true": {
            "opacity": "0.6",
            "background": "rgba(0, 0, 0, 0.02)"
