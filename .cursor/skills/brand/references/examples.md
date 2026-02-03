# Component Examples (Maiascript)

All examples use maiascript syntax (`.style.maia` and `.view.maia` files) with the maia-script and maia-vibes libraries.

**Design Concept**: These components implement the **Botanical Organic Serif & Liquid Glass (iOS 26 Evolution)** aesthetic. UI elements are treated as translucent, premium liquid glass layers—highly polished, crystal-clear, and viscous—floating over an immersive fullscreen background image.

**Key Features (iOS 26 Evolution)**:
- **Viscous Molten Flow**: Soft, organic shapes that feel like fluid glass with subtle, dynamic ripples.
- **Heavy Refraction & Caustics**: High backdrop-blur (35px+) with saturation boosts (200%) and caustic light bending.
- **Chromatic Aberration**: Subtle RGB splitting on edges for a hyper-realistic lens effect.
- **Prismatic & Rim Lighting**: Inner and outer glows with dramatic rim lighting that mimic light bending through crystal.
- **Glossy Wet-Look**: High-contrast specular highlights and ray-traced global illumination effects.
- **Layered Translucent Depth**: Multiple glass layers with floating refractive bubbles.

**Icon Philosophy**: Icons should be minimal line art SVGs with thin strokes (1.5px), or omitted entirely if typography alone communicates the meaning. Never use emojis or heavy filled icons.

## Immersive Background & Paper Grain (CRITICAL)

The foundation of every view is a fullscreen background image with a paper grain overlay.

**Style (`brand.style.maia`):**
```json
"selectors": {
  ":host": {
    "position": "relative",
    "minHeight": "100vh",
    "backgroundImage": "url('$backgroundImage')",
    "backgroundSize": "cover",
    "backgroundPosition": "center",
    "backgroundAttachment": "fixed"
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

## Button Components

### Primary Button (Solid)

**Style (`brand.style.maia`):**
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
```

### Secondary Button (Liquid Glass)

**Style (`brand.style.maia`):**
```json
"buttonSecondary": {
  "padding": "{spacing.md} {spacing.xl}",
  "background": "rgba(255, 255, 255, 0.1)",
  "backdropFilter": "blur(10px)",
  "-webkit-backdrop-filter": "blur(10px)",
  "color": "{colors.foreground}",
  "border": "1px solid {colors.border}",
  "borderRadius": "{radii.full}",
  "fontSize": "{typography.fontSize.sm}",
  "textTransform": "uppercase",
  "letterSpacing": "0.1em",
  "cursor": "pointer",
  "transition": "all 0.3s ease-out",
  ":hover": {
    "background": "rgba(255, 255, 255, 0.2)"
  }
}
```

## Card Components

### Liquid Glass Card (iOS 26 Evolution)

**Style (`brand.style.maia`):**
```json
"card": {
  "background": "rgba(255, 255, 255, 0.12)",
  "backdropFilter": "blur(30px) saturate(160%)",
  "-webkit-backdrop-filter": "blur(30px) saturate(160%)",
  "borderRadius": "{radii.lg}",
  "padding": "{spacing.xl}",
  "boxShadow": "{shadows.glassGlow}",
  "border": "1px solid rgba(255, 255, 255, 0.25)",
  "transition": "all 0.5s ease-out",
  "position": "relative",
  "overflow": "hidden",
  ":hover": {
    "transform": "translateY(-4px)",
    "background": "rgba(255, 255, 255, 0.18)",
    "boxShadow": "{shadows.md}"
  }
}
```
"cardIcon": {
  "width": "3rem",
  "height": "3rem",
  "borderRadius": "{radii.full}",
  "background": "{colors.secondary}",
  "display": "flex",
  "alignItems": "center",
  "justifyContent": "center",
  "marginBottom": "{spacing.md}"
},
"cardTitle": {
  "fontFamily": "'Playfair Display', serif",
  "fontSize": "{typography.fontSize.h2}",
  "fontWeight": "{typography.fontWeight.semibold}",
  "color": "{colors.foreground}",
  "marginBottom": "{spacing.sm}",
  "marginTop": "0"
},
"cardBody": {
  "fontFamily": "'Source Sans 3', sans-serif",
  "fontSize": "{typography.fontSize.lg}",
  "color": "{colors.foreground}",
  "lineHeight": "1.75"
}
```

**View (`.view.maia`):**
```json
{
  "tag": "div",
  "class": "card",
  "children": [
    {
      "tag": "div",
      "class": "card-icon",
      "children": [
        {
          "tag": "svg",
          "attrs": {
            "width": "24",
            "height": "24",
            "viewBox": "0 0 24 24",
            "fill": "none",
            "stroke": "{colors.foreground}",
            "strokeWidth": "1.5",
            "strokeLinecap": "round",
            "strokeLinejoin": "round"
          },
          "children": [
            {
              "tag": "path",
              "attrs": {
                "d": "M12 2L2 7l10 5 10-5-10-5z"
              }
            }
          ]
        }
      ]
    },
    {
      "tag": "h3",
      "class": "card-title",
      "text": "Feature Title"
    },
    {
      "tag": "p",
      "class": "card-body",
      "text": "Feature description text goes here."
    }
  ]
}
```

**Note**: Icons are optional. If the title and description clearly communicate the feature, omit the icon entirely. Only include icons when they add essential meaning that typography cannot convey.

### Staggered Grid Card (Every Second Card)

**Style (`brand.style.maia`):**
```json
"cardStaggered": {
  "background": "white",
  "borderRadius": "{radii.lg}",
  "padding": "{spacing.xl}",
  "boxShadow": "{shadows.sm}",
  "transition": "all 0.5s ease-out",
  ":hover": {
    "transform": "translateY(-4px)",
    "boxShadow": "{shadows.md}"
  },
  "data": {
    "stagger": {
      "even": {
        "transform": "translateY(3rem)"
      }
    }
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "div",
  "class": "card-staggered",
  "attrs": {
    "data-stagger": "$staggerIndex"
  },
  "children": [
    {
      "tag": "h3",
      "text": "Card Title"
    }
  ]
}
```

## Input Components

### Underlined Input

**Style (`brand.style.maia`):**
```json
"inputUnderlined": {
  "width": "100%",
  "background": "transparent",
  "border": "none",
  "borderBottom": "1px solid {colors.border}",
  "color": "{colors.foreground}",
  "padding": "{spacing.sm} 0",
  "fontSize": "{typography.fontSize.base}",
  "outline": "none",
  "transition": "border-color 0.3s ease-out",
  ":focus": {
    "borderBottomColor": "{colors.primary}"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "input",
  "class": "input-underlined",
  "attrs": {
    "type": "text",
    "placeholder": "Enter your email",
    "value": "$emailValue"
  },
  "$on": {
    "input": {
      "send": "UPDATE_EMAIL",
      "payload": {"email": "@inputValue"}
    }
  }
}
```

### Pill-Shaped Input

**Style (`brand.style.maia`):**
```json
"inputPill": {
  "width": "100%",
  "borderRadius": "{radii.full}",
  "background": "{colors.secondary}",
  "border": "1px solid {colors.border}",
  "color": "{colors.foreground}",
  "padding": "{spacing.md} {spacing.lg}",
  "fontSize": "{typography.fontSize.base}",
  "outline": "none",
  "transition": "all 0.3s ease-out",
  ":focus": {
    "borderColor": "{colors.primary}",
    "boxShadow": "0 0 0 2px {colors.primary}"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "input",
  "class": "input-pill",
  "attrs": {
    "type": "text",
    "placeholder": "Search...",
    "value": "$searchValue"
  },
  "$on": {
    "input": {
      "send": "UPDATE_SEARCH",
      "payload": {"search": "@inputValue"}
    }
  }
}
```

## Typography Examples

### Hero Headline

**Style (`brand.style.maia`):**
```json
"headingHero": {
  "fontFamily": "'Playfair Display', serif",
  "fontSize": "clamp(3rem, 8vw, 8rem)",
  "fontWeight": "{typography.fontWeight.bold}",
  "color": "{colors.foreground}",
  "lineHeight": "1.1",
  "marginBottom": "{spacing.lg}",
  "marginTop": "0"
},
"headingHeroItalic": {
  "fontStyle": "italic"
}
```

**View (`.view.maia`):**
```json
{
  "tag": "h1",
  "class": "heading-hero",
  "children": [
    {
      "tag": "text",
      "text": "Welcome to "
    },
    {
      "tag": "span",
      "class": "heading-hero-italic",
      "text": "Nature"
    }
  ]
}
```

### Section Heading

**Style (`brand.style.maia`):**
```json
"headingSection": {
  "fontFamily": "'Playfair Display', serif",
  "fontSize": "clamp(2rem, 5vw, 4rem)",
  "fontWeight": "{typography.fontWeight.semibold}",
  "color": "{colors.foreground}",
  "marginBottom": "{spacing.md}",
  "marginTop": "0"
}
```

**View (`.view.maia`):**
```json
{
  "tag": "h2",
  "class": "heading-section",
  "children": [
    {
      "tag": "text",
      "text": "Our "
    },
    {
      "tag": "span",
      "attrs": {
        "style": "font-style: italic"
      },
      "text": "Mission"
    }
  ]
}
```

### Body Text

**Style (`brand.style.maia`):**
```json
"bodyText": {
  "fontFamily": "'Source Sans 3', sans-serif",
  "fontSize": "{typography.fontSize.lg}",
  "color": "{colors.foreground}",
  "lineHeight": "1.75"
}
```

**View (`.view.maia`):**
```json
{
  "tag": "p",
  "class": "body-text",
  "text": "Body text content goes here. It should be readable and comfortable."
}
```

## Image Components

### Arch Image

**Style (`brand.style.maia`):**
```json
"imageArch": {
  "position": "relative",
  "overflow": "hidden",
  "borderTopLeftRadius": "{radii.full}",
  "borderTopRightRadius": "{radii.full}",
  "borderBottomLeftRadius": "0",
  "borderBottomRightRadius": "0"
},
"imageArch img": {
  "width": "100%",
  "height": "100%",
  "objectFit": "cover",
  "transition": "transform 0.7s ease-out",
  ":hover": {
    "transform": "scale(1.05)"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "div",
  "class": "image-arch",
  "children": [
    {
      "tag": "img",
      "attrs": {
        "src": "$imageSrc",
        "alt": "$imageAlt"
      }
    }
  ]
}
```

### Organic Blob Image

**Style (`brand.style.maia`):**
```json
"imageBlob": {
  "position": "relative",
  "overflow": "hidden",
  "borderRadius": "2.5rem"
},
"imageBlob img": {
  "width": "100%",
  "height": "100%",
  "objectFit": "cover",
  "transition": "transform 0.7s ease-out",
  ":hover": {
    "transform": "scale(1.05)"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "div",
  "class": "image-blob",
  "children": [
    {
      "tag": "img",
      "attrs": {
        "src": "$imageSrc",
        "alt": "$imageAlt"
      }
    }
  ]
}
```

## Layout Examples

### Section Container

**Style (`brand.style.maia`):**
```json
"section": {
  "paddingTop": "{spacing.xl}",
  "paddingBottom": "{spacing.xl}",
  "background": "{colors.background}",
  "@media (min-width: 768px)": {
    "paddingTop": "{spacing.2xl}",
    "paddingBottom": "{spacing.2xl}"
  }
},
"container": {
  "maxWidth": "80rem",
  "marginLeft": "auto",
  "marginRight": "auto",
  "paddingLeft": "{spacing.md}",
  "paddingRight": "{spacing.md}",
  "@media (min-width: 768px)": {
    "paddingLeft": "{spacing.xl}",
    "paddingRight": "{spacing.xl}"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "section",
  "class": "section",
  "children": [
    {
      "tag": "div",
      "class": "container",
      "children": [
        {
          "$slot": "$sectionContent"
        }
      ]
    }
  ]
}
```

### Grid Layout (Features)

**Style (`brand.style.maia`):**
```json
"grid": {
  "display": "grid",
  "gridTemplateColumns": "1fr",
  "gap": "{spacing.xl}",
  "@media (min-width: 768px)": {
    "gridTemplateColumns": "repeat(3, 1fr)",
    "gap": "{spacing.2xl}"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "div",
  "class": "grid",
  "$each": {
    "items": "$features",
    "template": {
      "$slot": "$featureCard"
    }
  }
}
```

### Grid Layout (Staggered)

**Style (`brand.style.maia`):**
```json
"gridStaggered": {
  "display": "grid",
  "gridTemplateColumns": "1fr",
  "gap": "{spacing.xl}",
  "@media (min-width: 768px)": {
    "gridTemplateColumns": "repeat(3, 1fr)",
    "gap": "{spacing.2xl}"
  }
},
"gridStaggered .card:nth-child(even)": {
  "@media (min-width: 768px)": {
    "transform": "translateY(3rem)"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "div",
  "class": "grid-staggered",
  "$each": {
    "items": "$features",
    "template": {
      "tag": "div",
      "class": "card",
      "children": [
        {
          "$slot": "$featureContent"
        }
      ]
    }
  }
}
```

## Paper Grain Overlay (CRITICAL)

**Style (`brand.style.maia` selectors):**
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

## Animation Examples

### Fade Up on Scroll

**Style (`brand.style.maia`):**
```json
"fadeUp": {
  "opacity": "0",
  "transform": "translateY(1rem)",
  "animation": "fadeUp 0.5s ease-out 0.2s forwards"
},
"@keyframes fadeUp": {
  "to": {
    "opacity": "1",
    "transform": "translateY(0)"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "div",
  "class": "fade-up",
  "children": [
    {
      "$slot": "$content"
    }
  ]
}
```

### Card Hover Effect

**Style (`brand.style.maia`):**
```json
"cardHover": {
  "transition": "all 0.5s ease-out",
  ":hover": {
    "transform": "translateY(-4px)",
    "boxShadow": "{shadows.md}"
  }
}
```

**View (`.view.maia`):**
```json
{
  "tag": "div",
  "class": "card-hover",
  "children": [
    {
      "$slot": "$cardContent"
    }
  ]
}
```

## Responsive Examples

### Mobile-First Typography

**Style (`brand.style.maia`):**
```json
"headingResponsive": {
  "fontSize": "clamp(3rem, 8vw, 8rem)",
  "fontFamily": "'Playfair Display', serif",
  "fontWeight": "{typography.fontWeight.bold}"
}
```

### Mobile-First Spacing

**Style (`brand.style.maia`):**
```json
"sectionResponsive": {
  "paddingTop": "{spacing.xl}",
  "paddingBottom": "{spacing.xl}",
  "@media (min-width: 768px)": {
    "paddingTop": "{spacing.2xl}",
    "paddingBottom": "{spacing.2xl}"
  },
  "@media (min-width: 1024px)": {
    "paddingTop": "{spacing.2xl}",
    "paddingBottom": "{spacing.2xl}"
  }
}
```

### Mobile-First Grid

**Style (`brand.style.maia`):**
```json
"gridResponsive": {
  "display": "grid",
  "gridTemplateColumns": "1fr",
  "gap": "{spacing.xl}",
  "@media (min-width: 768px)": {
    "gridTemplateColumns": "repeat(2, 1fr)",
    "gap": "{spacing.xl}"
  },
  "@media (min-width: 1024px)": {
    "gridTemplateColumns": "repeat(3, 1fr)",
    "gap": "{spacing.2xl}"
  }
}
```

## Line Art SVG Icon Examples

### Simple Icon (Leaf/Plant)

**View (`.view.maia`):**
```json
{
  "tag": "svg",
  "attrs": {
    "width": "24",
    "height": "24",
    "viewBox": "0 0 24 24",
    "fill": "none",
    "stroke": "{colors.foreground}",
    "strokeWidth": "1.5",
    "strokeLinecap": "round",
    "strokeLinejoin": "round"
  },
  "children": [
    {
      "tag": "path",
      "attrs": {
        "d": "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
      }
    }
  ]
}
```

### Minimal Navigation Icon

**View (`.view.maia`):**
```json
{
  "tag": "svg",
  "attrs": {
    "width": "20",
    "height": "20",
    "viewBox": "0 0 24 24",
    "fill": "none",
    "stroke": "{colors.primary}",
    "strokeWidth": "1.5",
    "strokeLinecap": "round",
    "strokeLinejoin": "round"
  },
  "children": [
    {
      "tag": "line",
      "attrs": {
        "x1": "3",
        "y1": "12",
        "x2": "21",
        "y2": "12"
      }
    },
    {
      "tag": "line",
      "attrs": {
        "x1": "3",
        "y1": "6",
        "x2": "21",
        "y2": "6"
      }
    },
    {
      "tag": "line",
      "attrs": {
        "x1": "3",
        "y1": "18",
        "x2": "21",
        "y2": "18"
      }
    }
  ]
}
```

**Remember**: Only include icons when they add essential meaning. Prefer typography and whitespace over decorative icons.
