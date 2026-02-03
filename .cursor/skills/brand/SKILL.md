---
name: brand
description: Ensures UI/UX consistency by applying the Botanical Organic Serif design system using maiascript (maia-script/maia-vibes), maintaining branding guidelines, and building cohesive user interfaces. Use when designing components, pages, styling interfaces, creating design systems, or when the user mentions UI, UX, design, styling, branding, or visual consistency.
---

# Brand Design System: Botanical Organic Serif & Liquid Glass

This skill ensures all UI/UX work follows the **Botanical Organic Serif & Liquid Glass** design system—a hyper-realistic, immersive, nature-inspired aesthetic. UI elements are treated as premium liquid glass layers—highly polished, crystal-clear, and viscous—floating over immersive backgrounds.

## Core Principles

1.  **Liquid Glass Membrane**: UI elements are premium liquid glass membranes. Use `backdrop-filter: blur(8px) saturate(150%) contrast(101%)` with a near-zero opacity background (`rgba(255, 255, 255, 0.0005)`).
2.  **Underwriting Glass**: For text legibility over complex backgrounds, use a "stronger" glass backing: `background: rgba(255, 255, 255, 0.15)` with `blur(12px)`. For subtle highlights, use `rgba(255, 255, 255, 0.02)`.
3.  **Adaptive Navigation (The Notch)**: A floating, centered pill (`9999px`) using **Soft Clay at 75% opacity** (`rgba(232, 225, 217, 0.75)`) with `blur(12px)`.
4.  **Tone-on-Tone Typography**: Button labels and icons must use a **derived shade** of the background color (e.g., Deep Teal on Paradise Water) rather than generic white/black.
5.  **Geometry Contrast**: 
    *   **Interactive Elements**: Always fully rounded pill shapes (`9999px`).
    *   **Cards/Containers**: Use the **Apple-standard 18px radius** for structure.
6.  **Typographic Elegance**: 
    *   **Headlines**: Alice (Bold/Italic pairing). Use `text-shadow: 0 0 30px rgba(232, 225, 217, 0.2)` for readability on glass.
    *   **Body**: Plus Jakarta Sans (Weight 600 for labels, 400/500 for prose).
7.  **Soft Clay Foundation**: Use `Soft Clay (#E8E1D9)` as a warm, artisanal alternative to white for sections and secondary backgrounds.
8.  **Atmospheric Depth**: Always use a dark overlay (`rgba(0, 0, 0, 0.40)`) on background renders to create a cinematic foundation.

## Color Palette (The Earthbound Spectrum)

| Color | Hex | Role | Text Label Pairing |
| :--- | :--- | :--- | :--- |
| **Marine Blue** | `#001F33` | Primary Foundation / Dark Depth | `#D1E8F7` (Sky Tint) |
| **Paradise Water** | `#00BDD6` | Vibrant Interactive / Turquoise | `#004D59` (Deep Teal) |
| **Lush Green** | `#4E9A58` | Growth / Vitality | `#F0F9F1` (Mint Tint) |
| **Terra Cotta** | `#C27B66` | Earth / Warmth | `#FDF2EF` (Shell Tint) |
| **Sun Yellow** | `#E6B94D` | Energy / Clarity | `#4D3810` (Amber Mud) |
| **Soft Clay** | `#E8E1D9` | Artisanal Foundation | `#001F33` (Marine Blue) |
| **Tinted White** | `#F0EDE6` | High-Contrast Text / Accents | N/A |

## Component Specifications

### Responsive Strategy: Container-First
*   **MANDATORY**: Use **Container Queries** (`@container`) for all component responsiveness.
*   **NEVER** use global Media Queries (`@media`) for internal component layout.
*   **Philosophy**: Each component must be self-contained and adapt to the size of its parent container, ensuring it works perfectly whether it's in a sidebar, a grid, or a fullscreen hero.
*   **Implementation**: Ensure parent containers have `container-type: inline-size` defined.

### Buttons (The Pill System)
*   **Shape**: `borderRadius: 9999px`
*   **Typography**: `Plus Jakarta Sans`, `0.85rem`, `FontWeight: 600`, `textTransform: uppercase`, `letterSpacing: 0.05em`.
*   **Adaptive Sizing**:
    ```css
    @container (max-width: 400px) {
      .btn { padding: 0.6rem 1.5rem; font-size: 0.75rem; }
    }
    ```
*   **Variants**:
    *   **Solid**: Solid brand color background with tone-on-tone text.
    *   **Outline**: `1.5px` border of brand color, transparent background, brand color text.
    *   **Glass**: `rgba(255, 255, 255, 0.1)` background, `blur(8px)`, tone-on-tone text. Add `text-shadow: 0 0 10px currentColor` for colored labels.

### Cards & Containers
*   **Shape**: `borderRadius: 18px` (Apple Standard).
*   **Glass Card**: `backdrop-filter: blur(8px) saturate(150%)`, `border: 1px solid rgba(255, 255, 255, 0.05)`.
*   **Clay Card**: `background: rgba(255, 255, 255, 0.3)` over a Soft Clay section.

### Navigation (The Notch)
*   **Layout**: Fixed, centered, floating pill. `width: fit-content`.
*   **Style**: `background: rgba(232, 225, 217, 0.75)`, `blur(12px)`, `borderRadius: 9999px`.
*   **Logo**: `logo_dark.svg` with a subtle Paradise Water glow (`drop-shadow`).

## Implementation Snippets

### Liquid Glass Membrane (CSS)
```css
.liquid-membrane {
  background: rgba(255, 255, 255, 0.0005);
  backdrop-filter: blur(8px) saturate(150%) contrast(101%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.05);
}
```

### Underwriting Glass Marker (CSS)
```css
.marker-highlight {
  background: rgba(0, 189, 214, 0.2); /* Paradise Water Marker */
  backdrop-filter: blur(12px) saturate(140%);
  border-radius: 4px;
  padding: 0.1em 0.4em;
  box-decoration-break: clone;
}
```

## Best Practices

*   **DO** use `em` and `italic` for Alice headlines to create "intentional emergence" in the text.
*   **DO** use `Soft Clay` for sections that need a grounded, tactile feel.
*   **DO** add a subtle `text-shadow` glow to text on complex glass backgrounds to ensure readability.
*   **DON'T** use pure white or pure black for text on brand colors; always use the tone-on-tone derived shades.
*   **DON'T** use sharp corners for interactive elements; stick to the pill (`9999px`) or Apple-radius (`18px`).
*   **DO** ensure the paper grain overlay is active to prevent the glass from looking "digital" or "cheap".
