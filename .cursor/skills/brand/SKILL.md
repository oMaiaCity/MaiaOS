---
name: brand
description: Ensures UI/UX consistency by applying the Botanical Organic Serif design system using maiascript (maia-script/maia-vibes), maintaining branding guidelines, and building cohesive user interfaces. Use when designing components, pages, styling interfaces, creating design systems, or when the user mentions UI, UX, design, styling, branding, or visual consistency.
---

# Brand Design System

This skill ensures all UI/UX work follows the **Botanical Organic Serif** design system—a sophisticated, nature-inspired aesthetic that prioritizes organic softness, typographic elegance, and tactile warmth. All implementations use **maiascript** (`.style.maia` and `.view.maia` files) with the maia-script and maia-vibes libraries.

## Core Principles

Before writing any UI code, understand the design philosophy:

1. **Organic Softness**: Hard angles are rare. Use generous border-radius (`{radii.lg}` for cards, `{radii.full}` for buttons). Images can use arch shapes via `borderRadius` or `clipPath`.
2. **Typographic Elegance**: Playfair Display (serif) for headlines with generous scale. Source Sans 3 for body text. Use italics for emphasis.
3. **Earthbound Palette**: Colors derive from nature—forest greens, clay, sage, terracotta. No artificial brights.
4. **Tactile Texture**: **MANDATORY** paper grain overlay on main background (see references/design-system.md).
5. **Breathing Space**: Generous whitespace (`{spacing.xl}` to `{spacing.2xl}`). Elements float with room to exist.
6. **Intentional Movement**: Slow, graceful animations (`transition: "all 0.5s ease-out"` to `"all 0.7s ease-out"`).

## Quick Reference

### Colors (Light Mode)
- **Background**: `#F9F8F4` (Warm Alabaster)
- **Foreground**: `#2D3A31` (Deep Forest Green)
- **Primary/Accent**: `#8C9A84` (Sage Green)
- **Secondary**: `#DCCFC2` (Soft Clay)
- **Border**: `#E6E2DA` (Stone)
- **Interactive**: `#C27B66` (Terracotta)

### Typography
- **Headings**: Playfair Display (600/700 weight, italicize key words)
- **Body**: Source Sans 3 (400/500 weight)
- **Scale**: Large, airy headlines (use `{typography.fontSize.h1}` to `{typography.fontSize.h3}`)

### Radius & Shapes
- Cards: `{radii.lg}` (24px / 1.5rem)
- Buttons: `{radii.full}` (pill shape)
- Images: Use `borderRadius` with arch values or `clipPath` for organic shapes

### Shadows
- Soft, diffused: `{shadows.sm}` - `0 4px 6px -1px rgba(45, 58, 49, 0.05)`
- Medium: `{shadows.md}` - `0 10px 15px -3px rgba(45, 58, 49, 0.05)`
- Large: `{shadows.lg}` - `0 20px 40px -10px rgba(45, 58, 49, 0.15)`

### Animations
- Fast: `transition: "all 0.3s ease-out"` (button hovers)
- Standard: `transition: "all 0.5s ease-out"` (card lifts)
- Slow: `transition: "all 0.7s ease-out"` to `"all 1s ease-out"` (image scales)
- Easing: Always use `ease-out` curves

## When Building Components

### Before Writing Code

1. **Identify the actor structure** (which `.actor.maia` file this belongs to)
2. **Review existing brand tokens** (`brand.style.maia` tokens: colors, spacing, typography)
3. **Understand component patterns** (how other actors structure views and styles)
4. **Check constraints** (existing brand tokens, actor composition patterns)

### Component Checklist

- [ ] Uses design system tokens (reference via `{colors.*}`, `{spacing.*}`, etc.)
- [ ] Applies appropriate border-radius (use `{radii.lg}` or `{radii.full}`)
- [ ] Includes paper grain texture overlay (if main background) - see examples
- [ ] Generous whitespace (`{spacing.lg}` to `{spacing.2xl}`)
- [ ] Typography follows Playfair Display + Source Sans 3 pairing
- [ ] Animations are slow and graceful (`transition: "all 0.5s ease-out"` or slower)
- [ ] Shadows are soft and diffused (use `{shadows.sm}`, `{shadows.md}`, `{shadows.lg}`)
- [ ] Responsive (mobile-first, touch targets ≥44px)
- [ ] Accessible (focus states via `:focus`, semantic HTML tags in views)

### Common Patterns

**Buttons (in `brand.style.maia`):**
```json
"buttonPrimary": {
  "padding": "{spacing.md} {spacing.xl}",
  "background": "{colors.foreground}",
  "color": "white",
  "border": "none",
  "borderRadius": "{radii.full}",
  "fontSize": "{typography.fontSize.sm}",
  "fontWeight": "{typography.fontWeight.semibold}",
  "textTransform": "uppercase",
  "letterSpacing": "0.1em",
  "cursor": "pointer",
  "transition": "all 0.3s ease-out",
  ":hover": {
    "opacity": "0.9"
  }
}

"buttonSecondary": {
  "padding": "{spacing.md} {spacing.xl}",
  "background": "transparent",
  "color": "{colors.primary}",
  "border": "1px solid {colors.primary}",
  "borderRadius": "{radii.full}",
  "fontSize": "{typography.fontSize.sm}",
  "textTransform": "uppercase",
  "letterSpacing": "0.1em",
  "cursor": "pointer",
  "transition": "all 0.3s ease-out",
  ":hover": {
    "background": "{colors.primary}",
    "color": "white"
  }
}
```

**Cards (in `brand.style.maia`):**
```json
"card": {
  "background": "white",
  "borderRadius": "{radii.lg}",
  "padding": "{spacing.xl}",
  "boxShadow": "{shadows.sm}",
  "transition": "all 0.5s ease-out",
  ":hover": {
    "transform": "translateY(-4px)",
    "boxShadow": "{shadows.md}"
  }
}
```

**Paper Grain Overlay (CRITICAL - in `brand.style.maia` selectors):**
```json
"selectors": {
  ":host": {
    "position": "relative"
  },
  ":host::before": {
    "content": "\"\"",
    "position": "fixed",
    "top": "0",
    "left": "0",
    "right": "0",
    "bottom": "0",
    "pointerEvents": "none",
    "zIndex": "50",
    "opacity": "0.015",
    "backgroundImage": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
    "backgroundRepeat": "repeat"
  }
}
```

## Non-Generic Design Choices

Avoid generic UI. Instead:

- **Arch Imagery**: Use `clipPath` CSS property or `borderRadius` with arch values
- **Overlapping Typography**: Let headlines overlap images/shapes using negative margins or absolute positioning
- **Decorative Lines**: Fine 1px SVG lines that curve like vines (use SVG elements in views)
- **Italic Emphasis**: Use Playfair Display italic via `fontStyle: "italic"` for key words
- **Staggered Grid**: Use `transform: "translateY(3rem)"` on every second card via data attributes

## Responsive Strategy

- **Mobile-First**: Design for mobile, enhance for desktop using media queries in `selectors` section
- **Breakpoints**: Use `@media (min-width: 768px)` and `@media (min-width: 1024px)` in selectors
- **Typography**: Headlines scale from large to smaller via responsive font sizes
- **Spacing**: Use conditional spacing tokens or media queries
- **Touch Targets**: Minimum 44px height (`minHeight: "44px"` or `padding: "{spacing.md}"` minimum)

## Workflow

1. **Understand Context**: Review existing `.style.maia` and `.view.maia` patterns
2. **Apply Design System**: Define tokens in `brand.style.maia`, reference via `{token.path}` syntax
3. **Build Component**: Create `.view.maia` for structure, `.style.maia` for appearance
4. **Verify Consistency**: Check against design system principles and existing brand tokens
5. **Test Responsive**: Use `selectors` section with `@media` queries for breakpoints
6. **Ensure Accessibility**: Focus states via `:focus`, semantic HTML tags in views, proper ARIA attributes

## Additional Resources

- **Complete Design System**: See [references/design-system.md](references/design-system.md) for full specifications
- **Component Examples**: See [references/examples.md](references/examples.md) for code samples
- **Example Brand File**: See [references/brand.style.maia](references/brand.style.maia) for a complete, ready-to-use `brand.style.maia` file implementing the Botanical Organic Serif design system

## Questions to Ask User

When scope is unclear, ask:
- "Do you want a specific component redesigned, or existing components refactored?"
- "Should this follow the existing component architecture, or create new patterns?"
- "Are there any legacy constraints I should be aware of?"
