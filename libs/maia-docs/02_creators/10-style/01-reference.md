      },
      ".input": {
        "padding": "0.5rem",
        "fontSize": "0.875rem"
      },
      ".button": {
        "padding": "0.5rem 1rem",
        "fontSize": "0.875rem",
        "width": "100%"
      }
    }
  }
}
```

### Nested Containers (Advanced)

If you need a nested element to be its own container (e.g., for a sidebar), set `containerType: "inline-size"` in the component definition:

```json
{
  "components": {
    "sidebar": {
      "containerType": "inline-size",
      "width": "300px",
      "display": "flex",
      "flexDirection": "column"
    },
    "sidebarItem": {
      "display": "flex",
      "alignItems": "center",
      "gap": "0.5rem"
    }
  },
  "selectors": {
    "@container (max-width: 250px)": {
      ".sidebar-item": {
        "flexDirection": "column",
        "alignItems": "flex-start"
      }
    }
  }
}
```

### Best Practices

- **Use semantic breakpoints** - `{containers.xs}` instead of hardcoded values like `32rem`
- **Mobile-first approach** - Define base styles for mobile, then override for larger sizes
- **Scale everything** - Not just layout, but also padding, gap, font sizes, etc.
- **Test at all sizes** - Resize your browser from mobile (320px) to desktop (1920px)

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
