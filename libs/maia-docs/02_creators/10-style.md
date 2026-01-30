# Style (Local Styling)

**Style** files provide actor-specific styling that extends or overrides the shared brand design system. They allow customization without affecting other actors.

## Philosophy

> Style is the PERSONALITY of an individual actor. It customizes appearance while respecting the brand foundation.

- **Brand** provides the foundation (design system)
- **Style** adds actor-specific customization
- **Shadow DOM** ensures style isolation
- **StyleEngine** compiles both brand and local styles

## When to Use Style vs Brand

### Use Brand For:
- Design tokens (colors, spacing, typography)
- Component patterns (buttons, inputs, cards)
- Global application theme
- Shared styles across all actors

### Use Style For:
- Actor-specific layouts
- Custom component variations
- Unique styling needs
- Overrides for specific actors

## Style Definition

Create a file named `{name}.style.maia`:

```json
{
  "$schema": "@schema/style",
  "$id": "@style/todo",
  
  "components": {
    "todoItem": {
      "display": "flex",
      "alignItems": "center",
      "padding": "var(--spacing-sm)",
      "borderBottom": "1px solid var(--color-border)",
      "gap": "var(--spacing-sm)",
      ":hover": {
        "backgroundColor": "var(--color-surface)"
      },
      "data": {
        "done": {
          "true": {
            "opacity": "0.6",
            "textDecoration": "line-through"
          }
        }
      }
    },
    "deleteBtn": {
      "marginLeft": "auto",
      "padding": "var(--spacing-xs)",
      "color": "var(--color-danger)",
      "backgroundColor": "transparent",
      "border": "none",
      "cursor": "pointer",
      "fontSize": "1.5rem",
      "lineHeight": "1",
      ":hover": {
        "backgroundColor": "rgba(239, 68, 68, 0.1)"
      }
    }
  }
}
```

**Note:** 
- Use `components` section for component definitions with nested data-attribute syntax (e.g., `.todoItem`, `.card`)
- Use `selectors` section for advanced CSS selectors (e.g., `:host`, `h1`, `@media` queries)
- The old `styles` section is deprecated - use `components` or `selectors` instead

## Linking Style to Actors

In your actor definition:

```json
{
  "$schema": "@schema/actor",
  "$id": "@actor/todo",
  "brand": "@style/brand",  // ← Required: shared design system
  "style": "@style/todo",   // ← Optional: actor-specific overrides
  "view": "@view/todo",
  "state": "@state/todo"
}
```

**Note:** 
- `brand` is **required** - shared design system (tokens, components) used by all actors
- `style` is **optional** - actor-specific style overrides that merge with brand
- StyleEngine merges brand + style at runtime (brand first, style overrides)
- Both use co-id references (`@style/brand`, `@style/todo`) that are transformed to co-ids during seeding

## Style Compilation

Styles are compiled to CSS and injected into the actor's Shadow DOM:

```
Brand tokens → CSS custom properties
  ↓
Brand styles → CSS rules
  ↓
Local styles → CSS rules (override/extend)
  ↓
Inject into Shadow DOM
```

## Components vs Selectors

**Components Section:**
- Use for component definitions (e.g., `.todoItem`, `.card`, `.button`)
- Supports nested data-attribute syntax for conditional styling
- Component names map to CSS classes (camelCase → kebab-case)

**Selectors Section:**
- Use for advanced CSS selectors (e.g., `:host`, `h1`, `button:hover`)
- Use for pseudo-classes, pseudo-elements, and media queries
- Typically used in brand styles for global element styling

## Common Patterns

### Layout Styles (Components Section)
```json
{
  "components": {
    "todoApp": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "var(--spacing-lg)",
      "maxWidth": "800px",
      "margin": "0 auto"
    },
    "kanbanBoard": {
      "display": "grid",
      "gridTemplateColumns": "repeat(2, 1fr)",
      "gap": "var(--spacing-md)"
    },
    "column": {
      "backgroundColor": "var(--color-surface)",
      "borderRadius": "var(--border-radius-lg)",
      "padding": "var(--spacing-md)"
    }
  }
}
```

### State Styles (Using Data-Attributes)

**No class-based conditionals!** Use data-attributes instead:

```json
{
  "components": {
    "todoItem": {
      "transition": "all 0.2s",
      "data": {
        "done": {
          "true": {
            "opacity": "0.6",
            "textDecoration": "line-through"
          }
        },
        "isEditing": {
          "true": {
            "backgroundColor": "var(--color-primary)",
            "color": "white"
          }
        },
        "isDragged": {
          "true": {
            "opacity": "0.5",
            "cursor": "move"
          }
        }
      }
    }
  }
}
```

**View sets data-attributes:**
```json
{
  "attrs": {
    "data": {
      "done": "$$done",
      "isEditing": "$editingItemId.$$id",
      "isDragged": "$draggedItemIds.$$id"
    }
  }
}
```

**Pattern:** State machine computes → Context stores → View maps → CSS styles

### Interactive Styles (Using Data-Attributes)

```json
{
  "components": {
    "draggable": {
      "cursor": "grab",
      "transition": "transform 0.2s",
      ":active": {
        "cursor": "grabbing",
        "transform": "scale(1.05)"
      }
    },
    "dropzone": {
      "border": "2px dashed var(--color-border)",
      "minHeight": "100px",
      "transition": "all 0.2s",
      "data": {
        "dragOverColumn": {
          "todo": {
            "borderColor": "var(--color-primary)",
            "backgroundColor": "rgba(59, 130, 246, 0.05)"
          },
          "done": {
            "borderColor": "var(--color-primary)",
            "backgroundColor": "rgba(59, 130, 246, 0.05)"
          }
        }
      }
    }
  }
}
```

### Animation Styles (Selectors Section)
```json
{
  "selectors": {
    "@keyframes fadeIn": {
      "from": {"opacity": "0", "transform": "translateY(-10px)"},
      "to": {"opacity": "1", "transform": "translateY(0)"}
    },
    ".todo-item": {
      "animation": "fadeIn 0.3s ease-out"
    },
    ".delete-btn": {
      "transition": "transform 0.2s"
    },
    ".delete-btn:hover": {
      "transform": "scale(1.2)"
    }
  }
}
```

## Overriding Brand Styles

Local styles can override brand styles:

```json
{
  "components": {
    "buttonPrimary": {
      "backgroundColor": "#ef4444",  // Override brand primary color
      "borderRadius": "0"             // Override brand border radius
    },
    "input": {
      "fontSize": "18px",             // Larger input text
      "padding": "1rem"               // More padding
    }
  }
}
```

## Using CSS Custom Properties

Reference brand tokens:

```json
{
  "components": {
    "customElement": {
      "color": "var(--color-primary)",
      "padding": "var(--spacing-md)",
      "borderRadius": "var(--border-radius-lg)",
      "boxShadow": "var(--shadow-md)"
    }
  }
}
```

Define local custom properties (use selectors for `:host`):

```json
{
  "selectors": {
    ":host": {
      "--local-accent": "#f59e0b",
      "--local-spacing": "0.75rem"
    }
  },
  "components": {
    "customElement": {
      "color": "var(--local-accent)",
      "padding": "var(--local-spacing)"
    }
  }
}
```

## Responsive Styles (Selectors Section)

```json
{
  "components": {
    "todoApp": {
      "padding": "var(--spacing-md)"
    },
    "kanbanBoard": {
      "gridTemplateColumns": "repeat(2, 1fr)"
    }
  },
  "selectors": {
    "@media (min-width: 768px)": {
      ".todo-app": {
        "padding": "var(--spacing-xl)"
      },
      ".kanban-board": {
        "gridTemplateColumns": "repeat(3, 1fr)"
      }
    },
    "@media (min-width: 1024px)": {
      ".todo-app": {
        "maxWidth": "1200px"
      }
    }
  }
}
```

## Pseudo-classes and Pseudo-elements (Selectors Section)

```json
{
  "selectors": {
    ".todo-item:hover": {
      "backgroundColor": "var(--color-surface)"
    },
    ".todo-item:first-child": {
      "borderTopLeftRadius": "var(--border-radius-md)",
      "borderTopRightRadius": "var(--border-radius-md)"
    },
    ".todo-item:last-child": {
      "borderBottom": "none"
    },
    ".input::placeholder": {
      "color": "var(--color-text-muted)",
      "fontStyle": "italic"
    },
    ".checkbox:checked": {
      "backgroundColor": "var(--color-primary)"
    }
  }
}
```

## Nested Data-Attribute Syntax

For conditional styling, use nested `data` syntax in component definitions:

```json
{
  "components": {
    "card": {
      "display": "flex",
      "padding": "var(--spacing-sm)",
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
            "textDecoration": "line-through"
          }
        }
      }
    },
    "kanbanColumnContent": {
      "border": "2px dashed var(--colors-border)",
      "data": {
        "dragOverColumn": {
          "todo": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "var(--colors-primary)"
          },
          "done": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "var(--colors-primary)"
          }
        }
      }
    }
  }
}
```

**Generated CSS:**
```css
.card[data-is-dragged="true"] {
  opacity: 0.3;
  pointer-events: none;
}

.card[data-done="true"] {
  opacity: 0.6;
  text-decoration: line-through;
}

.kanban-column-content[data-drag-over-column="todo"] {
  background: rgba(143, 168, 155, 0.15);
  border-color: var(--colors-primary);
}
```

**Pattern:** State machine computes → Context stores → View maps to data-attributes → CSS matches selectors

## Best Practices

### ✅ DO:

- **Use brand tokens** - Reference CSS custom properties
- **Use `components` section** - For component definitions with nested data-attribute syntax
- **Use `selectors` section** - For advanced CSS selectors (pseudo-classes, media queries, `:host`)
- **Keep styles scoped** - Shadow DOM provides isolation
- **Use semantic names** - `todoItem` not `item123` (camelCase → kebab-case in CSS)
- **Leverage transitions** - Smooth state changes
- **Support responsive** - Use media queries in `selectors` section
- **Use nested data syntax** - For conditional styling via data-attributes in `components`

### ❌ DON'T:

- **Don't use `styles` section** - Use `components` or `selectors` instead
- **Don't use class-based conditionals** - Use data-attributes instead (`.active`, `.dragging`, etc.)
- **Don't use IDs** - Use classes for styling
- **Don't use `!important`** - Shadow DOM provides isolation
- **Don't hardcode colors** - Use brand tokens
- **Don't create global styles** - Shadow DOM is isolated
- **Don't use inline styles** - Keep in style files
- **Don't put conditionals in views** - All conditionals handled by state machine + CSS

## Example: Complete Todo Style

```json
{
  "$schema": "@schema/style",
  "$id": "@style/todo",
  
  "components": {
    "todoApp": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "var(--spacing-lg)",
      "padding": "var(--spacing-xl)",
      "maxWidth": "800px",
      "margin": "0 auto"
    },
    "header": {
      "marginBottom": "var(--spacing-lg)"
    },
    "inputRow": {
      "display": "flex",
      "gap": "var(--spacing-sm)"
    },
    "todosList": {
      "display": "flex",
      "flexDirection": "column"
    },
    "card": {
      "display": "flex",
      "alignItems": "center",
      "padding": "var(--spacing-sm)",
      "borderBottom": "1px solid var(--color-border)",
      "gap": "var(--spacing-sm)",
      "transition": "all 0.2s",
      ":hover": {
        "backgroundColor": "var(--color-surface)"
      },
      "data": {
        "done": {
          "true": {
            "opacity": "0.6"
          }
        },
        "isDragged": {
          "true": {
            "opacity": "0.3",
            "pointerEvents": "none"
          }
        }
      }
    },
    "body": {
      "flex": "1",
      "color": "var(--color-text)"
    },
    "buttonSmall": {
      "marginLeft": "auto",
      "padding": "var(--spacing-xs) var(--spacing-sm)",
      "color": "var(--color-danger)",
      "backgroundColor": "transparent",
      "border": "none",
      "cursor": "pointer",
      "fontSize": "1.25rem",
      "borderRadius": "var(--border-radius-sm)",
      "transition": "background-color 0.2s",
      ":hover": {
        "backgroundColor": "rgba(239, 68, 68, 0.1)"
      }
    }
  },
  "selectors": {
    "h1": {
      "fontSize": "var(--font-size-h1)",
      "fontWeight": "var(--font-weight-bold)",
      "color": "var(--color-text)",
      "marginBottom": "var(--spacing-md)"
    },
    ".card[data-done=\"true\"] .body": {
      "textDecoration": "line-through",
      "color": "var(--color-text-muted)"
    }
  }
}
```

## Debugging Styles

```javascript
// Inspect actor styles
console.log(actor.styleDef);

// View compiled CSS
const shadowRoot = actor.container.shadowRoot;
const styleElement = shadowRoot.querySelector('style');
console.log(styleElement.textContent);

// Test style changes
styleElement.textContent += `
  .todo-item { background: red; }
`;
```

## Next Steps

- Learn about [Brand](./08-brand.md) - Design system foundation
- Explore [Views](./07-views.md) - How to use style classes
- Understand [Actors](./02-actors.md) - Linking styles to actors
