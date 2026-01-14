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
  "$type": "style",
  "$id": "style_todo_001",
  
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

**Note:** Use `components` section (not `styles`) for component definitions with nested data-attribute syntax. Use `selectors` section for advanced CSS selectors.

## Linking Style to Actors

In your actor definition:

```json
{
  "$type": "actor",
  "id": "actor_todo_001",
  "styleRef": "brand",         // ← Brand foundation
  "localStyleRef": "todo",     // ← Actor-specific styles (optional)
  "viewRef": "todo",
  "stateRef": "todo"
}
```

**Note:** Currently MaiaOS uses `styleRef` for brand. In v0.5, we'll add `localStyleRef` for actor-specific styles. For now, you can combine them in a single style file.

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

## Common Patterns

### Layout Styles
```json
{
  "styles": {
    ".todo-app": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "var(--spacing-lg)",
      "maxWidth": "800px",
      "margin": "0 auto"
    },
    ".kanban-board": {
      "display": "grid",
      "gridTemplateColumns": "repeat(2, 1fr)",
      "gap": "var(--spacing-md)"
    },
    ".column": {
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

### Animation Styles
```json
{
  "styles": {
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
  "styles": {
    ".btn-primary": {
      "backgroundColor": "#ef4444",  // Override brand primary color
      "borderRadius": "0"             // Override brand border radius
    },
    ".input": {
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
  "styles": {
    ".custom-element": {
      "color": "var(--color-primary)",
      "padding": "var(--spacing-md)",
      "borderRadius": "var(--border-radius-lg)",
      "boxShadow": "var(--shadow-md)"
    }
  }
}
```

Define local custom properties:

```json
{
  "styles": {
    ":host": {
      "--local-accent": "#f59e0b",
      "--local-spacing": "0.75rem"
    },
    ".custom-element": {
      "color": "var(--local-accent)",
      "padding": "var(--local-spacing)"
    }
  }
}
```

## Responsive Styles

```json
{
  "styles": {
    ".todo-app": {
      "padding": "var(--spacing-md)"
    },
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

## Pseudo-classes and Pseudo-elements

```json
{
  "styles": {
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
- **Use `components` section** - For component definitions with nested data syntax
- **Use `selectors` section** - For advanced CSS selectors
- **Keep styles scoped** - Shadow DOM provides isolation
- **Use semantic names** - `todoItem` not `item123`
- **Leverage transitions** - Smooth state changes
- **Support responsive** - Use media queries
- **Use nested data syntax** - For conditional styling via data-attributes

### ❌ DON'T:

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
  "$type": "style",
  "$id": "style_todo_001",
  
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
