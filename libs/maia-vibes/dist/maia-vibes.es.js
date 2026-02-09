import { signInWithPasskey, MaiaOS } from "@MaiaOS/kernel";
import { MaiaOS as MaiaOS2 } from "@MaiaOS/kernel";
const todosVibe = {
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todos",
  "description": "Complete todo list with state machines and AI tools",
  "actor": "@todos/actor/agent"
};
const brandStyle$2 = {
  "$schema": "@schema/style",
  "$id": "@todos/style/brand",
  "tokens": {
    "colors": {
      "marineBlue": "#001F33",
      "marineBlueMuted": "#2D4A5C",
      "marineBlueLight": "#5E7A8C",
      "paradiseWater": "#00BDD6",
      "lushGreen": "#4E9A58",
      "terracotta": "#C27B66",
      "sunYellow": "#E6B94D",
      "softClay": "#E8E1D9",
      "tintedWhite": "#F0EDE6",
      "background": "transparent",
      "foreground": "#001F33",
      "primary": "#00BDD6",
      "secondary": "#2D4A5C",
      "border": "rgba(255, 255, 255, 0.1)",
      "surface": "rgba(255, 255, 255, 0.3)",
      "glass": "rgba(255, 255, 255, 0.0005)",
      "glassStrong": "rgba(255, 255, 255, 0.15)",
      "text": {
        "marine": "#D1E8F7",
        "water": "#004D59",
        "green": "#F0F9F1",
        "terracotta": "#FDF2EF",
        "yellow": "#4D3810"
      }
    },
    "spacing": {
      "xs": "0.5rem",
      "sm": "0.75rem",
      "md": "1rem",
      "lg": "1.5rem",
      "xl": "2rem",
      "2xl": "3rem"
    },
    "typography": {
      "fontFamily": {
        "heading": "'Indie Flower', cursive",
        "body": "'Plus Jakarta Sans', sans-serif"
      },
      "fontWeight": {
        "light": "300",
        "normal": "400",
        "medium": "500",
        "semibold": "600",
        "bold": "700"
      }
    },
    "radii": {
      "sm": "4px",
      "md": "12px",
      "apple": "18px",
      "full": "9999px"
    },
    "shadows": {
      "sm": "0 4px 30px rgba(0, 0, 0, 0.05)",
      "md": "0 10px 30px rgba(0, 0, 0, 0.05)",
      "lg": "0 10px 40px rgba(0, 0, 0, 0.1)"
    },
    "transitions": {
      "fast": "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      "standard": "all 0.5s cubic-bezier(0.2, 0, 0.2, 1)"
    }
  },
  "components": {
    "stack": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "0.25rem",
      "width": "100%",
      "maxWidth": "100%",
      "height": "100vh",
      "background": "{colors.softClay}",
      "padding": "0.375rem",
      "overflowY": "auto",
      "overflowX": "hidden",
      "fontFamily": "{typography.fontFamily.body}",
      "color": "{colors.marineBlue}",
      "boxSizing": "border-box"
    },
    "headerSection": {
      "display": "flex",
      "flexDirection": "column",
      "alignItems": "center",
      "gap": "0.25rem",
      "marginBottom": "0.25rem",
      "width": "100%"
    },
    "todoCategory": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "0.6rem",
      "fontStyle": "italic",
      "color": "{colors.paradiseWater}",
      "marginBottom": "0.25rem",
      "display": "block",
      "textAlign": "center",
      "width": "100%",
      "textShadow": "0 0 10px rgba(0, 189, 214, 0.2)"
    },
    "todoTitle": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "0.9rem",
      "fontWeight": "{typography.fontWeight.bold}",
      "color": "{colors.marineBlue}",
      "margin": "0",
      "marginBottom": "0.375rem",
      "textAlign": "center",
      "width": "100%",
      "letterSpacing": "-0.02em"
    },
    "viewSwitcher": {
      "display": "flex",
      "gap": "0.2rem",
      "background": "rgba(255, 255, 255, 0.2)",
      "padding": "0.15rem",
      "borderRadius": "{radii.full}",
      "margin": "0 auto",
      "border": "1px solid {colors.border}"
    },
    "buttonViewSwitch": {
      "padding": "0.25rem 0.6rem",
      "background": "transparent",
      "border": "none",
      "borderRadius": "{radii.full}",
      "fontSize": "0.55rem",
      "fontWeight": "600",
      "textTransform": "uppercase",
      "letterSpacing": "0.05em",
      "color": "{colors.marineBlueMuted}",
      "cursor": "pointer",
      "transition": "{transitions.fast}",
      "data": {
        "active": {
          "true": {
            "background": "{colors.marineBlue}",
            "color": "{colors.softClay}",
            "boxShadow": "0 4px 12px rgba(0, 31, 51, 0.2)"
          }
        }
      }
    },
    "form": {
      "display": "flex",
      "flexDirection": "row",
      "alignItems": "center",
      "gap": "0.25rem",
      "padding": "0.25rem 0.375rem",
      "background": "rgba(255, 255, 255, 0.4)",
      "backdropFilter": "blur(8px) saturate(150%)",
      "borderRadius": "{radii.full}",
      "border": "1px solid {colors.border}",
      "boxShadow": "{shadows.md}",
      "width": "100%",
      "boxSizing": "border-box",
      "marginBottom": "0.25rem"
    },
    "input": {
      "flex": "1",
      "width": "100%",
      "padding": "0.25rem 0.5rem",
      "border": "none",
      "background": "transparent",
      "fontSize": "0.6rem",
      "color": "{colors.marineBlue}",
      "fontFamily": "{typography.fontFamily.body}",
      "fontWeight": "{typography.fontWeight.light}",
      "outline": "none",
      "minHeight": "0",
      "minWidth": "0",
      "lineHeight": "1.35"
    },
    "button": {
      "width": "auto",
      "padding": "0.25rem 0.5rem",
      "background": "{colors.lushGreen}",
      "color": "{colors.text.green}",
      "border": "none",
      "borderRadius": "{radii.full}",
      "cursor": "pointer",
      "fontSize": "0.5rem",
      "fontWeight": "600",
      "textTransform": "uppercase",
      "letterSpacing": "0.05em",
      "transition": "{transitions.fast}",
      "boxShadow": "0 4px 12px rgba(78, 154, 88, 0.2)",
      "whiteSpace": "nowrap",
      "flexShrink": "0",
      ":hover": {
        "filter": "brightness(1.1)",
        "transform": "translateY(-1px)",
        "boxShadow": "0 6px 16px rgba(78, 154, 88, 0.3)"
      }
    }
  },
  "selectors": {
    ":host": {
      "display": "block",
      "height": "100%",
      "background": "transparent"
    },
    "@container {containerName} (min-width: {containers.xs})": {
      ".stack": {
        "padding": "0.625rem",
        "gap": "0.375rem"
      },
      ".headerSection": {
        "gap": "0.375rem",
        "marginBottom": "0.375rem"
      },
      ".todoCategory": {
        "fontSize": "0.8rem"
      },
      ".todoTitle": {
        "fontSize": "1.15rem"
      },
      ".viewSwitcher": {
        "gap": "0.375rem",
        "padding": "0.25rem",
        "minWidth": "fit-content"
      },
      ".buttonViewSwitch": {
        "padding": "0.4rem 0.8rem",
        "fontSize": "0.7rem"
      },
      ".form": {
        "gap": "0.375rem",
        "padding": "0.375rem 0.5rem"
      },
      ".input": {
        "padding": "0.375rem 0.625rem",
        "fontSize": "0.7rem"
      },
      ".button": {
        "padding": "0.375rem 0.625rem",
        "fontSize": "0.6rem"
      }
    },
    "@container {containerName} (min-width: {containers.sm})": {
      ".stack": {
        "padding": "0.75rem",
        "gap": "0.5rem"
      },
      ".headerSection": {
        "gap": "0.5rem",
        "marginBottom": "0.5rem"
      },
      ".todoCategory": {
        "fontSize": "0.95rem"
      },
      ".todoTitle": {
        "fontSize": "1.3rem"
      },
      ".viewSwitcher": {
        "gap": "0.5rem",
        "padding": "0.3rem",
        "minWidth": "fit-content"
      },
      ".buttonViewSwitch": {
        "padding": "0.4rem 0.8rem",
        "fontSize": "0.7rem"
      },
      ".form": {
        "gap": "0.5rem",
        "padding": "0.5rem 0.625rem"
      },
      ".input": {
        "padding": "0.5rem 0.75rem",
        "fontSize": "0.75rem"
      },
      ".button": {
        "padding": "0.5rem 0.75rem",
        "fontSize": "0.65rem"
      }
    },
    "@container {containerName} (min-width: {containers.md})": {
      ".stack": {
        "padding": "1rem",
        "gap": "0.625rem"
      },
      ".headerSection": {
        "gap": "0.625rem",
        "marginBottom": "0.625rem"
      },
      ".todoCategory": {
        "fontSize": "1.1rem"
      },
      ".todoTitle": {
        "fontSize": "1.45rem"
      },
      ".viewSwitcher": {
        "gap": "0.625rem",
        "padding": "0.375rem",
        "minWidth": "fit-content"
      },
      ".buttonViewSwitch": {
        "padding": "0.6rem 1rem",
        "fontSize": "0.85rem"
      },
      ".form": {
        "gap": "0.625rem",
        "padding": "0.625rem 0.75rem"
      },
      ".input": {
        "padding": "0.625rem 0.875rem",
        "fontSize": "0.8rem"
      },
      ".button": {
        "padding": "0.625rem 0.875rem",
        "fontSize": "0.7rem"
      }
    },
    "@container {containerName} (min-width: {containers.lg})": {
      ".stack": {
        "padding": "1.25rem",
        "gap": "0.75rem"
      },
      ".headerSection": {
        "gap": "0.75rem",
        "marginBottom": "0.75rem"
      },
      ".todoCategory": {
        "fontSize": "1.2rem"
      },
      ".todoTitle": {
        "fontSize": "1.55rem"
      },
      ".viewSwitcher": {
        "gap": "0.75rem",
        "padding": "0.45rem",
        "minWidth": "fit-content"
      },
      ".buttonViewSwitch": {
        "padding": "0.7rem 1.1rem",
        "fontSize": "0.9rem"
      },
      ".form": {
        "gap": "0.75rem",
        "padding": "0.75rem 0.875rem"
      },
      ".input": {
        "padding": "0.75rem 1rem",
        "fontSize": "0.85rem"
      },
      ".button": {
        "padding": "0.75rem 1rem",
        "fontSize": "0.75rem"
      }
    },
    "@container {containerName} (min-width: {containers.xl})": {
      ".stack": {
        "padding": "1.5rem",
        "gap": "0.875rem"
      },
      ".headerSection": {
        "gap": "0.875rem",
        "marginBottom": "0.875rem"
      },
      ".todoCategory": {
        "fontSize": "1.3rem"
      },
      ".todoTitle": {
        "fontSize": "1.65rem"
      },
      ".viewSwitcher": {
        "gap": "0.875rem",
        "padding": "0.5rem",
        "minWidth": "fit-content"
      },
      ".buttonViewSwitch": {
        "padding": "0.8rem 1.2rem",
        "fontSize": "1rem"
      },
      ".form": {
        "gap": "0.875rem",
        "padding": "0.875rem 1rem"
      },
      ".input": {
        "padding": "0.875rem 1.125rem",
        "fontSize": "0.9rem"
      },
      ".button": {
        "padding": "0.875rem 1.125rem",
        "fontSize": "0.8rem"
      }
    },
    "@container {containerName} (min-width: {containers.2xl})": {
      ".stack": {
        "padding": "1.75rem",
        "gap": "1rem"
      },
      ".headerSection": {
        "gap": "1rem",
        "marginBottom": "1rem"
      },
      ".todoCategory": {
        "fontSize": "1.4rem"
      },
      ".todoTitle": {
        "fontSize": "1.75rem"
      },
      ".viewSwitcher": {
        "gap": "1rem",
        "padding": "0.55rem",
        "minWidth": "fit-content"
      },
      ".buttonViewSwitch": {
        "padding": "0.9rem 1.3rem",
        "fontSize": "1.1rem"
      },
      ".form": {
        "gap": "1rem",
        "padding": "1rem 1.125rem"
      },
      ".input": {
        "padding": "1rem 1.25rem",
        "fontSize": "0.95rem"
      },
      ".button": {
        "padding": "1rem 1.25rem",
        "fontSize": "0.85rem"
      }
    }
  }
};
const listStyle = {
  "$schema": "@schema/style",
  "$id": "@todos/style/list",
  "components": {
    "list": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "0.25rem",
      "overflowY": "auto",
      "width": "100%",
      "boxSizing": "border-box",
      "padding": "0.375rem"
    },
    "card": {
      "display": "flex",
      "flexDirection": "column",
      "alignItems": "flex-start",
      "gap": "0.25rem",
      "padding": "0.25rem 0.375rem",
      "background": "rgba(255, 255, 255, 0.3)",
      "backdropFilter": "blur(8px) saturate(150%)",
      "borderRadius": "{radii.apple}",
      "border": "1px solid {colors.border}",
      "transition": "{transitions.fast}",
      "marginBottom": "0.25rem",
      ":hover": {
        "background": "rgba(255, 255, 255, 0.5)",
        "transform": "translateY(-2px)",
        "boxShadow": "{shadows.sm}"
      }
    },
    "body": {
      "flex": "1",
      "fontSize": "0.75rem",
      "fontWeight": "{typography.fontWeight.light}",
      "color": "{colors.marineBlue}",
      "lineHeight": "1.3",
      "width": "100%"
    },
    "buttonSmall": {
      "width": "12px",
      "height": "12px",
      "minWidth": "12px",
      "display": "flex",
      "alignItems": "center",
      "justifyContent": "center",
      "background": "rgba(255, 255, 255, 0.2)",
      "color": "{colors.marineBlueMuted}",
      "border": "1px solid {colors.border}",
      "borderRadius": "{radii.full}",
      "cursor": "pointer",
      "transition": "{transitions.fast}",
      "fontSize": "0.5rem",
      ":hover": {
        "background": "{colors.marineBlue}",
        "color": "{colors.softClay}",
        "borderColor": "{colors.marineBlue}"
      }
    },
    "buttonDanger": {
      ":hover": {
        "background": "{colors.terracotta}",
        "color": "{colors.text.terracotta}",
        "borderColor": "{colors.terracotta}"
      }
    }
  },
  "selectors": {
    "@container {containerName} (min-width: {containers.xs})": {
      ".list": {
        "gap": "0.375rem",
        "padding": "0.5rem"
      },
      ".card": {
        "padding": "0.375rem 0.5rem",
        "gap": "0.375rem"
      },
      ".body": {
        "fontSize": "0.8rem"
      },
      ".buttonSmall": {
        "width": "14px",
        "height": "14px",
        "minWidth": "14px",
        "fontSize": "0.6rem"
      }
    },
    "@container {containerName} (min-width: {containers.sm})": {
      ".list": {
        "gap": "0.5rem",
        "padding": "0.625rem"
      },
      ".card": {
        "flexDirection": "row",
        "alignItems": "center",
        "padding": "0.5rem 0.625rem",
        "gap": "0.5rem"
      },
      ".body": {
        "fontSize": "0.85rem",
        "width": "auto"
      },
      ".buttonSmall": {
        "width": "16px",
        "height": "16px",
        "minWidth": "16px",
        "fontSize": "0.65rem"
      }
    },
    "@container {containerName} (min-width: {containers.md})": {
      ".list": {
        "gap": "0.625rem",
        "padding": "0.75rem"
      },
      ".card": {
        "padding": "0.625rem 0.75rem",
        "gap": "0.625rem"
      },
      ".body": {
        "fontSize": "0.9rem"
      },
      ".buttonSmall": {
        "width": "18px",
        "height": "18px",
        "minWidth": "18px",
        "fontSize": "0.7rem"
      }
    },
    "@container {containerName} (min-width: {containers.lg})": {
      ".list": {
        "gap": "0.75rem",
        "padding": "1rem"
      },
      ".card": {
        "padding": "0.75rem 0.875rem",
        "gap": "0.75rem"
      },
      ".body": {
        "fontSize": "0.95rem"
      },
      ".buttonSmall": {
        "width": "20px",
        "height": "20px",
        "minWidth": "20px",
        "fontSize": "0.75rem"
      }
    },
    "@container {containerName} (min-width: {containers.xl})": {
      ".list": {
        "gap": "0.875rem",
        "padding": "1.25rem"
      },
      ".card": {
        "padding": "0.875rem 1rem",
        "gap": "0.875rem"
      },
      ".body": {
        "fontSize": "1rem",
        "fontWeight": "{typography.fontWeight.medium}"
      },
      ".buttonSmall": {
        "width": "22px",
        "height": "22px",
        "minWidth": "22px",
        "fontSize": "0.8rem"
      },
      ".card:hover": {
        "transform": "translateY(-1px)",
        "boxShadow": "{shadows.md}"
      }
    },
    "@container {containerName} (min-width: {containers.2xl})": {
      ".list": {
        "gap": "1rem",
        "padding": "1.5rem"
      },
      ".card": {
        "padding": "1rem 1.25rem",
        "gap": "1rem"
      },
      ".body": {
        "fontSize": "1.05rem",
        "fontWeight": "{typography.fontWeight.medium}"
      },
      ".buttonSmall": {
        "width": "24px",
        "height": "24px",
        "minWidth": "24px",
        "fontSize": "0.85rem"
      },
      ".card:hover": {
        "transform": "translateY(-2px)",
        "boxShadow": "{shadows.lg}"
      }
    },
    "[data-done=true] .body": {
      "textDecoration": "line-through",
      "opacity": "0.7"
    },
    "[data-done=true]": {
      "opacity": "0.6",
      "background": "rgba(255, 255, 255, 0.1)"
    }
  }
};
const logsStyle = {
  "$schema": "@schema/style",
  "$id": "@todos/style/logs",
  "components": {
    "logs": {
      "padding": "0",
      "margin": "0",
      "background": "transparent",
      "color": "#001F33",
      "fontFamily": "'Plus Jakarta Sans', sans-serif",
      "fontSize": "0.85rem",
      "lineHeight": "1.5"
    },
    "logEntryContainer": {
      "display": "flex",
      "flexDirection": "column",
      "width": "100%",
      "maxWidth": "100%",
      "boxSizing": "border-box",
      "overflow": "hidden"
    },
    "logEntries": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "0.2rem",
      "width": "100%",
      "maxWidth": "100%",
      "boxSizing": "border-box"
    },
    "logEntry": {
      "padding": "0.1rem 0.75rem",
      "margin": "0",
      "background": "rgba(255, 255, 255, 0.4)",
      "backdropFilter": "blur(8px) saturate(150%)",
      "-webkit-backdrop-filter": "blur(8px) saturate(150%)",
      "border": "1px solid rgba(0, 31, 51, 0.05)",
      "borderLeft": "4px solid #00BDD6",
      "borderRadius": "8px",
      "display": "grid",
      "gridTemplateColumns": "auto auto auto 1fr auto",
      "gridTemplateRows": "auto auto",
      "alignItems": "center",
      "minHeight": "1.3rem",
      "transition": "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      "width": "100%",
      "maxWidth": "100%",
      "boxSizing": "border-box",
      "color": "#001F33",
      "position": "relative",
      "boxShadow": "0 2px 8px rgba(0, 0, 0, 0.02)",
      "overflow": "visible",
      ":hover": {
        "background": "rgba(255, 255, 255, 0.6)",
        "transform": "translateX(4px)",
        "boxShadow": "0 4px 12px rgba(0, 0, 0, 0.04)"
      }
    },
    "logType": {
      "color": "#001F33",
      "fontWeight": "700",
      "fontSize": "0.6rem",
      "textTransform": "uppercase",
      "minWidth": "5rem",
      "textAlign": "left",
      "letterSpacing": "0.1em",
      "opacity": "0.8"
    },
    "logSource": {
      "color": "#2D4A5C",
      "fontSize": "0.65rem",
      "fontFamily": "monospace",
      "minWidth": "8rem",
      "flexShrink": "0",
      "fontWeight": "500",
      "display": "flex",
      "alignItems": "center",
      "gap": "0.3rem",
      "background": "rgba(0, 31, 51, 0.05)",
      "padding": "0.1rem 0.4rem",
      "borderRadius": "4px"
    },
    "logSourceRole": {
      "color": "#001F33",
      "fontWeight": "700",
      "textTransform": "lowercase",
      "opacity": "0.6"
    },
    "logSourceId": {
      "color": "#5E7A8C",
      "fontSize": "0.6rem"
    },
    "logTarget": {
      "color": "#2D4A5C",
      "fontSize": "0.65rem",
      "fontFamily": "monospace",
      "minWidth": "8rem",
      "flexShrink": "0",
      "fontWeight": "500",
      "display": "flex",
      "alignItems": "center",
      "gap": "0.3rem",
      "background": "rgba(0, 189, 214, 0.05)",
      "padding": "0.1rem 0.4rem",
      "borderRadius": "4px"
    },
    "logTargetRole": {
      "color": "#004D59",
      "fontWeight": "700",
      "textTransform": "lowercase",
      "opacity": "0.6"
    },
    "logTargetId": {
      "color": "#00BDD6",
      "fontSize": "0.6rem"
    },
    "logPayloadDetails": {
      "display": "contents"
    },
    "logPayloadToggle": {
      "gridColumn": "5",
      "gridRow": "1",
      "color": "#004D59",
      "fontSize": "0.6rem",
      "fontWeight": "700",
      "cursor": "pointer",
      "userSelect": "none",
      "padding": "0.15rem 0.5rem",
      "borderRadius": "9999px",
      "background": "rgba(0, 189, 214, 0.15)",
      "border": "1px solid rgba(0, 189, 214, 0.2)",
      "transition": "all 0.2s ease",
      "textTransform": "uppercase",
      "letterSpacing": "0.05em",
      "justifySelf": "end",
      ":hover": {
        "background": "rgba(0, 189, 214, 0.25)",
        "transform": "scale(1.05)"
      }
    },
    "logPayload": {
      "gridRow": "2",
      "gridColumn": "4 / 6",
      "margin": "0.3rem 0 0.2rem 0",
      "padding": "0.6rem 0.8rem",
      "background": "rgba(0, 31, 51, 0.03)",
      "borderRadius": "8px",
      "border": "1px solid rgba(0, 31, 51, 0.05)",
      "color": "#2D4A5C",
      "fontSize": "0.65rem",
      "fontFamily": "monospace",
      "whiteSpace": "pre-wrap",
      "wordBreak": "break-all",
      "overflow": "auto",
      "maxHeight": "400px",
      "width": "fit-content",
      "minWidth": "180px",
      "maxWidth": "100%",
      "boxSizing": "border-box",
      "boxShadow": "inset 0 2px 4px rgba(0, 0, 0, 0.02)",
      "textAlign": "left",
      "justifySelf": "end",
      "display": "flex",
      "alignItems": "center"
    }
  },
  "selectors": {
    ".log-entry[data-event-type='SUCCESS']": {
      "borderLeftColor": "#4E9A58",
      "background": "rgba(78, 154, 88, 0.05)"
    },
    ".log-entry[data-event-type='ERROR']": {
      "borderLeftColor": "#C27B66",
      "background": "rgba(194, 123, 102, 0.05)"
    },
    ".log-entry[data-event-type='SWITCH_VIEW']": {
      "borderLeftColor": "#00BDD6"
    },
    "summary::-webkit-details-marker": {
      "display": "none"
    },
    "summary::marker": {
      "display": "none"
    },
    "details:not([open]) .log-payload": {
      "display": "none"
    }
  }
};
const agentActor$2 = {
  "$schema": "@schema/actor",
  "$id": "@todos/actor/agent",
  "role": "agent",
  "context": "@todos/context/agent",
  "view": "@todos/view/agent",
  "state": "@todos/state/agent",
  "brand": "@todos/style/brand",
  "inbox": "@todos/inbox/agent",
  "messageTypes": [
    "CREATE_BUTTON",
    "TOGGLE_BUTTON",
    "DELETE_BUTTON",
    "UPDATE_INPUT",
    "SWITCH_VIEW",
    "SUCCESS",
    "ERROR"
  ]
};
const listActor = {
  "$schema": "@schema/actor",
  "$id": "@todos/actor/list",
  "role": "todo-list",
  "context": "@todos/context/list",
  "view": "@todos/view/list",
  "state": "@todos/state/list",
  "brand": "@todos/style/brand",
  "style": "@todos/style/list",
  "inbox": "@todos/inbox/list",
  "messageTypes": [
    "TOGGLE_BUTTON",
    "DELETE_BUTTON",
    "SUCCESS",
    "RETRY",
    "DISMISS"
  ]
};
const logsActor = {
  "$schema": "@schema/actor",
  "$id": "@todos/actor/logs",
  "role": "logs",
  "context": "@todos/context/logs",
  "view": "@todos/view/logs",
  "state": "@todos/state/logs",
  "brand": "@todos/style/brand",
  "style": "@todos/style/logs",
  "inbox": "@todos/inbox/logs",
  "messageTypes": [
    "RETRY",
    "DISMISS"
  ]
};
const agentView$2 = {
  "$schema": "@schema/view",
  "$id": "@todos/view/agent",
  "content": {
    "tag": "div",
    "class": "stack",
    "children": [
      {
        "tag": "div",
        "class": "header-section",
        "children": [
          {
            "tag": "h2",
            "class": "todo-title",
            "text": "Daily Focus"
          },
          {
            "tag": "div",
            "class": "view-switcher",
            "children": [
              {
                "tag": "button",
                "class": "button-view-switch",
                "attrs": {
                  "data-view": "list",
                  "data": {
                    "active": "$listButtonActive"
                  }
                },
                "text": "$listViewLabel",
                "$on": {
                  "click": {
                    "send": "SWITCH_VIEW",
                    "payload": { "viewMode": "list" }
                  }
                }
              },
              {
                "tag": "button",
                "class": "button-view-switch",
                "attrs": {
                  "data-view": "logs",
                  "data": {
                    "active": "$logsButtonActive"
                  }
                },
                "text": "$logsViewLabel",
                "$on": {
                  "click": {
                    "send": "SWITCH_VIEW",
                    "payload": { "viewMode": "logs" }
                  }
                }
              }
            ]
          }
        ]
      },
      {
        "class": "form",
        "children": [
          {
            "tag": "input",
            "class": "input",
            "attrs": {
              "type": "text",
              "placeholder": "$inputPlaceholder"
            },
            "value": "$newTodoText",
            "$on": {
              "input": {
                "send": "UPDATE_INPUT",
                "payload": { "newTodoText": "@inputValue" }
              },
              "blur": {
                "send": "UPDATE_INPUT",
                "payload": { "newTodoText": "@inputValue" }
              },
              "keydown": {
                "send": "CREATE_BUTTON",
                "payload": { "text": "@inputValue" },
                "key": "Enter"
              }
            }
          },
          {
            "tag": "button",
            "class": "button",
            "text": "$addButtonText",
            "$on": {
              "click": {
                "send": "CREATE_BUTTON",
                "payload": { "text": "$newTodoText" }
              }
            }
          }
        ]
      },
      {
        "tag": "main",
        "class": "content-area",
        "$slot": "$currentView"
      }
    ]
  }
};
const listView = {
  "$schema": "@schema/view",
  "$id": "@todos/view/list",
  "content": {
    "class": "list",
    "$each": {
      "items": "$list",
      "template": {
        "class": "card",
        "attrs": {
          "data-done": "$$done"
        },
        "children": [
          {
            "tag": "span",
            "class": "body",
            "text": "$$text"
          },
          {
            "tag": "button",
            "class": "button-small",
            "text": "✓",
            "$on": {
              "click": {
                "send": "TOGGLE_BUTTON",
                "payload": { "id": "$$id", "done": "$$done" }
              }
            }
          },
          {
            "tag": "button",
            "class": "button-small button-danger",
            "text": "$deleteButtonText",
            "$on": {
              "click": {
                "send": "DELETE_BUTTON",
                "payload": { "id": "$$id" }
              }
            }
          }
        ]
      }
    }
  }
};
const logsView = {
  "$schema": "@schema/view",
  "$id": "@todos/view/logs",
  "content": {
    "class": "logs",
    "attrs": {
      "data": "log-viewer"
    },
    "children": [
      {
        "tag": "div",
        "class": "log-entries",
        "$each": {
          "items": "$messages",
          "template": {
            "class": "log-entry-container",
            "children": [
              {
                "tag": "div",
                "class": "log-entry",
                "attrs": {
                  "data": {
                    "eventType": "$$type",
                    "processed": "$$processed"
                  }
                },
                "children": [
                  {
                    "tag": "span",
                    "class": "log-type",
                    "text": "$$type"
                  },
                  {
                    "tag": "span",
                    "class": "log-source",
                    "children": [
                      {
                        "tag": "span",
                        "class": "log-source-role",
                        "text": "$$fromRole"
                      },
                      {
                        "tag": "span",
                        "class": "log-source-id",
                        "text": "$$fromId"
                      }
                    ]
                  },
                  {
                    "tag": "span",
                    "class": "log-target",
                    "children": [
                      {
                        "tag": "span",
                        "class": "log-target-role",
                        "text": "$$recipient"
                      },
                      {
                        "tag": "span",
                        "class": "log-target-id",
                        "text": "$$targetId"
                      }
                    ]
                  },
                  {
                    "tag": "details",
                    "class": "log-payload-details",
                    "children": [
                      {
                        "tag": "summary",
                        "class": "log-payload-toggle",
                        "text": "$payloadLabel"
                      },
                      {
                        "tag": "pre",
                        "class": "log-payload",
                        "text": "$$payload"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    ]
  }
};
const agentContext$2 = {
  "$schema": "@schema/context",
  "$id": "@todos/context/agent",
  "currentView": "@list",
  "viewMode": "list",
  "listButtonActive": true,
  "logsButtonActive": false,
  "inputPlaceholder": "Add a new todo...",
  "addButtonText": "Add",
  "listViewLabel": "List",
  "logsViewLabel": "Logs",
  "newTodoText": "",
  "error": null,
  "@actors": {
    "list": "@todos/actor/list",
    "logs": "@todos/actor/logs"
  }
};
const listContext = {
  "$schema": "@schema/context",
  "$id": "@todos/context/list",
  "list": {
    "schema": "@schema/data/todos"
  },
  "toggleButtonText": "✓",
  "deleteButtonText": "✕"
};
const logsContext = {
  "$schema": "@schema/context",
  "$id": "@todos/context/logs",
  "messages": {
    "schema": "@schema/message",
    "options": {
      "map": {
        "fromRole": "$$source.role",
        "toRole": "$$target.role",
        "fromId": "$$source.id",
        "toId": "$$target.id"
      }
    }
  },
  "payloadLabel": "payload"
};
const agentState$2 = {
  "$schema": "@schema/state",
  "$id": "@todos/state/agent",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "CREATE_BUTTON": {
          "target": "creating"
        },
        "TOGGLE_BUTTON": {
          "target": "toggling"
        },
        "DELETE_BUTTON": {
          "target": "deleting"
        },
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "viewMode": "$$viewMode" }
            },
            {
              "updateContext": {
                "currentView": {
                  "$if": {
                    "condition": { "$eq": ["$$viewMode", "list"] },
                    "then": "@list",
                    "else": "@logs"
                  }
                }
              }
            },
            {
              "updateContext": {
                "listButtonActive": {
                  "$eq": ["$$viewMode", "list"]
                }
              }
            },
            {
              "updateContext": {
                "logsButtonActive": {
                  "$eq": ["$$viewMode", "logs"]
                }
              }
            }
          ]
        },
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "newTodoText": "$$newTodoText" }
            }
          ]
        }
      }
    },
    "creating": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "create",
          "schema": "@schema/data/todos",
          "data": { "text": "$$text", "done": false }
        }
      },
      "on": {
        "UPDATE_INPUT": {
          "target": "idle"
        },
        "CREATE_BUTTON": {
          "target": "creating"
        },
        "TOGGLE_BUTTON": {
          "target": "toggling"
        },
        "DELETE_BUTTON": {
          "target": "deleting"
        },
        "SWITCH_VIEW": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "viewMode": "$$viewMode" }
            },
            {
              "updateContext": {
                "currentView": {
                  "$if": {
                    "condition": { "$eq": ["$$viewMode", "list"] },
                    "then": "@list",
                    "else": "@logs"
                  }
                }
              }
            },
            {
              "updateContext": {
                "listButtonActive": {
                  "$eq": ["$$viewMode", "list"]
                }
              }
            },
            {
              "updateContext": {
                "logsButtonActive": {
                  "$eq": ["$$viewMode", "logs"]
                }
              }
            }
          ]
        },
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "newTodoText": "" }
            }
          ]
        },
        "ERROR": "error"
      }
    },
    "toggling": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "update",
          "id": "$$id",
          "data": {
            "done": {
              "$not": "$$done"
            }
          }
        }
      },
      "on": {
        "TOGGLE_BUTTON": {
          "target": "toggling"
        },
        "DELETE_BUTTON": {
          "target": "deleting"
        },
        "UPDATE_INPUT": {
          "target": "idle"
        },
        "CREATE_BUTTON": {
          "target": "creating"
        },
        "SWITCH_VIEW": {
          "target": "idle"
        },
        "SUCCESS": {
          "target": "idle"
        },
        "ERROR": "error"
      }
    },
    "deleting": {
      "entry": {
        "tool": "@db",
        "payload": {
          "op": "delete",
          "id": "$$id"
        }
      },
      "on": {
        "DELETE_BUTTON": {
          "target": "deleting"
        },
        "UPDATE_INPUT": {
          "target": "idle"
        },
        "CREATE_BUTTON": {
          "target": "creating"
        },
        "SWITCH_VIEW": {
          "target": "idle"
        },
        "TOGGLE_BUTTON": {
          "target": "toggling"
        },
        "SUCCESS": {
          "target": "idle"
        },
        "ERROR": {
          "target": "error"
        }
      }
    },
    "error": {
      "entry": {
        "updateContext": { "error": "$$error" }
      },
      "on": {
        "TOGGLE_BUTTON": {
          "target": "toggling"
        },
        "DELETE_BUTTON": {
          "target": "deleting"
        },
        "RETRY": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "error": null }
            }
          ]
        },
        "DISMISS": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "error": null }
            }
          ]
        }
      }
    }
  }
};
const listState = {
  "$schema": "@schema/state",
  "$id": "@todos/state/list",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "TOGGLE_BUTTON": {
          "target": "idle",
          "actions": [
            {
              "tool": "@core/publishMessage",
              "payload": {
                "type": "TOGGLE_BUTTON",
                "payload": { "id": "$$id", "done": "$$done" },
                "target": "@todos/actor/agent"
              }
            }
          ]
        },
        "DELETE_BUTTON": {
          "target": "idle",
          "actions": [
            {
              "tool": "@core/publishMessage",
              "payload": {
                "type": "DELETE_BUTTON",
                "payload": { "id": "$$id" },
                "target": "@todos/actor/agent"
              }
            }
          ]
        },
        "SUCCESS": {
          "target": "idle"
        }
      }
    },
    "error": {
      "entry": {
        "updateContext": { "error": "$$error" }
      },
      "on": {
        "RETRY": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "error": null }
            }
          ]
        },
        "DISMISS": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "error": null }
            }
          ]
        }
      }
    }
  }
};
const logsState = {
  "$schema": "@schema/state",
  "$id": "@todos/state/logs",
  "initial": "idle",
  "states": {
    "idle": {},
    "error": {
      "entry": {
        "updateContext": { "error": "$$error" }
      },
      "on": {
        "RETRY": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "error": null }
            }
          ]
        },
        "DISMISS": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "error": null }
            }
          ]
        }
      }
    }
  }
};
const agentInbox$2 = {
  "$schema": "@schema/inbox",
  "$id": "@todos/inbox/agent",
  "items": []
};
const listInbox = {
  "$schema": "@schema/inbox",
  "$id": "@todos/inbox/list",
  "items": []
};
const logsInbox = {
  "$schema": "@schema/inbox",
  "$id": "@todos/inbox/logs",
  "items": []
};
const TodosVibeRegistry = {
  vibe: todosVibe,
  styles: {
    "@todos/style/brand": brandStyle$2,
    "@todos/style/list": listStyle,
    "@todos/style/logs": logsStyle
  },
  actors: {
    "@todos/actor/agent": agentActor$2,
    "@todos/actor/list": listActor,
    "@todos/actor/logs": logsActor
  },
  views: {
    "@todos/view/agent": agentView$2,
    "@todos/view/list": listView,
    "@todos/view/logs": logsView
  },
  contexts: {
    "@todos/context/agent": agentContext$2,
    "@todos/context/list": listContext,
    "@todos/context/logs": logsContext
  },
  states: {
    "@todos/state/agent": agentState$2,
    "@todos/state/list": listState,
    "@todos/state/logs": logsState
  },
  inboxes: {
    "@todos/inbox/agent": agentInbox$2,
    "@todos/inbox/list": listInbox,
    "@todos/inbox/logs": logsInbox
  },
  // Note: Children are now stored in context.actors (not separate children CoList files)
  // See agent.context.maia and composite.context.maia for children definitions
  // Initial data for seeding (creates individual todo CoMap items)
  // NOTE: These todos are automatically indexed into account.os.{schemaCoId} via storage hooks
  // The read() query reads from account.os.{schemaCoId}, NOT from account.data.todos (which is deprecated)
  data: {
    todos: [
      {
        text: "Welcome to MaiaOS! 🎉",
        done: false
      },
      {
        text: "Toggle me to mark as complete",
        done: false
      }
    ]
  }
};
const registry$2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  TodosVibeRegistry
}, Symbol.toStringTag, { value: "Module" }));
async function loadTodosVibe(container) {
  console.log("🚀 Booting MaiaOS for Todos Vibe...");
  let os;
  const checkForExistingSession = () => {
    if (window.maia && window.maia.id && window.maia.id.node && window.maia.id.maiaId) {
      return window.maia;
    }
    try {
      if (window.parent && window.parent !== window && window.parent.maia) {
        return window.parent.maia;
      }
    } catch (e) {
    }
    try {
      if (window.opener && window.opener.maia) {
        return window.opener.maia;
      }
    } catch (e) {
    }
    return null;
  };
  const existingSession = checkForExistingSession();
  if (existingSession) {
    console.log("ℹ️  Reusing existing MaiaOS session from main app");
    os = existingSession;
  } else {
    console.log("ℹ️  No existing session found, creating new authentication");
    const { node, account } = await signInWithPasskey({ salt: "maia.city" });
    os = await MaiaOS.boot({
      node,
      account,
      modules: ["db", "core"],
      // db module provides @db tool
      registry: TodosVibeRegistry
      // Registry passed but seeding skipped for CoJSON backend
    });
  }
  const { vibe, actor: todoActor } = await os.loadVibeFromAccount(
    "todos",
    // Vibe key in account.vibes
    container
  );
  return { os, vibe, actor: todoActor };
}
const myDataVibe = {
  "$schema": "@schema/vibe",
  "$id": "@vibe/my-data",
  "name": "MaiaDB",
  "description": "Database viewer with navigation and detail panels",
  "actor": "@my-data/actor/agent"
};
const brandStyle$1 = {
  "$schema": "@schema/style",
  "$id": "@my-data/style/brand",
  "tokens": {
    "colors": {
      "marineBlue": "#001F33",
      "marineBlueMuted": "#2D4A5C",
      "marineBlueLight": "#5E7A8C",
      "paradiseWater": "#00BDD6",
      "lushGreen": "#4E9A58",
      "terracotta": "#C27B66",
      "sunYellow": "#E6B94D",
      "softClay": "#E8E1D9",
      "tintedWhite": "#F0EDE6",
      "background": "#E8E1D9",
      "foreground": "#001F33",
      "primary": "#00BDD6",
      "secondary": "#2D4A5C",
      "border": "rgba(255, 255, 255, 0.1)",
      "surface": "rgba(255, 255, 255, 0.3)",
      "glass": "rgba(255, 255, 255, 0.0005)",
      "glassStrong": "rgba(255, 255, 255, 0.15)",
      "text": {
        "marine": "#D1E8F7",
        "water": "#004D59",
        "green": "#F0F9F1",
        "terracotta": "#FDF2EF",
        "yellow": "#4D3810"
      }
    },
    "spacing": {
      "xs": "0.5rem",
      "sm": "0.75rem",
      "md": "1rem",
      "lg": "1.5rem",
      "xl": "2rem",
      "2xl": "3rem"
    },
    "typography": {
      "fontFamily": {
        "heading": "'Indie Flower', cursive",
        "body": "'Plus Jakarta Sans', sans-serif"
      },
      "fontFaces": [
        {
          "fontFamily": "Indie Flower",
          "src": "url('/brand/fonts/IndieFlower/IndieFlower-Regular.ttf') format('truetype')",
          "fontWeight": "400",
          "fontStyle": "normal",
          "fontDisplay": "swap"
        },
        {
          "fontFamily": "Plus Jakarta Sans",
          "src": "url('/brand/fonts/Jarkata/PlusJakartaSans-VariableFont_wght.ttf') format('truetype')",
          "fontWeight": "100 900",
          "fontStyle": "normal",
          "fontDisplay": "swap"
        }
      ],
      "fontSize": {
        "xs": "0.75rem",
        "sm": "0.85rem",
        "base": "1rem",
        "lg": "1.15rem",
        "xl": "1.5rem",
        "2xl": "2rem"
      },
      "fontWeight": {
        "light": "300",
        "normal": "400",
        "medium": "500",
        "semibold": "600",
        "bold": "700"
      }
    },
    "radii": {
      "sm": "4px",
      "md": "12px",
      "apple": "18px",
      "full": "9999px"
    },
    "shadows": {
      "sm": "0 4px 30px rgba(0, 0, 0, 0.05)",
      "md": "0 10px 30px rgba(0, 0, 0, 0.05)",
      "lg": "0 10px 40px rgba(0, 0, 0, 0.1)"
    },
    "transitions": {
      "fast": "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      "standard": "all 0.5s cubic-bezier(0.2, 0, 0.2, 1)"
    }
  },
  "components": {
    "dbViewer": {
      "display": "grid",
      "gridTemplateColumns": "220px 1fr 400px",
      "height": "100vh",
      "width": "100%",
      "background": "transparent",
      "fontFamily": "{typography.fontFamily.body}",
      "color": "{colors.marineBlue}",
      "position": "relative",
      "overflow": "hidden",
      "padding": "{spacing.md}",
      "gap": "{spacing.md}"
    },
    "navAside": {
      "background": "rgba(255, 255, 255, 0.4)",
      "backdropFilter": "blur(12px) saturate(160%)",
      "borderRadius": "{radii.apple}",
      "border": "1px solid rgba(255, 255, 255, 0.2)",
      "boxShadow": "{shadows.md}",
      "padding": "{spacing.md}",
      "overflowY": "auto",
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.md}",
      "zIndex": "10",
      "height": "fit-content",
      "maxHeight": "100%",
      "position": "relative"
    },
    "sidebarToggle": {
      "display": "none",
      "alignItems": "center",
      "justifyContent": "center",
      "width": "100%",
      "padding": "{spacing.sm}",
      "background": "rgba(255, 255, 255, 0.2)",
      "border": "1px solid rgba(255, 255, 255, 0.2)",
      "borderRadius": "{radii.md}",
      "cursor": "pointer",
      "marginBottom": "{spacing.sm}",
      "fontSize": "0.7rem",
      "fontWeight": "700",
      "textTransform": "uppercase",
      "color": "{colors.marineBlue}",
      "fontFamily": "{typography.fontFamily.body}",
      "transition": "{transitions.fast}",
      ":hover": {
        "background": "rgba(255, 255, 255, 0.4)"
      }
    },
    "detailContentWrapper": {
      "display": "flex",
      "flexDirection": "column",
      "height": "100%",
      "overflowY": "auto"
    },
    "navTitle": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "{typography.fontSize.lg}",
      "fontWeight": "{typography.fontWeight.normal}",
      "fontStyle": "normal",
      "color": "{colors.marineBlue}",
      "marginBottom": "{spacing.sm}",
      "marginTop": "0",
      "padding": "0 {spacing.xs}",
      "letterSpacing": "-0.02em"
    },
    "navList": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.sm}"
    },
    "navCategory": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.sm}"
    },
    "navCategoryDivider": {
      "fontFamily": "{typography.fontFamily.body}",
      "fontSize": "0.6rem",
      "fontWeight": "700",
      "textTransform": "uppercase",
      "letterSpacing": "0.15em",
      "color": "{colors.marineBlueLight}",
      "padding": "0.5rem {spacing.xs} 0.25rem {spacing.xs}",
      "marginTop": "{spacing.sm}",
      "marginBottom": "0"
    },
    "navItem": {
      "display": "flex",
      "alignItems": "center",
      "width": "100%",
      "padding": "0.6rem 1.2rem",
      "marginBottom": "{spacing.xs}",
      "background": "rgba(255, 255, 255, 0.1)",
      "backdropFilter": "blur(8px) saturate(150%)",
      "border": "none",
      "borderRadius": "{radii.full}",
      "cursor": "pointer",
      "transition": "{transitions.fast}",
      "fontFamily": "{typography.fontFamily.body}",
      "fontSize": "0.75rem",
      "fontWeight": "{typography.fontWeight.semibold}",
      "color": "{colors.marineBlueMuted}",
      "textAlign": "left",
      "textTransform": "uppercase",
      "letterSpacing": "0.05em",
      "boxShadow": "0 2px 8px rgba(0, 0, 0, 0.05)",
      ":hover": {
        "background": "rgba(255, 255, 255, 0.2)",
        "color": "{colors.marineBlue}",
        "transform": "translateX(2px)",
        "boxShadow": "0 4px 12px rgba(0, 0, 0, 0.1)"
      }
    },
    "tableArea": {
      "overflowY": "auto",
      "display": "flex",
      "flexDirection": "column",
      "zIndex": "5",
      "containerType": "inline-size",
      "background": "transparent",
      "padding": "0"
    },
    "tableContainer": {
      "background": "rgba(255, 255, 255, 0.4)",
      "backdropFilter": "blur(12px) saturate(160%)",
      "borderRadius": "{radii.apple}",
      "boxShadow": "{shadows.md}",
      "overflow": "auto",
      "border": "1px solid rgba(255, 255, 255, 0.2)",
      "transition": "{transitions.standard}",
      "height": "100%",
      "display": "flex",
      "flexDirection": "column",
      "padding": "{spacing.md}"
    },
    "dataTable": {
      "width": "100%",
      "borderCollapse": "separate",
      "borderSpacing": "0",
      "fontFamily": "{typography.fontFamily.body}",
      "fontSize": "{typography.fontSize.sm}"
    },
    "dataTable th": {
      "background": "rgba(255, 255, 255, 0.4)",
      "padding": "{spacing.lg}",
      "textAlign": "left",
      "fontWeight": "700",
      "color": "{colors.marineBlue}",
      "borderBottom": "1px solid {colors.border}",
      "textTransform": "uppercase",
      "letterSpacing": "0.12em",
      "fontSize": "0.65rem"
    },
    "dataTable td": {
      "padding": "{spacing.lg}",
      "borderBottom": "1px solid {colors.border}",
      "color": "{colors.marineBlueMuted}",
      "transition": "{transitions.fast}",
      "fontSize": "{typography.fontSize.sm}",
      "fontWeight": "{typography.fontWeight.light}"
    },
    "tableRow": {
      "cursor": "pointer",
      "transition": "{transitions.fast}",
      ":hover": {
        "background": "rgba(255, 255, 255, 0.5)"
      }
    },
    "detailAside": {
      "overflowY": "auto",
      "display": "flex",
      "flexDirection": "column",
      "zIndex": "10",
      "containerType": "inline-size",
      "background": "transparent",
      "padding": "0"
    },
    "detailContainer": {
      "background": "rgba(255, 255, 255, 0.4)",
      "backdropFilter": "blur(12px) saturate(160%)",
      "borderRadius": "{radii.apple}",
      "boxShadow": "{shadows.md}",
      "overflow": "auto",
      "border": "1px solid rgba(255, 255, 255, 0.2)",
      "transition": "{transitions.standard}",
      "height": "100%",
      "display": "flex",
      "flexDirection": "column",
      "padding": "{spacing.md}"
    },
    "detailTitle": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "{typography.fontSize.xl}",
      "fontWeight": "{typography.fontWeight.bold}",
      "color": "{colors.marineBlue}",
      "marginBottom": "{spacing.md}",
      "marginTop": "0",
      "letterSpacing": "-0.02em"
    },
    "detailCategory": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "0.85rem",
      "fontStyle": "italic",
      "color": "{colors.paradiseWater}",
      "marginBottom": "0.5rem",
      "display": "block",
      "textShadow": "0 0 10px rgba(0, 189, 214, 0.2)"
    },
    "detailList": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.sm}"
    },
    "detailItem": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "0.15rem",
      "padding": "{spacing.md}",
      "background": "rgba(255, 255, 255, 0.2)",
      "borderRadius": "{radii.md}",
      "border": "1px solid {colors.border}",
      "transition": "{transitions.fast}",
      ":hover": {
        "background": "rgba(255, 255, 255, 0.4)",
        "transform": "translateY(-2px)",
        "boxShadow": "{shadows.sm}"
      }
    },
    "detailLabel": {
      "fontSize": "0.65rem",
      "textTransform": "uppercase",
      "letterSpacing": "0.08em",
      "color": "{colors.marineBlueLight}",
      "fontWeight": "700"
    },
    "detailValue": {
      "fontSize": "{typography.fontSize.base}",
      "color": "{colors.marineBlue}",
      "fontWeight": "{typography.fontWeight.light}"
    }
  },
  "selectors": {
    ":host": {
      "position": "relative",
      "background": "transparent",
      "fontFamily": "{typography.fontFamily.body}",
      "color": "{colors.foreground}"
    },
    ".nav-item[data-selected='true']": {
      "background": "rgba(0, 189, 214, 0.2)",
      "backdropFilter": "blur(12px) saturate(160%)",
      "color": "{colors.marineBlue}",
      "fontWeight": "{typography.fontWeight.semibold}",
      "boxShadow": "0 4px 12px rgba(0, 189, 214, 0.2)",
      "transform": "translateX(2px)",
      "textShadow": "0 0 10px rgba(0, 189, 214, 0.3)",
      "marginBottom": "{spacing.xs}"
    },
    ".nav-item:last-child": {
      "marginBottom": "0"
    },
    ".nav-category:first-child .nav-category-divider": {
      "marginTop": "0"
    },
    ".table-row[data-selected='true']": {
      "background": "rgba(0, 189, 214, 0.15)",
      "color": "{colors.marineBlue}",
      "backdropFilter": "blur(4px)"
    },
    "@container (max-width: 1000px)": {
      ".db-viewer": {
        "gridTemplateColumns": "180px 1fr 300px"
      }
    },
    "@container (max-width: 700px)": {
      ".db-viewer": {
        "gridTemplateColumns": "1fr",
        "gridTemplateRows": "auto 1fr auto",
        "position": "relative",
        "overflow": "hidden"
      },
      ".sidebar-toggle": {
        "display": "flex"
      },
      ".nav-aside": {
        "position": "absolute",
        "left": "0",
        "top": "0",
        "bottom": "0",
        "width": "280px",
        "maxWidth": "85vw",
        "zIndex": "100",
        "transform": "translateX(-100%)",
        "opacity": "0",
        "pointerEvents": "none",
        "transition": "none",
        "boxShadow": "2px 0 20px rgba(0, 0, 0, 0.1)"
      },
      ".nav-aside.sidebar-ready": {
        "transition": "{transitions.standard}"
      },
      ".nav-aside:not(.collapsed)": {
        "transform": "translateX(0)",
        "opacity": "1",
        "pointerEvents": "auto"
      },
      ".detail-aside": {
        "position": "absolute",
        "right": "0",
        "top": "0",
        "bottom": "0",
        "width": "320px",
        "maxWidth": "85vw",
        "zIndex": "100",
        "transform": "translateX(100%)",
        "opacity": "0",
        "pointerEvents": "none",
        "transition": "none",
        "boxShadow": "-2px 0 20px rgba(0, 0, 0, 0.1)"
      },
      ".detail-aside.sidebar-ready": {
        "transition": "{transitions.standard}"
      },
      ".detail-aside:not(.collapsed)": {
        "transform": "translateX(0)",
        "opacity": "1",
        "pointerEvents": "auto"
      },
      ".nav-aside.collapsed": {
        "transform": "translateX(-100%)",
        "opacity": "0",
        "pointerEvents": "none"
      },
      ".detail-aside.collapsed": {
        "transform": "translateX(100%)",
        "opacity": "0",
        "pointerEvents": "none"
      },
      ".nav-aside.collapsed .nav-title": {
        "display": "none"
      },
      ".nav-aside.collapsed .nav-list": {
        "display": "none"
      },
      ".detail-aside.collapsed .detail-content-wrapper": {
        "display": "none"
      }
    }
  }
};
const agentActor$1 = {
  "$schema": "@schema/actor",
  "$id": "@my-data/actor/agent",
  "role": "agent",
  "context": "@my-data/context/agent",
  "view": "@my-data/view/agent",
  "state": "@my-data/state/agent",
  "brand": "@my-data/style/brand",
  "inbox": "@my-data/inbox/agent",
  "messageTypes": [
    "SELECT_NAV",
    "SELECT_ROW"
  ]
};
const tableActor = {
  "$schema": "@schema/actor",
  "$id": "@my-data/actor/table",
  "role": "ui",
  "context": "@my-data/context/table",
  "view": "@my-data/view/table",
  "state": "@my-data/state/table",
  "brand": "@my-data/style/brand",
  "inbox": "@my-data/inbox/table",
  "messageTypes": [
    "SELECT_ROW"
  ]
};
const detailActor = {
  "$schema": "@schema/actor",
  "$id": "@my-data/actor/detail",
  "role": "ui",
  "context": "@my-data/context/detail",
  "view": "@my-data/view/detail",
  "state": "@my-data/state/detail",
  "brand": "@my-data/style/brand",
  "inbox": "@my-data/inbox/detail",
  "messageTypes": []
};
const agentView$1 = {
  "$schema": "@schema/view",
  "$id": "@my-data/view/agent",
  "content": {
    "tag": "div",
    "class": "db-viewer",
    "children": [
      {
        "tag": "aside",
        "class": "nav-aside",
        "children": [
          {
            "tag": "button",
            "class": "sidebar-toggle nav-toggle",
            "attrs": {
              "aria-label": "Toggle navigation sidebar"
            },
            "text": "Navigation"
          },
          {
            "tag": "h2",
            "class": "nav-title",
            "text": "$navTitle"
          },
          {
            "tag": "nav",
            "class": "nav-list",
            "children": [
              {
                "$each": {
                  "items": "$navCategories",
                  "template": {
                    "tag": "div",
                    "class": "nav-category",
                    "children": [
                      {
                        "tag": "div",
                        "class": "nav-category-divider",
                        "text": "$$category"
                      },
                      {
                        "$each": {
                          "items": "$$items",
                          "template": {
                            "tag": "button",
                            "class": "nav-item",
                            "attrs": {
                              "data": {
                                "selected": "$selectedNavItems.$$id"
                              }
                            },
                            "children": [
                              {
                                "tag": "span",
                                "class": "nav-label",
                                "text": "$$label"
                              }
                            ],
                            "$on": {
                              "click": {
                                "send": "SELECT_NAV",
                                "payload": { "navId": "$$id" }
                              }
                            }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        ]
      },
      {
        "tag": "main",
        "class": "table-area",
        "$slot": "$currentTable"
      },
      {
        "tag": "aside",
        "class": "detail-aside",
        "children": [
          {
            "tag": "button",
            "class": "sidebar-toggle detail-toggle",
            "attrs": {
              "aria-label": "Toggle detail sidebar"
            },
            "text": "Details"
          },
          {
            "tag": "div",
            "class": "detail-content-wrapper",
            "$slot": "$currentDetail"
          }
        ]
      }
    ]
  }
};
const tableView = {
  "$schema": "@schema/view",
  "$id": "@my-data/view/table",
  "content": {
    "tag": "div",
    "class": "table-container",
    "children": [
      {
        "tag": "table",
        "class": "data-table",
        "children": [
          {
            "tag": "thead",
            "children": [
              {
                "tag": "tr",
                "children": [
                  {
                    "tag": "th",
                    "text": "$tableHeaders.name"
                  },
                  {
                    "tag": "th",
                    "text": "$tableHeaders.email"
                  },
                  {
                    "tag": "th",
                    "text": "$tableHeaders.role"
                  },
                  {
                    "tag": "th",
                    "text": "$tableHeaders.status"
                  },
                  {
                    "tag": "th",
                    "text": "$tableHeaders.createdAt"
                  }
                ]
              }
            ]
          },
          {
            "tag": "tbody",
            "$each": {
              "items": "$table",
              "template": {
                "tag": "tr",
                "class": "table-row",
                "attrs": {
                  "data": {
                    "selected": "$selectedRowItems.$$id"
                  }
                },
                "children": [
                  {
                    "tag": "td",
                    "text": "$$name"
                  },
                  {
                    "tag": "td",
                    "text": "$$email"
                  },
                  {
                    "tag": "td",
                    "text": "$$role"
                  },
                  {
                    "tag": "td",
                    "text": "$$status"
                  },
                  {
                    "tag": "td",
                    "text": "$$createdAt"
                  }
                ],
                "$on": {
                  "click": {
                    "send": "SELECT_ROW",
                    "payload": { "rowId": "$$id" }
                  }
                }
              }
            }
          }
        ]
      }
    ]
  }
};
const detailView = {
  "$schema": "@schema/view",
  "$id": "@my-data/view/detail",
  "content": {
    "tag": "div",
    "class": "detail-container",
    "children": [
      {
        "tag": "span",
        "class": "detail-category",
        "text": "Metadata"
      },
      {
        "tag": "h2",
        "class": "detail-title",
        "text": "Entity Insight"
      },
      {
        "tag": "div",
        "class": "detail-list",
        "children": [
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.id" },
              { "tag": "span", "class": "detail-value", "text": "$detail.id" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.name" },
              { "tag": "span", "class": "detail-value", "text": "$detail.name" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.email" },
              { "tag": "span", "class": "detail-value", "text": "$detail.email" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.role" },
              { "tag": "span", "class": "detail-value", "text": "$detail.role" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.status" },
              { "tag": "span", "class": "detail-value", "text": "$detail.status" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.createdAt" },
              { "tag": "span", "class": "detail-value", "text": "$detail.createdAt" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.lastLogin" },
              { "tag": "span", "class": "detail-value", "text": "$detail.lastLogin" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.bio" },
              { "tag": "span", "class": "detail-value", "text": "$detail.bio" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.department" },
              { "tag": "span", "class": "detail-value", "text": "$detail.department" }
            ]
          },
          {
            "tag": "div",
            "class": "detail-item",
            "children": [
              { "tag": "span", "class": "detail-label", "text": "$detailLabels.phone" },
              { "tag": "span", "class": "detail-value", "text": "$detail.phone" }
            ]
          }
        ]
      }
    ]
  }
};
const agentContext$1 = {
  "$schema": "@schema/context",
  "$id": "@my-data/context/agent",
  "navTitle": "MaiaDB",
  "navCategories": [
    {
      "category": "Account",
      "items": [
        { "id": "account", "label": "Owner" },
        { "id": "group", "label": "Avatar" }
      ]
    },
    {
      "category": "Vibes",
      "items": [
        { "id": "maia-db", "label": "MaiaDB" },
        { "id": "todos", "label": "Todos" }
      ]
    },
    {
      "category": "OS",
      "items": [
        { "id": "schemata", "label": "Schemata" },
        { "id": "indexes", "label": "Indexes" }
      ]
    }
  ],
  "selectedNavId": "account",
  "selectedRowId": "1",
  "selectedNavItems": { "account": true },
  "selectedRowItems": { "1": true },
  "currentTable": "@table",
  "currentDetail": "@detail",
  "@actors": {
    "table": "@my-data/actor/table",
    "detail": "@my-data/actor/detail"
  }
};
const tableContext = {
  "$schema": "@schema/context",
  "$id": "@my-data/context/table",
  "table": [
    { "id": "1", "name": "John Doe", "email": "john@example.com", "role": "admin", "status": "active", "createdAt": "2024-01-15" },
    { "id": "2", "name": "Jane Smith", "email": "jane@example.com", "role": "user", "status": "active", "createdAt": "2024-01-20" },
    { "id": "3", "name": "Bob Johnson", "email": "bob@example.com", "role": "user", "status": "inactive", "createdAt": "2024-02-01" },
    { "id": "4", "name": "Alice Williams", "email": "alice@example.com", "role": "moderator", "status": "active", "createdAt": "2024-02-10" },
    { "id": "5", "name": "Charlie Brown", "email": "charlie@example.com", "role": "user", "status": "pending", "createdAt": "2024-02-15" }
  ],
  "selectedRowId": null,
  "tableHeaders": {
    "name": "Name",
    "email": "Email",
    "role": "Role",
    "status": "Status",
    "createdAt": "Created"
  }
};
const detailContext = {
  "$schema": "@schema/context",
  "$id": "@my-data/context/detail",
  "detail": {
    "id": "1",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "status": "active",
    "createdAt": "2024-01-15",
    "lastLogin": "2024-02-20",
    "bio": "System administrator with 5 years of experience.",
    "department": "IT",
    "phone": "+1 (555) 123-4567"
  },
  "detailLabels": {
    "id": "ID",
    "name": "Name",
    "email": "Email",
    "role": "Role",
    "status": "Status",
    "createdAt": "Created",
    "lastLogin": "Last Login",
    "bio": "Bio",
    "department": "Department",
    "phone": "Phone"
  }
};
const agentState$1 = {
  "$schema": "@schema/state",
  "$id": "@my-data/state/agent",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "SELECT_NAV": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "selectedNavId": "$$navId",
                "selectedNavItems": { "$$navId": true }
              }
            },
            {
              "updateContext": {
                "selectedRowId": null,
                "selectedRowItems": {}
              }
            }
          ]
        },
        "SELECT_ROW": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "selectedRowId": "$$rowId",
                "selectedRowItems": { "$$rowId": true }
              }
            }
          ]
        }
      }
    }
  }
};
const tableState = {
  "$schema": "@schema/state",
  "$id": "@my-data/state/table",
  "initial": "idle",
  "states": {
    "idle": {
      "on": {
        "SELECT_ROW": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "selectedRowId": "$$rowId" }
            }
          ]
        }
      }
    }
  }
};
const detailState = {
  "$schema": "@schema/state",
  "$id": "@my-data/state/detail",
  "initial": "idle",
  "states": {
    "idle": {}
  }
};
const agentInbox$1 = {
  "$schema": "@schema/inbox",
  "$id": "@my-data/inbox/agent",
  "cotype": "costream"
};
const tableInbox = {
  "$schema": "@schema/inbox",
  "$id": "@my-data/inbox/table",
  "cotype": "costream"
};
const detailInbox = {
  "$schema": "@schema/inbox",
  "$id": "@my-data/inbox/detail",
  "cotype": "costream"
};
const MyDataVibeRegistry = {
  vibe: myDataVibe,
  styles: {
    "@my-data/style/brand": brandStyle$1
  },
  actors: {
    "@my-data/actor/agent": agentActor$1,
    "@my-data/actor/table": tableActor,
    "@my-data/actor/detail": detailActor
  },
  views: {
    "@my-data/view/agent": agentView$1,
    "@my-data/view/table": tableView,
    "@my-data/view/detail": detailView
  },
  contexts: {
    "@my-data/context/agent": agentContext$1,
    "@my-data/context/table": tableContext,
    "@my-data/context/detail": detailContext
  },
  states: {
    "@my-data/state/agent": agentState$1,
    "@my-data/state/table": tableState,
    "@my-data/state/detail": detailState
  },
  inboxes: {
    "@my-data/inbox/agent": agentInbox$1,
    "@my-data/inbox/table": tableInbox,
    "@my-data/inbox/detail": detailInbox
  },
  // No initial data - this vibe uses mocked data in context
  data: {}
};
const registry$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  MyDataVibeRegistry
}, Symbol.toStringTag, { value: "Module" }));
async function loadMyDataVibe(container) {
  console.log("🚀 Booting MaiaOS for My Data Vibe...");
  let os;
  const checkForExistingSession = () => {
    if (window.maia && window.maia.id && window.maia.id.node && window.maia.id.maiaId) {
      return window.maia;
    }
    try {
      if (window.parent && window.parent !== window && window.parent.maia) {
        return window.parent.maia;
      }
    } catch (e) {
    }
    try {
      if (window.opener && window.opener.maia) {
        return window.opener.maia;
      }
    } catch (e) {
    }
    return null;
  };
  const existingSession = checkForExistingSession();
  if (existingSession) {
    console.log("ℹ️  Reusing existing MaiaOS session from main app");
    os = existingSession;
  } else {
    console.log("ℹ️  No existing session found, creating new authentication");
    const { node, account } = await signInWithPasskey({ salt: "maia.city" });
    os = await MaiaOS.boot({
      node,
      account,
      modules: ["db", "core"],
      // db module provides @db tool
      registry: MyDataVibeRegistry
      // Registry passed but seeding skipped for CoJSON backend
    });
  }
  const { vibe, actor: myDataActor } = await os.loadVibeFromAccount(
    "myData",
    // Vibe key in account.vibes
    container
  );
  return { os, vibe, actor: myDataActor };
}
async function getAllVibeRegistries() {
  const vibeRegistries = [];
  try {
    const { TodosVibeRegistry: TodosVibeRegistry2 } = await Promise.resolve().then(() => registry$2);
    if (TodosVibeRegistry2 && TodosVibeRegistry2.vibe) {
      vibeRegistries.push(TodosVibeRegistry2);
    }
  } catch (error) {
    console.warn("[Vibes] Could not load TodosVibeRegistry:", error.message);
  }
  try {
    const { MaiaAgentVibeRegistry: MaiaAgentVibeRegistry2 } = await Promise.resolve().then(() => registry);
    if (MaiaAgentVibeRegistry2 && MaiaAgentVibeRegistry2.vibe) {
      vibeRegistries.push(MaiaAgentVibeRegistry2);
    }
  } catch (error) {
    console.warn("[Vibes] Could not load MaiaAgentVibeRegistry:", error.message);
  }
  try {
    const { MyDataVibeRegistry: MyDataVibeRegistry2 } = await Promise.resolve().then(() => registry$1);
    if (MyDataVibeRegistry2 && MyDataVibeRegistry2.vibe) {
      vibeRegistries.push(MyDataVibeRegistry2);
    }
  } catch (error) {
    console.warn("[Vibes] Could not load MyDataVibeRegistry:", error.message);
  }
  return vibeRegistries;
}
function getVibeKey(vibe) {
  if (!vibe) return null;
  const originalVibeId = vibe.$id || "";
  if (originalVibeId.startsWith("@vibe/")) {
    return originalVibeId.replace("@vibe/", "");
  }
  return (vibe.name || "default").toLowerCase().replace(/\s+/g, "-");
}
function filterVibesForSeeding(vibeRegistries, config = null) {
  if (config === null || config === void 0 || Array.isArray(config) && config.length === 0) {
    return [];
  }
  if (config === "all") {
    return vibeRegistries;
  }
  if (Array.isArray(config)) {
    const configKeys = config.map((k) => k.toLowerCase().trim());
    return vibeRegistries.filter((registry2) => {
      if (!registry2.vibe) return false;
      const vibeKey = getVibeKey(registry2.vibe);
      return configKeys.includes(vibeKey);
    });
  }
  console.warn(`[Vibes] Invalid seeding config: ${config}. Expected null, "all", or array of vibe keys.`);
  return [];
}
const maiaAgentVibe = {
  "$schema": "@schema/vibe",
  "$id": "@vibe/maia",
  "name": "Maia Agent",
  "description": "CTO-level AI assistant for MaiaOS codebase",
  "actor": "@maia/actor/agent"
};
const brandStyle = {
  "$schema": "@schema/style",
  "$id": "@maia/style/brand",
  "tokens": {
    "colors": {
      "marineBlue": "#001F33",
      "marineBlueMuted": "#2D4A5C",
      "marineBlueLight": "#5E7A8C",
      "paradiseWater": "#00BDD6",
      "lushGreen": "#4E9A58",
      "terracotta": "#C27B66",
      "sunYellow": "#E6B94D",
      "softClay": "#E8E1D9",
      "tintedWhite": "#F0EDE6",
      "background": "transparent",
      "foreground": "#001F33",
      "primary": "#00BDD6",
      "secondary": "#2D4A5C",
      "border": "rgba(255, 255, 255, 0.1)",
      "surface": "rgba(255, 255, 255, 0.3)",
      "glass": "rgba(255, 255, 255, 0.0005)",
      "glassStrong": "rgba(255, 255, 255, 0.15)",
      "text": {
        "marine": "#D1E8F7",
        "water": "#004D59",
        "green": "#F0F9F1",
        "terracotta": "#FDF2EF",
        "yellow": "#4D3810"
      }
    },
    "spacing": {
      "xs": "0.5rem",
      "sm": "0.75rem",
      "md": "1rem",
      "lg": "1.5rem",
      "xl": "2rem",
      "2xl": "3rem"
    },
    "typography": {
      "fontFamily": {
        "heading": "'Indie Flower', cursive",
        "body": "'Plus Jakarta Sans', sans-serif"
      },
      "fontWeight": {
        "light": "300",
        "normal": "400",
        "medium": "500",
        "semibold": "600",
        "bold": "700"
      }
    },
    "radii": {
      "sm": "4px",
      "md": "12px",
      "apple": "18px",
      "full": "9999px"
    },
    "shadows": {
      "sm": "0 4px 30px rgba(0, 0, 0, 0.05)",
      "md": "0 10px 30px rgba(0, 0, 0, 0.05)",
      "lg": "0 10px 40px rgba(0, 0, 0, 0.1)"
    },
    "transitions": {
      "fast": "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      "standard": "all 0.5s cubic-bezier(0.2, 0, 0.2, 1)"
    }
  },
  "selectors": {
    ":host": {
      "display": "block",
      "height": "100%",
      "background": "{colors.background}",
      "fontFamily": "{typography.fontFamily.body}",
      "color": "{colors.marineBlue}"
    },
    ".chatContainer": {
      "display": "grid",
      "gridTemplateRows": "1fr auto",
      "height": "100%",
      "minHeight": "0",
      "maxHeight": "100%",
      "position": "relative",
      "overflow": "hidden",
      "background": "{colors.softClay}",
      "padding": "{spacing.sm}",
      "gap": "{spacing.sm}"
    },
    ".messagesContainer": {
      "gridRow": "1",
      "overflowY": "auto",
      "overflowX": "hidden",
      "padding": "{spacing.sm}",
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.md}",
      "minHeight": "0",
      "maxHeight": "100%",
      "position": "relative",
      "zIndex": "1",
      "background": "rgba(255, 255, 255, 0.4)",
      "backdropFilter": "blur(8px) saturate(150%)",
      "borderRadius": "{radii.apple}",
      "border": "1px solid {colors.border}",
      "boxShadow": "{shadows.md}"
    },
    ".message-wrapper": {
      "display": "flex",
      "flexDirection": "column",
      "marginBottom": "{spacing.md}"
    },
    ".message-wrapper[data-role='user']": {
      "alignItems": "flex-end"
    },
    ".message-wrapper[data-role='assistant']": {
      "alignItems": "flex-start"
    },
    ".message-name": {
      "fontSize": "0.65rem",
      "fontWeight": "{typography.fontWeight.semibold}",
      "textTransform": "uppercase",
      "letterSpacing": "0.05em",
      "marginBottom": "0.25rem",
      "opacity": "0.7"
    },
    ".message-wrapper[data-role='user'] .message-name": {
      "color": "{colors.marineBlue}",
      "textAlign": "right"
    },
    ".message-wrapper[data-role='assistant'] .message-name": {
      "color": "{colors.marineBlue}",
      "textAlign": "left"
    },
    ".message": {
      "padding": "{spacing.sm} {spacing.md}",
      "borderRadius": "{radii.apple}",
      "maxWidth": "85%",
      "wordWrap": "break-word",
      "fontSize": "0.75rem",
      "fontWeight": "{typography.fontWeight.light}",
      "lineHeight": "1.4",
      "transition": "{transitions.fast}"
    },
    ".messageAssistant": {
      "alignSelf": "flex-start",
      "background": "rgba(255, 255, 255, 0.6)",
      "color": "{colors.marineBlue}",
      "border": "1px solid {colors.border}",
      "boxShadow": "{shadows.sm}"
    },
    ".messageUser": {
      "alignSelf": "flex-end",
      "background": "{colors.marineBlue}",
      "color": "{colors.text.marine}",
      "boxShadow": "0 4px 12px rgba(0, 31, 51, 0.2)"
    },
    ".message[data-role='assistant']": {
      "alignSelf": "flex-start",
      "background": "rgba(255, 255, 255, 0.6)",
      "color": "{colors.marineBlue}",
      "border": "1px solid {colors.border}"
    },
    ".message[data-role='user']": {
      "alignSelf": "flex-end",
      "background": "{colors.marineBlue}",
      "color": "{colors.text.marine}"
    },
    ".welcomeMessage": {
      "fontFamily": "{typography.fontFamily.body}",
      "fontSize": "0.75rem",
      "background": "rgba(0, 189, 214, 0.05)",
      "border": "1px solid rgba(0, 189, 214, 0.1)",
      "color": "{colors.marineBlue}",
      "marginTop": "{spacing.sm}",
      "marginBottom": "{spacing.md}",
      "data": {
        "hasConversations": {
          "true": {
            "display": "none"
          }
        }
      }
    },
    ".welcomeSection": {
      "display": "flex",
      "flexDirection": "column",
      "marginBottom": "{spacing.md}"
    },
    ".agentCategory": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "0.6rem",
      "fontStyle": "italic",
      "color": "{colors.paradiseWater}",
      "marginBottom": "0.25rem",
      "display": "block",
      "textShadow": "0 0 10px rgba(0, 189, 214, 0.2)"
    },
    ".agentTitle": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "0.9rem",
      "fontWeight": "{typography.fontWeight.bold}",
      "color": "{colors.marineBlue}",
      "margin": "0",
      "letterSpacing": "-0.02em"
    },
    ".inputContainer": {
      "gridRow": "2",
      "display": "flex",
      "gap": "{spacing.sm}",
      "padding": "{spacing.sm}",
      "background": "rgba(255, 255, 255, 0.4)",
      "backdropFilter": "blur(8px) saturate(150%)",
      "borderRadius": "{radii.full}",
      "border": "1px solid {colors.border}",
      "boxShadow": "{shadows.md}",
      "flexShrink": "0",
      "position": "relative",
      "zIndex": "100"
    },
    ".input": {
      "flex": "1",
      "padding": "{spacing.xs} {spacing.md}",
      "border": "none",
      "background": "transparent",
      "fontSize": "0.7rem",
      "color": "{colors.marineBlue}",
      "fontFamily": "{typography.fontFamily.body}",
      "fontWeight": "{typography.fontWeight.light}",
      "outline": "none",
      "cursor": "text"
    },
    ".button": {
      "padding": "{spacing.xs} {spacing.md}",
      "background": "{colors.paradiseWater}",
      "color": "{colors.text.water}",
      "border": "none",
      "borderRadius": "{radii.full}",
      "cursor": "pointer",
      "fontSize": "0.6rem",
      "fontWeight": "600",
      "textTransform": "uppercase",
      "letterSpacing": "0.05em",
      "transition": "{transitions.fast}",
      "boxShadow": "0 4px 12px rgba(0, 189, 214, 0.2)",
      ":hover": {
        "filter": "brightness(1.1)",
        "transform": "translateY(-1px)",
        "boxShadow": "0 6px 16px rgba(0, 189, 214, 0.3)"
      },
      ":active": {
        "transform": "translateY(0)"
      }
    },
    ".button:disabled": {
      "background": "{colors.marineBlueLight}",
      "opacity": "0.5",
      "cursor": "not-allowed",
      "boxShadow": "none"
    },
    ".loading": {
      "padding": "{spacing.sm} {spacing.md}",
      "color": "{colors.marineBlueLight}",
      "fontFamily": "{typography.fontFamily.heading}",
      "fontStyle": "italic",
      "display": "none",
      "position": "absolute",
      "top": "{spacing.xl}",
      "left": "50%",
      "transform": "translateX(-50%)",
      "zIndex": "10",
      "background": "rgba(232, 225, 217, 0.8)",
      "backdropFilter": "blur(4px)",
      "borderRadius": "{radii.full}",
      "border": "1px solid {colors.border}",
      "data": {
        "isLoading": {
          "true": {
            "display": "block"
          }
        }
      }
    },
    ".error": {
      "padding": "{spacing.md}",
      "background": "rgba(194, 123, 102, 0.1)",
      "color": "{colors.terracotta}",
      "borderRadius": "{radii.apple}",
      "border": "1px solid rgba(194, 123, 102, 0.2)",
      "margin": "{spacing.md}",
      "display": "none",
      "data": {
        "hasError": {
          "true": {
            "display": "block"
          }
        }
      }
    },
    "@container {containerName} (min-width: {containers.xs})": {
      ".chatContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.sm}"
      },
      ".messagesContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.md}"
      },
      ".message": {
        "padding": "{spacing.sm} {spacing.md}",
        "fontSize": "0.7rem"
      },
      ".agentCategory": {
        "fontSize": "0.65rem"
      },
      ".agentTitle": {
        "fontSize": "0.85rem"
      },
      ".inputContainer": {
        "gap": "{spacing.sm}",
        "padding": "{spacing.sm}"
      },
      ".input": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.7rem"
      },
      ".button": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.65rem"
      },
      ".welcomeMessage": {
        "fontSize": "0.7rem"
      }
    },
    "@container {containerName} (min-width: {containers.sm})": {
      ".chatContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.sm}"
      },
      ".messagesContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.md}"
      },
      ".message": {
        "padding": "{spacing.sm} {spacing.md}",
        "fontSize": "0.75rem"
      },
      ".agentCategory": {
        "fontSize": "0.7rem"
      },
      ".agentTitle": {
        "fontSize": "0.9rem"
      },
      ".inputContainer": {
        "gap": "{spacing.sm}",
        "padding": "{spacing.sm}"
      },
      ".input": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.7rem"
      },
      ".button": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.65rem"
      },
      ".welcomeMessage": {
        "fontSize": "0.75rem"
      }
    },
    "@container {containerName} (min-width: {containers.md})": {
      ".chatContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.sm}"
      },
      ".messagesContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.md}"
      },
      ".message": {
        "padding": "{spacing.sm} {spacing.md}",
        "fontSize": "0.8rem"
      },
      ".agentCategory": {
        "fontSize": "0.75rem"
      },
      ".agentTitle": {
        "fontSize": "0.95rem"
      },
      ".inputContainer": {
        "gap": "{spacing.sm}",
        "padding": "{spacing.sm}"
      },
      ".input": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.75rem"
      },
      ".button": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.7rem"
      },
      ".welcomeMessage": {
        "fontSize": "0.8rem"
      }
    },
    "@container {containerName} (min-width: {containers.lg})": {
      ".chatContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.sm}"
      },
      ".messagesContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.md}"
      },
      ".message": {
        "padding": "{spacing.sm} {spacing.md}",
        "fontSize": "0.85rem"
      },
      ".agentCategory": {
        "fontSize": "0.8rem"
      },
      ".agentTitle": {
        "fontSize": "1rem"
      },
      ".inputContainer": {
        "gap": "{spacing.sm}",
        "padding": "{spacing.sm}"
      },
      ".input": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.8rem"
      },
      ".button": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.75rem"
      },
      ".welcomeMessage": {
        "fontSize": "0.85rem"
      }
    },
    "@container {containerName} (min-width: {containers.xl})": {
      ".chatContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.sm}"
      },
      ".messagesContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.md}"
      },
      ".message": {
        "padding": "{spacing.sm} {spacing.md}",
        "fontSize": "0.9rem"
      },
      ".agentCategory": {
        "fontSize": "0.85rem"
      },
      ".agentTitle": {
        "fontSize": "1.05rem"
      },
      ".inputContainer": {
        "gap": "{spacing.sm}",
        "padding": "{spacing.sm}"
      },
      ".input": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.85rem"
      },
      ".button": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.8rem"
      },
      ".welcomeMessage": {
        "fontSize": "0.9rem"
      }
    },
    "@container {containerName} (min-width: {containers.2xl})": {
      ".chatContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.sm}"
      },
      ".messagesContainer": {
        "padding": "{spacing.sm}",
        "gap": "{spacing.md}"
      },
      ".message": {
        "padding": "{spacing.sm} {spacing.md}",
        "fontSize": "0.95rem"
      },
      ".agentCategory": {
        "fontSize": "0.9rem"
      },
      ".agentTitle": {
        "fontSize": "1.1rem"
      },
      ".inputContainer": {
        "gap": "{spacing.sm}",
        "padding": "{spacing.sm}"
      },
      ".input": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.9rem"
      },
      ".button": {
        "padding": "{spacing.xs} {spacing.md}",
        "fontSize": "0.85rem"
      },
      ".welcomeMessage": {
        "fontSize": "0.95rem"
      }
    }
  }
};
const agentActor = {
  "$schema": "@schema/actor",
  "$id": "@maia/actor/agent",
  "role": "agent",
  "context": "@maia/context/agent",
  "view": "@maia/view/agent",
  "state": "@maia/state/agent",
  "brand": "@maia/style/brand",
  "inbox": "@maia/inbox/agent",
  "messageTypes": [
    "SEND_MESSAGE",
    "UPDATE_INPUT",
    "RENDER_COMPLETE",
    "SUCCESS",
    "ERROR",
    "RETRY",
    "DISMISS"
  ]
};
const agentView = {
  "$schema": "@schema/view",
  "$id": "@maia/view/agent",
  "content": {
    "tag": "div",
    "class": "chat-container",
    "children": [
      {
        "tag": "div",
        "class": "messages-container",
        "children": [
          {
            "tag": "div",
            "class": "welcome-section",
            "children": [
              {
                "tag": "h2",
                "class": "agent-title",
                "text": "Maia"
              },
              {
                "tag": "div",
                "class": "message message-assistant welcome-message",
                "attrs": {
                  "data": {
                    "hasConversations": "$hasConversations"
                  }
                },
                "text": "Hello! I'm Maia, your CTO-level AI assistant. I understand the MaiaOS codebase and learn alongside your coding sessions. How can I help you today?"
              }
            ]
          },
          {
            "$each": {
              "items": "$conversations",
              "template": {
                "tag": "div",
                "class": "message-wrapper",
                "attrs": {
                  "data": {
                    "role": "$$role"
                  }
                },
                "children": [
                  {
                    "tag": "div",
                    "class": "message-name",
                    "text": "$messageNames.$$id"
                  },
                  {
                    "tag": "div",
                    "class": "message",
                    "attrs": {
                      "data": {
                        "role": "$$role"
                      }
                    },
                    "text": "$$content"
                  }
                ]
              }
            }
          }
        ]
      },
      {
        "tag": "div",
        "class": "loading",
        "attrs": {
          "data": {
            "isLoading": "$isLoading"
          }
        },
        "text": "Maia is thinking..."
      },
      {
        "tag": "div",
        "class": "error",
        "attrs": {
          "data": {
            "hasError": "$hasError"
          }
        },
        "children": [
          {
            "tag": "strong",
            "text": "Error: "
          },
          {
            "text": "$error"
          },
          {
            "tag": "button",
            "class": "button",
            "text": "Dismiss",
            "$on": {
              "click": {
                "send": "DISMISS"
              }
            }
          }
        ]
      },
      {
        "tag": "div",
        "class": "input-container",
        "children": [
          {
            "tag": "input",
            "class": "input",
            "attrs": {
              "type": "text",
              "placeholder": "Type your message...",
              "disabled": "$isLoading"
            },
            "value": "$inputText",
            "$on": {
              "input": {
                "send": "UPDATE_INPUT",
                "payload": { "inputText": "@inputValue" }
              },
              "keydown": {
                "send": "SEND_MESSAGE",
                "payload": { "inputText": "@inputValue" },
                "key": "Enter"
              }
            }
          },
          {
            "tag": "button",
            "class": "button",
            "attrs": {
              "disabled": "$isLoading"
            },
            "text": "Send",
            "$on": {
              "click": {
                "send": "SEND_MESSAGE",
                "payload": { "inputText": "$inputText" }
              }
            }
          }
        ]
      }
    ]
  }
};
const agentContext = {
  "$schema": "@schema/context",
  "$id": "@maia/context/agent",
  "conversations": {
    "schema": "@schema/data/chat"
  },
  "inputText": "",
  "assistantResponse": null,
  "isLoading": false,
  "error": null,
  "hasConversations": false,
  "hasError": false,
  "messageNames": {}
};
const agentState = {
  "$schema": "@schema/state",
  "$id": "@maia/state/agent",
  "initial": "idle",
  "states": {
    "idle": {
      "entry": [
        {
          "updateContext": {
            "isLoading": false
          }
        },
        {
          "tool": "@core/computeMessageNames",
          "payload": {
            "conversations": "$conversations"
          },
          "onSuccess": {
            "updateContext": {
              "messageNames": "$$result"
            }
          }
        }
      ],
      "on": {
        "RENDER_COMPLETE": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "hasConversations": {
                  "$gt": [{ "$length": "$conversations" }, 0]
                }
              }
            },
            {
              "tool": "@core/computeMessageNames",
              "payload": {
                "conversations": "$conversations"
              },
              "onSuccess": {
                "updateContext": {
                  "messageNames": "$$result"
                }
              }
            }
          ]
        },
        "SEND_MESSAGE": {
          "target": "chatting"
        },
        "UPDATE_INPUT": {
          "target": "idle",
          "actions": [
            {
              "updateContext": { "inputText": "$$inputText" }
            }
          ]
        }
      }
    },
    "chatting": {
      "entry": [
        {
          "updateContext": {
            "isLoading": true,
            "hasError": false
          }
        },
        {
          "tool": "@db",
          "payload": {
            "op": "create",
            "schema": "@schema/data/chat",
            "data": {
              "role": "user",
              "content": "$$inputText"
            }
          }
        }
      ],
      "on": {
        "SUCCESS": {
          "target": "calling_llm",
          "actions": [
            {
              "updateContext": {
                "inputText": ""
              }
            }
          ]
        },
        "ERROR": {
          "target": "error",
          "actions": [
            {
              "updateContext": {
                "isLoading": false
              }
            }
          ]
        }
      }
    },
    "calling_llm": {
      "entry": {
        "tool": "@agent/chat",
        "payload": {
          "model": "qwen/qwen3-30b-a3b-instruct-2507",
          "temperature": 1,
          "context": {
            "$concat": [
              [
                {
                  "role": "system",
                  "content": "You are Maia, a CTO-level AI assistant that understands the entire MaiaOS codebase, architecture, and all packages. You learn alongside coding sessions. Be helpful, technical, and concise. Never use emoticons in your responses."
                }
              ],
              {
                "$map": {
                  "array": "$conversations",
                  "as": "msg",
                  "return": {
                    "role": "$$msg.role",
                    "content": "$$msg.content"
                  }
                }
              }
            ]
          }
        }
      },
      "on": {
        "SUCCESS": {
          "target": "saving_response"
        },
        "ERROR": {
          "target": "error",
          "actions": [
            {
              "updateContext": {
                "isLoading": false
              }
            }
          ]
        }
      }
    },
    "saving_response": {
      "entry": [
        {
          "tool": "@db",
          "payload": {
            "op": "create",
            "schema": "@schema/data/chat",
            "data": {
              "role": "assistant",
              "content": "$$result.content"
            }
          }
        }
      ],
      "on": {
        "SUCCESS": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "assistantResponse": null,
                "isLoading": false,
                "hasError": false
              }
            },
            {
              "updateContext": {
                "hasConversations": {
                  "$gt": [{ "$length": "$conversations" }, 0]
                }
              }
            },
            {
              "tool": "@core/computeMessageNames",
              "payload": {
                "conversations": "$conversations"
              },
              "onSuccess": {
                "updateContext": {
                  "messageNames": "$$result"
                }
              }
            }
          ]
        },
        "ERROR": {
          "target": "error",
          "actions": [
            {
              "updateContext": {
                "isLoading": false
              }
            }
          ]
        }
      }
    },
    "error": {
      "entry": {
        "updateContext": {
          "error": "$$error",
          "isLoading": false,
          "hasError": true
        }
      },
      "on": {
        "SEND_MESSAGE": {
          "target": "chatting",
          "actions": [
            {
              "updateContext": {
                "error": null,
                "hasError": false
              }
            }
          ]
        },
        "RETRY": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "error": null,
                "hasError": false
              }
            }
          ]
        },
        "DISMISS": {
          "target": "idle",
          "actions": [
            {
              "updateContext": {
                "error": null,
                "hasError": false
              }
            }
          ]
        }
      }
    }
  }
};
const agentInbox = {
  "$schema": "@schema/inbox",
  "$id": "@maia/inbox/agent"
};
const MaiaAgentVibeRegistry = {
  vibe: maiaAgentVibe,
  styles: {
    "@maia/style/brand": brandStyle
  },
  actors: {
    "@maia/actor/agent": agentActor
  },
  views: {
    "@maia/view/agent": agentView
  },
  contexts: {
    "@maia/context/agent": agentContext
  },
  states: {
    "@maia/state/agent": agentState
  },
  inboxes: {
    "@maia/inbox/agent": agentInbox
  }
};
const registry = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  MaiaAgentVibeRegistry
}, Symbol.toStringTag, { value: "Module" }));
export {
  MaiaOS2 as MaiaOS,
  MyDataVibeRegistry as MyDataRegistry,
  MyDataVibeRegistry,
  TodosVibeRegistry as TodosRegistry,
  TodosVibeRegistry,
  filterVibesForSeeding,
  getAllVibeRegistries,
  loadMyDataVibe,
  loadTodosVibe
};
//# sourceMappingURL=maia-vibes.es.js.map
