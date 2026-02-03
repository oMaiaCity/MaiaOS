import { signInWithPasskey, MaiaOS } from "@MaiaOS/kernel";
import { MaiaOS as MaiaOS2 } from "@MaiaOS/kernel";
const todosVibe = {
  "$schema": "@schema/vibe",
  "$id": "@vibe/todos",
  "name": "Todo List",
  "description": "A complete todo list application with state machines and AI-compatible tools. Showcases MaiaOS actor system, message passing, and declarative UI.",
  "actor": "@todos/actor/agent"
};
const brandStyle$2 = {
  "$schema": "@schema/style",
  "$id": "@todos/style/brand",
  "tokens": {
    "colors": {
      "primary": "#8fa89b",
      "primaryHover": "#7a9488",
      "secondary": "#d4a373",
      "success": "#a3b18a",
      "danger": "#e07a5f",
      "background": "#f8f9fa",
      "surface": "rgba(255, 255, 255, 0.4)",
      "surfaceHover": "rgba(255, 255, 255, 0.6)",
      "text": "#2d3436",
      "textSecondary": "#636e72",
      "border": "rgba(0, 0, 0, 0.05)",
      "glass": "rgba(255, 255, 255, 0.2)"
    },
    "spacing": {
      "xs": "0.4rem",
      "sm": "0.6rem",
      "md": "0.8rem",
      "lg": "1.5rem",
      "xl": "2.5rem"
    },
    "typography": {
      "fontFamily": "'Inter', system-ui, -apple-system, sans-serif",
      "fontSize": {
        "sm": "0.75rem",
        "base": "0.9375rem",
        "lg": "1.1rem",
        "xl": "2rem"
      },
      "fontWeight": {
        "normal": "400",
        "medium": "500",
        "semibold": "600",
        "bold": "700"
      }
    },
    "radii": {
      "sm": "0.4rem",
      "md": "0.8rem",
      "lg": "1.2rem",
      "full": "9999px"
    },
    "shadows": {
      "sm": "0 2px 4px 0 rgba(0, 0, 0, 0.02)",
      "md": "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
      "lg": "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
    }
  },
  "components": {
    "stack": {
      "containerType": "inline-size",
      "containerName": "actor-root",
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.lg}",
      "width": "100%",
      "maxWidth": "100%",
      "minHeight": "100vh",
      "maxHeight": "100vh",
      "paddingTop": "{spacing.lg}",
      "paddingBottom": "{spacing.sm}",
      "paddingLeft": "{spacing.xl}",
      "paddingRight": "{spacing.xl}",
      "background": "rgba(255, 255, 255, 0.4)",
      "backdropFilter": "blur(8px)",
      "-webkit-backdrop-filter": "blur(8px)",
      "overflowY": "auto",
      "overflowX": "hidden",
      "boxSizing": "border-box",
      "position": "relative"
    },
    "title": {
      "fontSize": "{typography.fontSize.xl}",
      "fontWeight": "{typography.fontWeight.bold}",
      "textAlign": "center",
      "margin": "0",
      "background": "linear-gradient(to right, #8fa89b, #d4a373)",
      "-webkit-background-clip": "text",
      "-webkit-text-fill-color": "transparent",
      "letterSpacing": "-0.03em"
    },
    "form": {
      "display": "flex",
      "gap": "{spacing.xs}",
      "background": "transparent",
      "padding": "{spacing.xs}",
      "borderRadius": "{radii.lg}",
      "border": "1px solid {colors.border}",
      "backdropFilter": "blur(20px)",
      "width": "100%",
      "maxWidth": "100%",
      "boxSizing": "border-box",
      "boxShadow": "{shadows.md}"
    },
    "input": {
      "flex": "1",
      "minWidth": "0",
      "padding": "{spacing.sm} {spacing.md}",
      "background": "transparent",
      "border": "none",
      "color": "{colors.text}",
      "fontSize": "{typography.fontSize.base}",
      "outline": "none",
      "boxSizing": "border-box"
    },
    "button": {
      "padding": "{spacing.sm} {spacing.lg}",
      "background": "{colors.primary}",
      "color": "white",
      "border": "none",
      "borderRadius": "{radii.md}",
      "fontSize": "{typography.fontSize.base}",
      "fontWeight": "{typography.fontWeight.semibold}",
      "cursor": "pointer",
      "transition": "all 0.2s ease",
      "boxShadow": "0 4px 10px rgba(143, 168, 155, 0.2)"
    },
    "list": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "0",
      "flex": "1",
      "overflowY": "auto"
    },
    "card": {
      "display": "flex",
      "alignItems": "center",
      "gap": "{spacing.md}",
      "padding": "{spacing.sm} {spacing.md}",
      "background": "transparent",
      "borderRadius": "0",
      "border": "1px solid {colors.border}",
      "borderBottom": "none",
      "backdropFilter": "blur(10px)",
      "transition": "all 0.2s ease",
      "color": "{colors.text}",
      "[data-done=true]": {
        "opacity": "0.6",
        "background": "rgba(0, 0, 0, 0.02)"
      },
      "[data-done=true] .body": {
        "textDecoration": "line-through",
        "color": "{colors.textSecondary}"
      },
      "data": {
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
      "fontSize": "{typography.fontSize.base}",
      "color": "{colors.text}"
    },
    "buttonSmall": {
      "width": "28px",
      "height": "28px",
      "display": "flex",
      "alignItems": "center",
      "justifyContent": "center",
      "background": "transparent",
      "color": "{colors.textSecondary}",
      "border": "1px solid {colors.border}",
      "borderRadius": "{radii.sm}",
      "cursor": "pointer",
      "transition": "all 0.2s ease",
      ":hover": {
        "background": "{colors.glass}",
        "borderColor": "{colors.primary}",
        "color": "{colors.primary}"
      }
    },
    "buttonDanger": {
      "color": "{colors.danger}",
      ":hover": {
        "borderColor": "{colors.danger}",
        "color": "{colors.danger}",
        "background": "rgba(224, 122, 95, 0.05)"
      }
    },
    "buttonModalTrigger": {
      "position": "sticky",
      "bottom": "{spacing.sm}",
      "alignSelf": "center",
      "marginTop": "auto",
      "marginBottom": "0",
      "padding": "{spacing.xs} {spacing.md}",
      "background": "{colors.secondary}",
      "color": "white",
      "border": "none",
      "borderRadius": "{radii.full}",
      "fontSize": "{typography.fontSize.sm}",
      "fontWeight": "{typography.fontWeight.medium}",
      "cursor": "pointer",
      "boxShadow": "0 4px 12px rgba(212, 163, 115, 0.2)",
      "zIndex": "50"
    },
    "modalOverlay": {
      "position": "absolute",
      "top": "0",
      "left": "0",
      "right": "0",
      "bottom": "0",
      "background": "rgba(255, 255, 255, 0.6)",
      "backdropFilter": "blur(12px)",
      "display": "flex",
      "alignItems": "center",
      "justifyContent": "center",
      "zIndex": "1000",
      "opacity": "0",
      "pointerEvents": "none",
      "[data-open=true]": {
        "opacity": "1",
        "pointerEvents": "all"
      }
    },
    "modalContent": {
      "background": "white",
      "borderRadius": "{radii.lg}",
      "border": "1px solid {colors.border}",
      "boxShadow": "{shadows.lg}",
      "maxWidth": "90vw",
      "maxHeight": "90vh",
      "width": "400px",
      "overflow": "hidden",
      "display": "flex",
      "flexDirection": "column"
    },
    "modalHeader": {
      "display": "flex",
      "justifyContent": "space-between",
      "alignItems": "center",
      "padding": "{spacing.md} {spacing.lg}",
      "borderBottom": "1px solid {colors.border}"
    },
    "modalTitle": {
      "fontSize": "{typography.fontSize.lg}",
      "fontWeight": "{typography.fontWeight.bold}",
      "color": "{colors.text}",
      "margin": "0"
    },
    "buttonModalClose": {
      "background": "transparent",
      "border": "none",
      "color": "{colors.textSecondary}",
      "fontSize": "1.2rem",
      "cursor": "pointer",
      "padding": "0",
      "width": "2rem",
      "height": "2rem",
      "display": "flex",
      "alignItems": "center",
      "justifyContent": "center",
      "borderRadius": "{radii.sm}"
    },
    "headerSection": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.sm}"
    },
    "viewSwitcher": {
      "display": "flex",
      "gap": "{spacing.xs}",
      "justifyContent": "center"
    },
    "buttonViewSwitch": {
      "padding": "{spacing.xs} {spacing.md}",
      "background": "transparent",
      "color": "{colors.textSecondary}",
      "border": "1px solid {colors.border}",
      "borderRadius": "{radii.sm}",
      "fontSize": "{typography.fontSize.sm}",
      "cursor": "pointer",
      "transition": "all 0.2s ease",
      "data": {
        "active": {
          "true": {
            "background": "{colors.primary}",
            "color": "white",
            "borderColor": "{colors.primary}",
            "fontWeight": "600"
          }
        }
      }
    },
    "kanban": {
      "display": "flex",
      "flexDirection": "row",
      "gap": "{spacing.md}",
      "width": "100%",
      "flex": "1",
      "overflowX": "auto",
      "overflowY": "hidden"
    },
    "kanbanColumn": {
      "flex": "1",
      "minWidth": "200px",
      "display": "flex",
      "flexDirection": "column",
      "background": "{colors.glass}",
      "borderRadius": "{radii.md}",
      "border": "1px solid {colors.border}",
      "padding": "{spacing.md}",
      "gap": "{spacing.sm}"
    },
    "kanbanColumnTitle": {
      "fontSize": "{typography.fontSize.base}",
      "fontWeight": "{typography.fontWeight.semibold}",
      "color": "{colors.text}",
      "margin": "0",
      "paddingBottom": "{spacing.xs}",
      "borderBottom": "1px solid {colors.border}"
    },
    "kanbanColumnContent": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.sm}",
      "overflowY": "auto",
      "flex": "1",
      "minHeight": "200px",
      "padding": "{spacing.sm}",
      "border": "2px dashed {colors.border}",
      "borderRadius": "{radii.md}",
      "background": "rgba(255, 255, 255, 0.2)",
      "transition": "all 0.2s ease",
      "data": {
        "dragOverColumn": {
          "todo": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "{colors.primary}",
            "borderWidth": "2px",
            "borderStyle": "dashed"
          },
          "done": {
            "background": "rgba(143, 168, 155, 0.15)",
            "borderColor": "{colors.primary}",
            "borderWidth": "2px",
            "borderStyle": "dashed"
          }
        }
      }
    },
    "cardActions": {
      "display": "flex",
      "gap": "{spacing.xs}",
      "marginTop": "{spacing.xs}"
    },
    "draggable": {
      "cursor": "grab",
      "transition": "opacity 0.2s ease, transform 0.1s ease"
    },
    "dragging": {
      "opacity": "0.5",
      "cursor": "grabbing"
    },
    "dropzone": {
      "transition": "background-color 0.2s ease, border-color 0.2s ease"
    },
    "dragOver": {
      "background": "rgba(143, 168, 155, 0.1)",
      "borderColor": "{colors.primary}"
    },
    "modalBody": {
      "padding": "{spacing.lg}",
      "color": "{colors.textSecondary}",
      "lineHeight": "1.5",
      "overflowY": "auto"
    }
  },
  "selectors": {
    ".form + .list": {
      "marginTop": "-0.8rem"
    },
    ".list .card:first-child": {
      "borderTopLeftRadius": "{radii.md}",
      "borderTopRightRadius": "{radii.md}"
    },
    ".list .card:last-child": {
      "borderBottomLeftRadius": "{radii.md}",
      "borderBottomRightRadius": "{radii.md}",
      "borderBottom": "1px solid {colors.border}"
    },
    '.kanban .card[draggable="true"]': {
      "cursor": "grab"
    },
    '.kanban .card[draggable="true"]:active': {
      "cursor": "grabbing",
      "opacity": "0.6"
    },
    ".kanban-column-content:empty::before": {
      "content": "'Drop items here'",
      "display": "flex",
      "alignItems": "center",
      "justifyContent": "center",
      "minHeight": "100px",
      "color": "{colors.textSecondary}",
      "fontSize": "{typography.fontSize.sm}",
      "fontStyle": "italic"
    },
    '.stack[data-view="kanban"] .kanban-column-content': {
      "borderColor": "rgba(143, 168, 155, 0.3)",
      "borderWidth": "2px"
    },
    ".kanban-column-content:hover": {
      "background": "rgba(143, 168, 155, 0.08)",
      "borderColor": "rgba(143, 168, 155, 0.5)"
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
      "color": "#ffffff",
      "fontFamily": "'Inter', system-ui, -apple-system, sans-serif",
      "fontSize": "0.9375rem",
      "lineHeight": "1.5"
    },
    "logEntryContainer": {
      "display": "flex",
      "flexDirection": "column",
      "width": "100%"
    },
    "logEntries": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "0"
    },
    "logEntry": {
      "padding": "0.5rem 0.75rem",
      "margin": "0",
      "background": "transparent",
      "backdropFilter": "blur(10px)",
      "-webkit-backdrop-filter": "blur(10px)",
      "border": "1px solid rgba(255, 255, 255, 0.1)",
      "borderBottom": "none",
      "borderLeft": "3px solid #3b82f6",
      "display": "flex",
      "alignItems": "center",
      "gap": "0.75rem",
      "minHeight": "1.75rem",
      "transition": "all 0.2s ease",
      "width": "100%",
      "color": "#ffffff",
      "position": "relative"
    },
    "logMeta": {
      "display": "flex",
      "gap": "0.75rem",
      "alignItems": "center",
      "flexShrink": "0",
      "whiteSpace": "nowrap"
    },
    "logType": {
      "color": "#ffffff",
      "fontWeight": "600",
      "fontSize": "0.75rem",
      "textTransform": "uppercase",
      "minWidth": "5rem",
      "textAlign": "left",
      "letterSpacing": "0.025em"
    },
    "logSource": {
      "color": "#ffffff",
      "fontSize": "0.75rem",
      "fontFamily": "monospace",
      "minWidth": "8rem",
      "flexShrink": "0",
      "fontWeight": "500",
      "display": "flex",
      "alignItems": "center",
      "gap": "0.25rem"
    },
    "logSourceRole": {
      "color": "#ffffff",
      "fontWeight": "600"
    },
    "logSourceId": {
      "color": "rgba(255, 255, 255, 0.8)",
      "fontSize": "0.6875rem",
      "fontFamily": "monospace"
    },
    "logTarget": {
      "color": "#ffffff",
      "fontSize": "0.75rem",
      "fontFamily": "monospace",
      "minWidth": "8rem",
      "flexShrink": "0",
      "fontWeight": "500",
      "marginLeft": "0.5rem",
      "display": "flex",
      "alignItems": "center",
      "gap": "0.25rem"
    },
    "logTargetRole": {
      "color": "#ffffff",
      "fontWeight": "600"
    },
    "logTargetId": {
      "color": "rgba(255, 255, 255, 0.8)",
      "fontSize": "0.6875rem",
      "fontFamily": "monospace"
    },
    "logPayloadDetails": {
      "display": "block",
      "width": "100%",
      "margin": "0",
      "padding": "0"
    },
    "logPayloadToggle": {
      "color": "#ffffff",
      "fontSize": "0.75rem",
      "fontWeight": "500",
      "cursor": "pointer",
      "userSelect": "none",
      "padding": "0.25rem 0.75rem",
      "borderRadius": "0.4rem",
      "background": "rgba(255, 255, 255, 0.25)",
      "backdropFilter": "blur(10px)",
      "-webkit-backdrop-filter": "blur(10px)",
      "border": "1px solid rgba(255, 255, 255, 0.3)",
      "transition": "all 0.2s ease",
      "marginLeft": "auto",
      "minWidth": "4rem",
      "textAlign": "center",
      "display": "inline-block"
    },
    "logPayloadToggle:hover": {
      "background": "rgba(255, 255, 255, 0.35)",
      "borderColor": "rgba(255, 255, 255, 0.5)"
    },
    "logPayload": {
      "margin": "0",
      "padding": "0.75rem",
      "background": "rgba(255, 255, 255, 0.15)",
      "backdropFilter": "blur(10px)",
      "-webkit-backdrop-filter": "blur(10px)",
      "border": "1px solid rgba(255, 255, 255, 0.2)",
      "borderTop": "none",
      "borderLeft": "3px solid #3b82f6",
      "borderRadius": "0 0 0.8rem 0.8rem",
      "color": "#ffffff",
      "fontSize": "0.75rem",
      "fontFamily": "monospace",
      "whiteSpace": "pre-wrap",
      "wordBreak": "break-word",
      "overflow": "auto",
      "maxHeight": "300px"
    },
    "logPayloadDetails": {
      "display": "flex",
      "alignItems": "center",
      "marginLeft": "auto",
      "flexShrink": "0"
    },
    "logPayloadToggle::-webkit-details-marker": {
      "display": "none"
    },
    "logPayloadToggle::marker": {
      "display": "none"
    }
  },
  "selectors": {
    ".log-entry[data-event-type='SUCCESS']": {
      "borderLeftColor": "#10b981"
    },
    ".log-entry[data-event-type='ERROR']": {
      "borderLeftColor": "#ef4444"
    },
    ".log-entry[data-event-type='SWITCH_VIEW']": {
      "borderLeftColor": "#8b5cf6"
    },
    ".log-entry:hover": {
      "background": "rgba(255, 255, 255, 0.1)"
    },
    ".log-entries .log-entry-container:first-child .log-entry": {
      "borderTopLeftRadius": "0.8rem",
      "borderTopRightRadius": "0.8rem"
    },
    ".log-entries .log-entry-container:last-child .log-entry": {
      "borderBottomLeftRadius": "0.8rem",
      "borderBottomRightRadius": "0.8rem",
      "borderBottom": "1px solid rgba(255, 255, 255, 0.1)"
    },
    ".log-entry-container:last-child .log-payload": {
      "borderBottomLeftRadius": "0.8rem",
      "borderBottomRightRadius": "0.8rem"
    },
    ".log-entry[data-processed='false']": {
      "borderLeftColor": "#f59e0b"
    },
    ".log-entry .log-payload[data-expanded='true']": {
      "maxHeight": "500px",
      "opacity": "1",
      "marginTop": "0.5rem",
      "padding": "0.5rem"
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
  "inbox": "@todos/inbox/agent"
};
const listActor = {
  "$schema": "@schema/actor",
  "$id": "@todos/actor/list",
  "role": "todo-list",
  "context": "@todos/context/list",
  "view": "@todos/view/list",
  "state": "@todos/state/list",
  "brand": "@todos/style/brand",
  "inbox": "@todos/inbox/list"
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
  "inbox": "@todos/inbox/logs"
};
const agentView$2 = {
  "$schema": "@schema/view",
  "$id": "@todos/view/agent",
  "content": {
    "tag": "div",
    "class": "stack",
    "children": [
      {
        "class": "header-section",
        "children": [
          {
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
          "target": "creating",
          "guard": {
            "$and": [
              { "$ne": ["$$text", null] },
              { "$ne": [{ "$trim": "$$text" }, ""] }
            ]
          }
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
  console.log("✅ Vibe loaded:", vibe.name);
  console.log("✅ Todo Actor with State Machine:", todoActor.machine?.currentState);
  return { os, vibe, actor: todoActor };
}
const myDataVibe = {
  "$schema": "@schema/vibe",
  "$id": "@vibe/my-data",
  "name": "My Data",
  "description": "A database viewer interface with navigation, table view, and detail panel. Demonstrates mocked data and options.map transformations.",
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
      "border": "rgba(0, 31, 51, 0.1)",
      "surface": "rgba(255, 255, 255, 0.3)",
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
        "heading": "'Alice', serif",
        "body": "'Plus Jakarta Sans', sans-serif"
      },
      "fontFaces": [
        {
          "fontFamily": "Alice",
          "src": "url('/brand/fonts/Alice/Alice-Regular.ttf') format('truetype')",
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
        },
        {
          "fontFamily": "Plus Jakarta Sans",
          "src": "url('/brand/fonts/Jarkata/PlusJakartaSans-Italic-VariableFont_wght.ttf') format('truetype')",
          "fontWeight": "100 900",
          "fontStyle": "italic",
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
      "gridTemplateColumns": "280px 1fr 380px",
      "height": "100vh",
      "width": "100%",
      "background": "{colors.softClay}",
      "fontFamily": "{typography.fontFamily.body}",
      "color": "{colors.marineBlue}",
      "position": "relative",
      "overflow": "hidden"
    },
    "navAside": {
      "background": "rgba(255, 255, 255, 0.2)",
      "backdropFilter": "blur(8px)",
      "borderRight": "1px solid {colors.border}",
      "padding": "{spacing.xl}",
      "overflowY": "auto",
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.xl}",
      "zIndex": "10"
    },
    "navTitle": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "{typography.fontSize.2xl}",
      "fontWeight": "{typography.fontWeight.bold}",
      "color": "{colors.marineBlue}",
      "marginBottom": "{spacing.lg}",
      "marginTop": "0"
    },
    "navItem": {
      "display": "flex",
      "alignItems": "center",
      "gap": "{spacing.md}",
      "width": "100%",
      "padding": "{spacing.md} {spacing.lg}",
      "background": "transparent",
      "border": "none",
      "borderRadius": "{radii.full}",
      "cursor": "pointer",
      "transition": "{transitions.fast}",
      "fontFamily": "{typography.fontFamily.body}",
      "fontSize": "{typography.fontSize.base}",
      "color": "{colors.marineBlueMuted}",
      "textAlign": "left",
      ":hover": {
        "background": "rgba(255, 255, 255, 0.4)",
        "color": "{colors.marineBlue}"
      }
    },
    "navIcon": {
      "width": "20px",
      "height": "20px",
      "stroke": "currentColor",
      "strokeWidth": "1.5"
    },
    "tableArea": {
      "padding": "{spacing.2xl}",
      "overflowY": "auto",
      "display": "flex",
      "flexDirection": "column",
      "gap": "{spacing.xl}",
      "zIndex": "5",
      "containerType": "inline-size"
    },
    "tableContainer": {
      "background": "{colors.surface}",
      "backdropFilter": "blur(6px)",
      "borderRadius": "{radii.apple}",
      "boxShadow": "{shadows.sm}",
      "overflow": "hidden",
      "border": "1px solid {colors.border}",
      "transition": "{transitions.standard}"
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
      "fontWeight": "{typography.fontWeight.semibold}",
      "color": "{colors.marineBlue}",
      "borderBottom": "1px solid {colors.border}",
      "textTransform": "uppercase",
      "letterSpacing": "0.1em",
      "fontSize": "0.7rem"
    },
    "dataTable td": {
      "padding": "{spacing.lg}",
      "borderBottom": "1px solid {colors.border}",
      "color": "{colors.marineBlueMuted}",
      "transition": "{transitions.fast}"
    },
    "tableRow": {
      "cursor": "pointer",
      "transition": "{transitions.fast}",
      ":hover": {
        "background": "rgba(255, 255, 255, 0.5)"
      }
    },
    "detailAside": {
      "background": "rgba(255, 255, 255, 0.2)",
      "backdropFilter": "blur(8px)",
      "borderLeft": "1px solid {colors.border}",
      "padding": "{spacing.xl}",
      "overflowY": "auto",
      "zIndex": "10"
    },
    "detailTitle": {
      "fontFamily": "{typography.fontFamily.heading}",
      "fontSize": "{typography.fontSize.2xl}",
      "fontWeight": "{typography.fontWeight.bold}",
      "color": "{colors.marineBlue}",
      "marginBottom": "{spacing.lg}",
      "marginTop": "0"
    },
    "detailItem": {
      "display": "flex",
      "flexDirection": "column",
      "gap": "0.25rem",
      "paddingBottom": "{spacing.md}",
      "borderBottom": "1px solid {colors.border}"
    },
    "detailLabel": {
      "fontSize": "0.7rem",
      "textTransform": "uppercase",
      "letterSpacing": "0.1em",
      "color": "{colors.marineBlueLight}",
      "fontWeight": "{typography.fontWeight.bold}"
    },
    "detailValue": {
      "fontSize": "{typography.fontSize.base}",
      "color": "{colors.marineBlue}",
      "fontWeight": "500"
    }
  },
  "selectors": {
    ":host": {
      "position": "relative",
      "background": "{colors.background}",
      "fontFamily": "{typography.fontFamily.body}",
      "color": "{colors.foreground}"
    },
    ".nav-item[data-selected='true']": {
      "background": "{colors.marineBlue}",
      "color": "{colors.softClay}",
      "fontWeight": "700"
    },
    ".table-row[data-selected='true']": {
      "background": "rgba(0, 189, 214, 0.1)",
      "color": "{colors.marineBlue}"
    },
    "@container (max-width: 1000px)": {
      ".db-viewer": {
        "gridTemplateColumns": "200px 1fr 300px"
      }
    },
    "@container (max-width: 700px)": {
      ".db-viewer": {
        "gridTemplateColumns": "1fr",
        "gridTemplateRows": "auto 1fr auto"
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
  "inbox": "@my-data/inbox/agent"
};
const tableActor = {
  "$schema": "@schema/actor",
  "$id": "@my-data/actor/table",
  "role": "ui",
  "context": "@my-data/context/table",
  "view": "@my-data/view/table",
  "state": "@my-data/state/table",
  "brand": "@my-data/style/brand",
  "inbox": "@my-data/inbox/table"
};
const detailActor = {
  "$schema": "@schema/actor",
  "$id": "@my-data/actor/detail",
  "role": "ui",
  "context": "@my-data/context/detail",
  "view": "@my-data/view/detail",
  "state": "@my-data/state/detail",
  "brand": "@my-data/style/brand",
  "inbox": "@my-data/inbox/detail"
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
            "tag": "h2",
            "class": "nav-title",
            "text": "Blueprint"
          },
          {
            "$each": {
              "items": "$navItems",
              "template": {
                "tag": "button",
                "class": "nav-item",
                "attrs": {
                  "data": {
                    "selected": {
                      "$eq": ["$$id", "$selectedNavId"]
                    }
                  }
                },
                "children": [
                  {
                    "tag": "svg",
                    "class": "nav-icon",
                    "attrs": {
                      "width": "20",
                      "height": "20",
                      "viewBox": "0 0 24 24",
                      "fill": "none",
                      "stroke": "currentColor",
                      "strokeWidth": "1.5",
                      "strokeLinecap": "round",
                      "strokeLinejoin": "round"
                    },
                    "children": [
                      {
                        "tag": "path",
                        "attrs": {
                          "d": "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                        }
                      },
                      {
                        "tag": "polyline",
                        "attrs": {
                          "points": "9 22 9 12 15 12 15 22"
                        }
                      }
                    ]
                  },
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
      },
      {
        "tag": "main",
        "class": "table-area",
        "$slot": "$currentTable"
      },
      {
        "tag": "aside",
        "class": "detail-aside",
        "$slot": "$currentDetail"
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
                    "selected": {
                      "$eq": ["$$id", "$selectedRowId"]
                    }
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
  "navItems": [
    { "id": "users", "label": "Users" },
    { "id": "products", "label": "Products" },
    { "id": "orders", "label": "Orders" },
    { "id": "categories", "label": "Categories" },
    { "id": "reviews", "label": "Reviews" }
  ],
  "selectedNavId": "users",
  "selectedRowId": "1",
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
              "updateContext": { "selectedNavId": "$$navId" }
            },
            {
              "updateContext": { "selectedRowId": null }
            }
          ]
        },
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
  console.log("✅ Vibe loaded:", vibe.name);
  console.log("✅ My Data Actor with State Machine:", myDataActor.machine?.currentState);
  return { os, vibe, actor: myDataActor };
}
async function getAllVibeRegistries() {
  const vibeRegistries = [];
  try {
    const { TodosVibeRegistry: TodosVibeRegistry2 } = await Promise.resolve().then(() => registry$2);
    if (TodosVibeRegistry2 && TodosVibeRegistry2.vibe) {
      vibeRegistries.push(TodosVibeRegistry2);
      console.log("[Vibes] Loaded TodosVibeRegistry");
    }
  } catch (error) {
    console.warn("[Vibes] Could not load TodosVibeRegistry:", error.message);
  }
  try {
    const { MaiaAgentVibeRegistry: MaiaAgentVibeRegistry2 } = await Promise.resolve().then(() => registry);
    if (MaiaAgentVibeRegistry2 && MaiaAgentVibeRegistry2.vibe) {
      vibeRegistries.push(MaiaAgentVibeRegistry2);
      console.log("[Vibes] Loaded MaiaAgentVibeRegistry");
    }
  } catch (error) {
    console.warn("[Vibes] Could not load MaiaAgentVibeRegistry:", error.message);
  }
  try {
    const { MyDataVibeRegistry: MyDataVibeRegistry2 } = await Promise.resolve().then(() => registry$1);
    if (MyDataVibeRegistry2 && MyDataVibeRegistry2.vibe) {
      vibeRegistries.push(MyDataVibeRegistry2);
      console.log("[Vibes] Loaded MyDataVibeRegistry");
    }
  } catch (error) {
    console.warn("[Vibes] Could not load MyDataVibeRegistry:", error.message);
  }
  console.log(`[Vibes] Total registries loaded: ${vibeRegistries.length}`);
  return vibeRegistries;
}
const maiaAgentVibe = {
  "$schema": "@schema/vibe",
  "$id": "@vibe/maia",
  "name": "Maia Agent",
  "description": "CTO-level AI assistant that understands the entire MaiaOS codebase, architecture, and all packages. Learns alongside coding sessions.",
  "actor": "@maia/actor/agent"
};
const brandStyle = {
  "$schema": "@schema/style",
  "$id": "@maia/style/brand",
  "selectors": {
    ".chat-container": {
      "display": "grid",
      "gridTemplateRows": "1fr auto",
      "height": "100%",
      "minHeight": "0",
      "maxHeight": "100%",
      "fontFamily": "system-ui, -apple-system, sans-serif",
      "backgroundColor": "#f8f9fa",
      "position": "relative",
      "overflow": "hidden"
    },
    ".messages-container": {
      "gridRow": "1",
      "overflowY": "auto",
      "overflowX": "hidden",
      "padding": "1rem",
      "display": "flex",
      "flexDirection": "column",
      "gap": "1rem",
      "minHeight": "0",
      "maxHeight": "100%",
      "position": "relative",
      "zIndex": "1"
    },
    ".message": {
      "padding": "0.75rem 1rem",
      "borderRadius": "0.5rem",
      "maxWidth": "80%",
      "wordWrap": "break-word"
    },
    ".message-user": {
      "alignSelf": "flex-end",
      "backgroundColor": "#007bff",
      "color": "white"
    },
    ".message-assistant": {
      "alignSelf": "flex-start",
      "backgroundColor": "white",
      "border": "1px solid #dee2e6",
      "color": "#212529"
    },
    ".message[data-role='user']": {
      "alignSelf": "flex-end",
      "backgroundColor": "#007bff",
      "color": "white"
    },
    ".message[data-role='assistant']": {
      "alignSelf": "flex-start",
      "backgroundColor": "white",
      "border": "1px solid #dee2e6",
      "color": "#212529"
    },
    ".welcome-message": {
      "data": {
        "hasConversations": {
          "true": {
            "display": "none"
          }
        }
      }
    },
    ".input-container": {
      "gridRow": "2",
      "display": "flex",
      "gap": "0.5rem",
      "padding": "1rem",
      "borderTop": "1px solid #dee2e6",
      "backgroundColor": "white",
      "flexShrink": "0",
      "position": "relative",
      "zIndex": "100",
      "pointerEvents": "auto"
    },
    ".input": {
      "flex": "1",
      "padding": "0.75rem",
      "border": "1px solid #dee2e6",
      "borderRadius": "0.25rem",
      "fontSize": "1rem",
      "position": "relative",
      "zIndex": "101",
      "pointerEvents": "auto !important",
      "background": "white",
      "cursor": "text",
      "userSelect": "text",
      "WebkitUserSelect": "text",
      "MozUserSelect": "text",
      "msUserSelect": "text"
    },
    ".input:focus": {
      "outline": "2px solid #007bff",
      "outlineOffset": "2px",
      "borderColor": "#007bff"
    },
    ".input:disabled": {
      "opacity": "0.6",
      "cursor": "not-allowed",
      "pointerEvents": "none"
    },
    ".button": {
      "padding": "0.75rem 1.5rem",
      "backgroundColor": "#007bff",
      "color": "white",
      "border": "none",
      "borderRadius": "0.25rem",
      "cursor": "pointer",
      "fontSize": "1rem"
    },
    ".button:disabled": {
      "backgroundColor": "#6c757d",
      "cursor": "not-allowed"
    },
    ".loading": {
      "padding": "0.5rem",
      "color": "#6c757d",
      "fontStyle": "italic",
      "display": "none",
      "pointerEvents": "none",
      "position": "absolute",
      "top": "0",
      "left": "0",
      "right": "0",
      "zIndex": "5",
      "backgroundColor": "rgba(248, 249, 250, 0.9)",
      "data": {
        "isLoading": {
          "true": {
            "display": "block",
            "pointerEvents": "none"
          }
        }
      }
    },
    ".error": {
      "padding": "0.75rem",
      "backgroundColor": "#f8d7da",
      "color": "#721c24",
      "borderRadius": "0.25rem",
      "margin": "0.5rem 1rem",
      "display": "none",
      "data": {
        "hasError": {
          "true": {
            "display": "block"
          }
        }
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
  "inbox": "@maia/inbox/agent"
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
            "class": "message message-assistant welcome-message",
            "attrs": {
              "data": {
                "hasConversations": "$hasConversations"
              }
            },
            "text": "Hello! I'm Maia, your CTO-level AI assistant. I understand the MaiaOS codebase and learn alongside your coding sessions. How can I help you today?"
          },
          {
            "$each": {
              "items": "$conversations",
              "template": {
                "tag": "div",
                "class": "message",
                "attrs": {
                  "data": {
                    "role": "$$role"
                  }
                },
                "text": "$$content"
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
  "hasError": false
};
const agentState = {
  "$schema": "@schema/state",
  "$id": "@maia/state/agent",
  "initial": "idle",
  "states": {
    "idle": {
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
            }
          ]
        },
        "SEND_MESSAGE": {
          "target": "chatting",
          "guard": {
            "$and": [
              { "$ne": ["$$inputText", null] },
              { "$ne": [{ "$trim": "$$inputText" }, ""] }
            ]
          }
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
            "hasError": false,
            "inputText": "$$inputText"
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
          "target": "calling_llm"
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
        "tool": "@private-llm/chat",
        "payload": {
          "messages": {
            "$concat": [
              [
                {
                  "role": "system",
                  "content": "You are Maia, a CTO-level AI assistant that understands the entire MaiaOS codebase, architecture, and all packages. You learn alongside coding sessions. Be helpful, technical, and concise."
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
              },
              [
                {
                  "role": "user",
                  "content": "$inputText"
                }
              ]
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
                "inputText": "",
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
          "guard": {
            "$and": [
              { "$ne": ["$$inputText", null] },
              { "$ne": [{ "$trim": "$$inputText" }, ""] }
            ]
          },
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
  getAllVibeRegistries,
  loadMyDataVibe,
  loadTodosVibe
};
//# sourceMappingURL=maia-vibes.es.js.map
