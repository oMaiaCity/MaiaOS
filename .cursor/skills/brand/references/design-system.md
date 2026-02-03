# Design System: Botanical Organic Serif & Liquid Glass

## 1. Design Philosophy

This style is a **digital ode to nature**—it breathes, flows, and grounds itself in organic beauty. It is **soft, sophisticated, and deeply intentional**, rejecting the rigid, hyper-digital sharpness of modern tech aesthetics in favor of **warmth, tactility, and natural imperfection**.

### Core Essence
The Botanical Organic style embodies the calming presence of a botanical garden, the earthy warmth of a ceramics studio, and the refined elegance of editorial design. It whispers rather than shouts. Every element feels **hand-touched, sun-warmed, and naturally crafted**.

### Liquid Glass Concept (v6 Evolution)
The interface is treated as a series of **highly translucent, premium liquid glass layers** floating over a **heavy, immersive fullscreen background image**. This is the "Apple iOS 26 Liquid Glass" evolution: a hyper-realistic yet futuristic aesthetic where UI elements feel like **viscous, molten glass** with **dynamic fluid ripples**, **heavy refraction**, and **prismatic depth**.

### Fundamental Principles

*   **Vibe**: Immersive, futuristic, artisanal, liquid-crystal, sustainable luxury, botanical elegance.
*   **Visual DNA**:
    *   **Immersive Background**: A mandatory, high-resolution fullscreen background image (nature, textures, organic patterns) that serves as the foundation.
    *   **Atmospheric Depth**: Always use a dark overlay (`rgba(0, 0, 0, 0.40)`) on background renders to create a cinematic foundation.
    *   **Premium Liquid Glass**: UI elements use highly polished translucent crystal-clear glass effects. Use `backdrop-filter: blur(8px) saturate(150%) contrast(101%)` with a near-zero opacity background (`rgba(255, 255, 255, 0.0005)`).
    *   **Underwriting Glass**: For text legibility over complex backgrounds, use a "stronger" glass backing: `background: rgba(255, 255, 255, 0.15)` with `blur(12px)`. For subtle highlights, use `rgba(255, 255, 255, 0.02)`.
    *   **Prismatic & Caustic Light**: Layers feature **iridescent pearlescent sheens**, **chromatic aberration edges**, and **prismatic glows**.
    *   **Glossy Wet-Look**: Highlights are sharp, glossy, and "wet," mimicking ray-traced global illumination and dramatic rim lighting.
    *   **Organic Softness**: Hard angles are non-existent. Every shape flows like water-smoothed stones.
    *   **Tactile Texture**: The subtle paper grain overlay remains mandatory to ground the futuristic glass in a touchable, human surface.
    *   **Intentional Movement**: Animations are slow and fluid, mimicking the viscous flow of molten glass.

## 2. Design Token System

### Colors (The Earthbound Spectrum)

| Color | Hex | Role | Text Label Pairing |
| :--- | :--- | :--- | :--- |
| **Marine Blue** | `#001F33` | Primary Foundation / Dark Depth | `#D1E8F7` (Sky Tint) |
| **Paradise Water** | `#00BDD6` | Vibrant Interactive / Turquoise | `#004D59` (Deep Teal) |
| **Lush Green** | `#4E9A58` | Growth / Vitality | `#F0F9F1` (Mint Tint) |
| **Terra Cotta** | `#C27B66` | Earth / Warmth | `#FDF2EF` (Shell Tint) |
| **Sun Yellow** | `#E6B94D` | Energy / Clarity | `#4D3810` (Amber Mud) |
| **Soft Clay** | `#E8E1D9` | Artisanal Foundation | `#001F33` (Marine Blue) |
| **Tinted White** | `#F0EDE6` | High-Contrast Text / Accents | N/A |

### Typography

*   **Headings**: **"Playfair Display"** (Google Font). 
    *   Weight: 600/700 for headlines.
    *   Style: Italicize key words for emphasis.
    *   Readability: Use `text-shadow: 0 0 30px rgba(232, 225, 217, 0.2)` on glass.
*   **Body**: **"Plus Jakarta Sans"** (Google Font). 
    *   Weight: 600 for labels, 400/500 for prose.
*   **Scaling**: Large, architectural scale. Headlines use `clamp(3.5rem, 12vw, 8rem)`.

### Radius & Shapes

*   **Interactive Elements**: Always fully rounded pill shapes (`9999px`).
*   **Cards/Containers**: Use the **Apple-standard 18px radius** for structure.
*   **Border**: Thin, delicate. `1px` solid `rgba(255, 255, 255, 0.05)`.

### Responsive Strategy: Container-First
*   **MANDATORY**: Use **Container Queries** (`@container`) for all component responsiveness.
*   **NEVER** use global Media Queries (`@media`) for internal component layout.
*   **Implementation**: Parent containers must have `container-type: inline-size`.

## 3. Component Stylings

### Buttons (The Pill System)

*   **Solid**: Solid brand color background with **Tone-on-Tone** text.
*   **Outline**: `1.5px` border of brand color, transparent background, brand color text.
*   **Glass**: `rgba(255, 255, 255, 0.1)` background, `blur(8px)`, tone-on-tone text. Add `text-shadow: 0 0 10px currentColor` for colored labels.
*   **Typography**: Uppercase, `0.85rem`, `FontWeight: 600`, `letter-spacing: 0.05em`.

### Navigation (The Notch)

*   **Layout**: Fixed, centered, floating pill. `width: fit-content`.
*   **Style**: **Soft Clay at 75% opacity** (`rgba(232, 225, 217, 0.75)`), `blur(12px)`, `borderRadius: 9999px`.
*   **Logo**: `logo_dark.svg` with a subtle Paradise Water glow (`drop-shadow`).

### Cards

*   **Liquid Membrane**: `background: rgba(255, 255, 255, 0.0005)`, `backdrop-filter: blur(8px) saturate(150%)`, `border: 1px solid rgba(255, 255, 255, 0.05)`.
*   **Clay Card**: `background: rgba(255, 255, 255, 0.3)` over a Soft Clay section.

## 4. Non-Generic "Bold" Choices

*   **Underwriting Glass Markers**: Use nested glass plates with tinted backgrounds (e.g., `rgba(0, 189, 214, 0.2)`) to highlight key phrases within prose.
*   **Italic Alice**: Frequently use the *Italic* variant for single words to create "intentional emergence."
*   **Atmospheric Depth**: The 40% dark overlay is mandatory for background renders.

## 5. Animation & Micro-Interactions

*   **Feel**: Slow, graceful, fluid.
*   **Durations**:
    *   Fast: `duration-300` (button hovers)
    *   Standard: `duration-500` (card lifts)
    *   Slow: `duration-700` to `duration-1000` (image scales)
