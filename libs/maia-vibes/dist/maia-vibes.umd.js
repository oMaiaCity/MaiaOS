(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require("@MaiaOS/kernel")) : typeof define === "function" && define.amd ? define(["exports", "@MaiaOS/kernel"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.MaiaOSVibes = {}, global.MaiaOS));
})(this, (function(exports2, kernel) {
  "use strict";
  function checkForExistingSession() {
    if (window.maia?.id?.node && window.maia.id.maiaId) return window.maia;
    try {
      if (window.parent !== window && window.parent.maia) return window.parent.maia;
    } catch (e) {
    }
    try {
      if (window.opener?.maia) return window.opener.maia;
    } catch (e) {
    }
    return null;
  }
  function createVibeLoader(vibeKey, Registry, modules = ["db", "core"]) {
    return async (container) => {
      console.log(`🚀 Booting MaiaOS for ${vibeKey.charAt(0).toUpperCase() + vibeKey.slice(1)} Vibe...`);
      let os = checkForExistingSession();
      if (os) {
        console.log("ℹ️  Reusing existing MaiaOS session from main app");
      } else {
        console.log("ℹ️  No existing session found, creating new authentication");
        const { node, account } = await kernel.signInWithPasskey({ salt: "maia.city" });
        os = await kernel.MaiaOS.boot({ node, account, modules, registry: Registry });
      }
      const { vibe, actor } = await os.loadVibeFromAccount(vibeKey, container);
      return { os, vibe, actor };
    };
  }
  const masterBrand = {
    "$schema": "@maia/schema/style",
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
        "error": "#DC3545",
        "errorBg": "rgba(220, 53, 69, 0.1)",
        "errorBorder": "rgba(220, 53, 69, 0.2)",
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
      },
      "containers": {
        "xs": "240px",
        "sm": "360px",
        "md": "480px",
        "lg": "640px",
        "xl": "768px",
        "2xl": "1024px"
      }
    },
    "components": {
      "stack": { "display": "flex", "flexDirection": "column", "gap": "0.25rem", "width": "100%", "maxWidth": "100%", "height": "100vh", "background": "{colors.softClay}", "padding": "0.375rem", "overflowY": "auto", "overflowX": "hidden", "fontFamily": "{typography.fontFamily.body}", "color": "{colors.marineBlue}", "boxSizing": "border-box" },
      "headerSection": { "display": "flex", "flexDirection": "column", "alignItems": "center", "gap": "0.25rem", "marginBottom": "0.25rem", "width": "100%" },
      "viewSwitcher": { "display": "flex", "gap": "0.2rem", "background": "rgba(255, 255, 255, 0.2)", "padding": "0.15rem", "borderRadius": "{radii.full}", "margin": "0 auto", "border": "1px solid {colors.border}" },
      "buttonViewSwitch": { "padding": "0.25rem 0.6rem", "background": "transparent", "border": "none", "borderRadius": "{radii.full}", "fontSize": "0.55rem", "fontWeight": "600", "textTransform": "uppercase", "letterSpacing": "0.05em", "color": "{colors.marineBlueMuted}", "cursor": "pointer", "transition": "{transitions.fast}", "data": { "active": { "true": { "background": "{colors.marineBlue}", "color": "{colors.softClay}", "boxShadow": "0 4px 12px rgba(0, 31, 51, 0.2)" } } } },
      "form": { "display": "flex", "flexDirection": "row", "alignItems": "center", "gap": "0.25rem", "padding": "0.25rem 0.375rem", "background": "rgba(255, 255, 255, 0.4)", "backdropFilter": "blur(8px) saturate(150%)", "borderRadius": "{radii.full}", "border": "1px solid {colors.border}", "boxShadow": "{shadows.md}", "width": "100%", "boxSizing": "border-box", "marginBottom": "0.25rem" },
      "input": { "flex": "1", "width": "100%", "padding": "0.25rem 0.5rem", "border": "none", "background": "transparent", "fontSize": "0.6rem", "color": "{colors.marineBlue}", "fontFamily": "{typography.fontFamily.body}", "fontWeight": "{typography.fontWeight.light}", "outline": "none", "minHeight": "0", "minWidth": "0", "lineHeight": "1.35" },
      "button": { "width": "auto", "padding": "0.25rem 0.5rem", "background": "{colors.lushGreen}", "color": "{colors.text.green}", "border": "none", "borderRadius": "{radii.full}", "cursor": "pointer", "fontSize": "0.5rem", "fontWeight": "600", "textTransform": "uppercase", "letterSpacing": "0.05em", "transition": "{transitions.fast}", "boxShadow": "0 4px 12px rgba(78, 154, 88, 0.2)", "whiteSpace": "nowrap", "flexShrink": "0", ":hover": { "filter": "brightness(1.1)", "transform": "translateY(-1px)", "boxShadow": "0 6px 16px rgba(78, 154, 88, 0.3)" } },
      "errorMessage": { "padding": "{spacing.sm} {spacing.md}", "background": "{colors.errorBg}", "color": "{colors.error}", "borderRadius": "{radii.md}", "border": "1px solid {colors.errorBorder}", "margin": "{spacing.md} 0", "display": "none", "data": { "hasError": { "true": { "display": "block" } } } },
      "buttonDismiss": { "marginLeft": "{spacing.sm}", "padding": "0.25rem 0.5rem", "background": "transparent", "color": "{colors.error}", "border": "1px solid {colors.errorBorder}", "borderRadius": "{radii.sm}", "cursor": "pointer", "fontSize": "0.5rem", "fontWeight": "600", "transition": "{transitions.fast}", ":hover": { "background": "{colors.error}", "color": "white" } },
      "card": { "display": "flex", "flexDirection": "column", "alignItems": "flex-start", "gap": "0.25rem", "padding": "0.25rem 0.375rem", "background": "rgba(255, 255, 255, 0.3)", "backdropFilter": "blur(8px) saturate(150%)", "borderRadius": "{radii.apple}", "border": "1px solid {colors.border}", "transition": "{transitions.fast}", "marginBottom": "0.25rem", ":hover": { "background": "rgba(255, 255, 255, 0.5)", "transform": "translateY(-2px)", "boxShadow": "{shadows.sm}" } },
      "detailContentWrapper": { "display": "flex", "flexDirection": "column", "height": "100%", "width": "100%" },
      "detailContainer": { "background": "rgba(255, 255, 255, 0.4)", "backdropFilter": "blur(12px) saturate(160%)", "borderRadius": "{radii.apple}", "boxShadow": "{shadows.md}", "overflow": "auto", "border": "1px solid rgba(255, 255, 255, 0.2)", "transition": "{transitions.standard}", "height": "100%", "display": "flex", "flexDirection": "column", "padding": "{spacing.md}" },
      "detailCategory": { "fontFamily": "{typography.fontFamily.heading}", "fontSize": "0.85rem", "fontStyle": "italic", "color": "{colors.paradiseWater}", "marginBottom": "0.5rem", "display": "block", "textShadow": "0 0 10px rgba(0, 189, 214, 0.2)" },
      "detailTitle": { "fontFamily": "{typography.fontFamily.heading}", "fontSize": "{typography.fontSize.xl}", "fontWeight": "{typography.fontWeight.bold}", "color": "{colors.marineBlue}", "marginBottom": "{spacing.md}", "marginTop": "0", "letterSpacing": "-0.02em" },
      "detailList": { "display": "flex", "flexDirection": "column", "gap": "{spacing.sm}" },
      "detailItem": { "display": "flex", "flexDirection": "row", "justifyContent": "space-between", "alignItems": "center", "padding": "{spacing.sm}", "background": "rgba(255, 255, 255, 0.2)", "borderRadius": "{radii.md}", "gap": "{spacing.md}" },
      "detailLabel": { "fontWeight": "{typography.fontWeight.semibold}", "color": "{colors.marineBlueLight}", "fontSize": "0.75rem" },
      "detailValue": { "color": "{colors.marineBlue}", "fontSize": "0.75rem", "fontFamily": "{typography.fontFamily.body}", "wordBreak": "break-all" },
      "tableContainer": { "background": "rgba(255, 255, 255, 0.4)", "backdropFilter": "blur(12px) saturate(160%)", "borderRadius": "{radii.apple}", "boxShadow": "{shadows.md}", "overflow": "auto", "border": "1px solid rgba(255, 255, 255, 0.2)", "transition": "{transitions.standard}", "height": "100%", "display": "flex", "flexDirection": "column", "padding": "{spacing.md}" }
    },
    "selectors": {
      ":host": { "display": "block", "height": "100%", "background": "transparent" }
    }
  };
  const todosVibe = {
    "$schema": "@maia/schema/vibe",
    "$id": "@maia/vibe/todos",
    "name": "Todos",
    "description": "Complete todo list with state machines and AI tools",
    "actor": "@maia/todos/actor/vibe"
  };
  const brandStyle$2 = {
    "$schema": "@maia/schema/style",
    "$id": "@maia/todos/style/brand",
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
    "$schema": "@maia/schema/style",
    "$id": "@maia/todos/style/list",
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
  const comingSoonStyle = {
    "$schema": "@maia/schema/style",
    "$id": "@maia/todos/style/coming-soon",
    "components": {
      "comingSoon": {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "justifyContent": "center",
        "padding": "{spacing.xl}",
        "minHeight": "200px"
      },
      "comingSoonText": {
        "fontFamily": "{typography.fontFamily.heading}",
        "fontSize": "1.2rem",
        "color": "{colors.marineBlueLight}",
        "fontStyle": "italic"
      }
    }
  };
  const vibeActor$2 = {
    "$schema": "@maia/schema/actor",
    "$id": "@maia/todos/actor/vibe",
    "role": "agent",
    "context": "@maia/todos/context/vibe",
    "view": "@maia/todos/view/vibe",
    "state": "@maia/todos/state/vibe",
    "brand": "@maia/todos/style/brand",
    "inbox": "@maia/todos/inbox/vibe",
    "messageTypes": ["CREATE_BUTTON", "TOGGLE_BUTTON", "DELETE_BUTTON", "UPDATE_INPUT", "SWITCH_VIEW", "SUCCESS", "ERROR"]
  };
  const listActor = {
    "$schema": "@maia/schema/actor",
    "$id": "@maia/todos/actor/list",
    "role": "todo-list",
    "context": "@maia/todos/context/list",
    "view": "@maia/todos/view/list",
    "state": "@maia/todos/state/list",
    "brand": "@maia/todos/style/brand",
    "style": "@maia/todos/style/list",
    "inbox": "@maia/todos/inbox/list",
    "messageTypes": [
      "TOGGLE_BUTTON",
      "DELETE_BUTTON",
      "SUCCESS",
      "RETRY",
      "DISMISS"
    ]
  };
  const comingSoonActor = {
    "$schema": "@maia/schema/actor",
    "$id": "@maia/todos/actor/coming-soon",
    "role": "ui",
    "context": "@maia/todos/context/coming-soon",
    "view": "@maia/todos/view/coming-soon",
    "state": "@maia/todos/state/coming-soon",
    "brand": "@maia/style/brand",
    "style": "@maia/todos/style/coming-soon",
    "inbox": "@maia/todos/inbox/coming-soon",
    "messageTypes": []
  };
  const vibeView$2 = {
    "$schema": "@maia/schema/view",
    "$id": "@maia/todos/view/vibe",
    "content": {
      "tag": "div",
      "class": "stack",
      "children": [
        {
          "tag": "div",
          "class": "header-section",
          "children": [
            { "tag": "h2", "class": "todo-title", "text": "Daily Focus" },
            {
              "tag": "div",
              "class": "view-switcher",
              "children": [
                {
                  "tag": "button",
                  "class": "button-view-switch",
                  "attrs": { "data-view": "list", "data": { "active": "$listButtonActive" } },
                  "text": "$listViewLabel",
                  "$on": { "click": { "send": "SWITCH_VIEW", "payload": { "viewMode": "list" } } }
                },
                {
                  "tag": "button",
                  "class": "button-view-switch",
                  "attrs": { "data-view": "comingSoon", "data": { "active": "$comingSoonButtonActive" } },
                  "text": "$comingSoonViewLabel",
                  "$on": { "click": { "send": "SWITCH_VIEW", "payload": { "viewMode": "comingSoon" } } }
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
              "attrs": { "type": "text", "placeholder": "$inputPlaceholder" },
              "value": "$newTodoText",
              "$on": {
                "input": { "send": "UPDATE_INPUT", "payload": { "value": "@inputValue" } },
                "blur": { "send": "UPDATE_INPUT", "payload": { "value": "@inputValue" } },
                "keydown": { "send": "CREATE_BUTTON", "payload": { "value": "@inputValue" }, "key": "Enter" }
              }
            },
            { "tag": "button", "class": "button", "text": "$addButtonText", "$on": { "click": { "send": "CREATE_BUTTON", "payload": { "value": "$newTodoText" } } } }
          ]
        },
        { "tag": "main", "class": "content-area", "$slot": "$currentView" }
      ]
    }
  };
  const listView = {
    "$schema": "@maia/schema/view",
    "$id": "@maia/todos/view/list",
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
                  "payload": {
                    "id": "$$id",
                    "done": "$$done"
                  }
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
                  "payload": {
                    "id": "$$id"
                  }
                }
              }
            }
          ]
        }
      }
    }
  };
  const comingSoonView = {
    "$schema": "@maia/schema/view",
    "$id": "@maia/todos/view/coming-soon",
    "content": {
      "tag": "div",
      "class": "coming-soon",
      "children": [
        {
          "tag": "p",
          "class": "coming-soon-text",
          "text": "$message"
        }
      ]
    }
  };
  const vibeContext$2 = {
    "$schema": "@maia/schema/context",
    "$id": "@maia/todos/context/vibe",
    "currentView": "@list",
    "viewMode": "list",
    "listButtonActive": true,
    "comingSoonButtonActive": false,
    "inputPlaceholder": "Add a new todo...",
    "addButtonText": "Add",
    "listViewLabel": "List",
    "comingSoonViewLabel": "Soon",
    "newTodoText": "",
    "error": null,
    "@actors": {
      "list": "@maia/todos/actor/list",
      "comingSoon": "@maia/todos/actor/coming-soon"
    }
  };
  const listContext = {
    "$schema": "@maia/schema/context",
    "$id": "@maia/todos/context/list",
    "list": {
      "schema": "@maia/schema/data/todos"
    },
    "toggleButtonText": "✓",
    "deleteButtonText": "✕"
  };
  const comingSoonContext = {
    "$schema": "@maia/schema/context",
    "$id": "@maia/todos/context/coming-soon",
    "message": "Coming soon"
  };
  const vibeState$2 = {
    "$schema": "@maia/schema/state",
    "$id": "@maia/todos/state/vibe",
    "initial": "idle",
    "states": {
      "idle": {
        "on": {
          "CREATE_BUTTON": { "target": "creating" },
          "TOGGLE_BUTTON": { "target": "toggling" },
          "DELETE_BUTTON": { "target": "deleting" },
          "SWITCH_VIEW": {
            "target": "idle",
            "actions": [
              { "updateContext": { "viewMode": "$$viewMode" } },
              { "updateContext": { "currentView": { "$if": { "condition": { "$eq": ["$$viewMode", "list"] }, "then": "@list", "else": "@comingSoon" } } } },
              { "updateContext": { "listButtonActive": { "$eq": ["$$viewMode", "list"] } } },
              { "updateContext": { "comingSoonButtonActive": { "$eq": ["$$viewMode", "comingSoon"] } } }
            ]
          },
          "UPDATE_INPUT": { "target": "idle", "actions": [{ "updateContext": { "newTodoText": "$$value" } }] }
        }
      },
      "creating": {
        "entry": { "tool": "@db", "payload": { "op": "create", "schema": "@maia/schema/data/todos", "data": { "text": "$$value", "done": false } } },
        "on": {
          "UPDATE_INPUT": { "target": "idle" },
          "CREATE_BUTTON": { "target": "creating" },
          "TOGGLE_BUTTON": { "target": "toggling" },
          "DELETE_BUTTON": { "target": "deleting" },
          "SWITCH_VIEW": { "target": "idle", "actions": [{ "updateContext": { "viewMode": "$$viewMode" } }, { "updateContext": { "currentView": { "$if": { "condition": { "$eq": ["$$viewMode", "list"] }, "then": "@list", "else": "@comingSoon" } } } }, { "updateContext": { "listButtonActive": { "$eq": ["$$viewMode", "list"] } } }, { "updateContext": { "comingSoonButtonActive": { "$eq": ["$$viewMode", "comingSoon"] } } }] },
          "SUCCESS": { "target": "idle", "actions": [{ "updateContext": { "newTodoText": "" } }] },
          "ERROR": "error"
        }
      },
      "toggling": {
        "entry": { "tool": "@db", "payload": { "op": "update", "id": "$$id", "data": { "done": { "$not": "$$done" } } } },
        "on": { "TOGGLE_BUTTON": { "target": "toggling" }, "DELETE_BUTTON": { "target": "deleting" }, "UPDATE_INPUT": { "target": "idle" }, "CREATE_BUTTON": { "target": "creating" }, "SWITCH_VIEW": { "target": "idle" }, "SUCCESS": { "target": "idle" }, "ERROR": "error" }
      },
      "deleting": {
        "entry": { "tool": "@db", "payload": { "op": "delete", "id": "$$id" } },
        "on": { "DELETE_BUTTON": { "target": "deleting" }, "UPDATE_INPUT": { "target": "idle" }, "CREATE_BUTTON": { "target": "creating" }, "SWITCH_VIEW": { "target": "idle" }, "TOGGLE_BUTTON": { "target": "toggling" }, "SUCCESS": { "target": "idle" }, "ERROR": { "target": "error" } }
      },
      "error": {
        "entry": { "updateContext": { "error": "$$errors.0.message" } },
        "on": { "TOGGLE_BUTTON": { "target": "toggling" }, "DELETE_BUTTON": { "target": "deleting" }, "RETRY": { "target": "idle", "actions": [{ "updateContext": { "error": null } }] }, "DISMISS": { "target": "idle", "actions": [{ "updateContext": { "error": null } }] } }
      }
    }
  };
  const listState = {
    "$schema": "@maia/schema/state",
    "$id": "@maia/todos/state/list",
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
                  "payload": {
                    "id": "$$id",
                    "done": "$$done"
                  },
                  "target": "@maia/todos/actor/vibe"
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
                  "payload": {
                    "id": "$$id"
                  },
                  "target": "@maia/todos/actor/vibe"
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
          "updateContext": {
            "error": "$$errors.0.message"
          }
        },
        "on": {
          "RETRY": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "error": null
                }
              }
            ]
          },
          "DISMISS": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "error": null
                }
              }
            ]
          }
        }
      }
    }
  };
  const comingSoonState = {
    "$schema": "@maia/schema/state",
    "$id": "@maia/todos/state/coming-soon",
    "initial": "idle",
    "states": {
      "idle": {}
    }
  };
  const vibeInbox$2 = {
    "$schema": "@maia/schema/inbox",
    "$id": "@maia/todos/inbox/vibe",
    "items": []
  };
  const listInbox = {
    "$schema": "@maia/schema/inbox",
    "$id": "@maia/todos/inbox/list",
    "items": []
  };
  const comingSoonInbox = {
    "$schema": "@maia/schema/inbox",
    "$id": "@maia/todos/inbox/coming-soon",
    "items": []
  };
  const TodosVibeRegistry = {
    vibe: todosVibe,
    styles: {
      "@maia/style/brand": masterBrand,
      "@maia/todos/style/brand": brandStyle$2,
      "@maia/todos/style/list": listStyle,
      "@maia/todos/style/coming-soon": comingSoonStyle
    },
    actors: {
      "@maia/todos/actor/vibe": vibeActor$2,
      "@maia/todos/actor/list": listActor,
      "@maia/todos/actor/coming-soon": comingSoonActor
    },
    views: {
      "@maia/todos/view/vibe": vibeView$2,
      "@maia/todos/view/list": listView,
      "@maia/todos/view/coming-soon": comingSoonView
    },
    contexts: {
      "@maia/todos/context/vibe": vibeContext$2,
      "@maia/todos/context/list": listContext,
      "@maia/todos/context/coming-soon": comingSoonContext
    },
    states: {
      "@maia/todos/state/vibe": vibeState$2,
      "@maia/todos/state/list": listState,
      "@maia/todos/state/coming-soon": comingSoonState
    },
    inboxes: {
      "@maia/todos/inbox/vibe": vibeInbox$2,
      "@maia/todos/inbox/list": listInbox,
      "@maia/todos/inbox/coming-soon": comingSoonInbox
    },
    data: {
      todos: [
        { text: "Welcome to MaiaOS! 🎉", done: false },
        { text: "Toggle me to mark as complete", done: false }
      ]
    }
  };
  const loadTodosVibe = createVibeLoader("todos", TodosVibeRegistry, ["db", "core"]);
  const dbVibe = {
    "$schema": "@maia/schema/vibe",
    "$id": "@maia/vibe/db",
    "name": "MaiaDB",
    "description": "Database viewer with navigation and detail panels",
    "actor": "@maia/db/actor/vibe"
  };
  const brandStyle$1 = {
    "$schema": "@maia/schema/style",
    "$id": "@maia/db/style/brand",
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
  const vibeActor$1 = {
    "$schema": "@maia/schema/actor",
    "$id": "@maia/db/actor/vibe",
    "role": "agent",
    "context": "@maia/db/context/vibe",
    "view": "@maia/db/view/vibe",
    "state": "@maia/db/state/vibe",
    "brand": "@maia/db/style/brand",
    "inbox": "@maia/db/inbox/vibe",
    "messageTypes": [
      "SELECT_NAV",
      "SELECT_ROW"
    ]
  };
  const tableActor = {
    "$schema": "@maia/schema/actor",
    "$id": "@maia/db/actor/table",
    "role": "ui",
    "context": "@maia/db/context/table",
    "view": "@maia/db/view/table",
    "state": "@maia/db/state/table",
    "brand": "@maia/db/style/brand",
    "inbox": "@maia/db/inbox/table",
    "messageTypes": [
      "SELECT_ROW"
    ]
  };
  const detailActor$1 = {
    "$schema": "@maia/schema/actor",
    "$id": "@maia/db/actor/detail",
    "role": "ui",
    "context": "@maia/db/context/detail",
    "view": "@maia/db/view/detail",
    "state": "@maia/db/state/detail",
    "brand": "@maia/db/style/brand",
    "inbox": "@maia/db/inbox/detail",
    "messageTypes": []
  };
  const vibeView$1 = {
    "$schema": "@maia/schema/view",
    "$id": "@maia/db/view/vibe",
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
                                  "payload": {
                                    "navId": "$$id"
                                  }
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
    "$schema": "@maia/schema/view",
    "$id": "@maia/db/view/table",
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
                      "payload": {
                        "rowId": "$$id"
                      }
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
  const detailView$1 = {
    "$schema": "@maia/schema/view",
    "$id": "@maia/db/view/detail",
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
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.id"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.id"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.name"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.name"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.email"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.email"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.role"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.role"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.status"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.status"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.createdAt"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.createdAt"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.lastLogin"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.lastLogin"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.bio"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.bio"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.department"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.department"
                }
              ]
            },
            {
              "tag": "div",
              "class": "detail-item",
              "children": [
                {
                  "tag": "span",
                  "class": "detail-label",
                  "text": "$detailLabels.phone"
                },
                {
                  "tag": "span",
                  "class": "detail-value",
                  "text": "$detail.phone"
                }
              ]
            }
          ]
        }
      ]
    }
  };
  const vibeContext$1 = {
    "$schema": "@maia/schema/context",
    "$id": "@maia/db/context/vibe",
    "navTitle": "MaiaDB",
    "navCategories": [
      {
        "category": "Account",
        "items": [
          {
            "id": "account",
            "label": "Owner"
          },
          {
            "id": "group",
            "label": "Avatar"
          }
        ]
      },
      {
        "category": "Vibes",
        "items": [
          {
            "id": "maia-db",
            "label": "MaiaDB"
          },
          {
            "id": "todos",
            "label": "Todos"
          }
        ]
      },
      {
        "category": "OS",
        "items": [
          {
            "id": "schemata",
            "label": "Schemata"
          },
          {
            "id": "indexes",
            "label": "Indexes"
          }
        ]
      }
    ],
    "selectedNavId": "account",
    "selectedRowId": "1",
    "selectedNavItems": {
      "account": true
    },
    "selectedRowItems": {
      "1": true
    },
    "currentTable": "@table",
    "currentDetail": "@detail",
    "@actors": {
      "table": "@maia/db/actor/table",
      "detail": "@maia/db/actor/detail"
    }
  };
  const tableContext = {
    "$schema": "@maia/schema/context",
    "$id": "@maia/db/context/table",
    "table": [
      {
        "id": "1",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "admin",
        "status": "active",
        "createdAt": "2024-01-15"
      },
      {
        "id": "2",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "role": "user",
        "status": "active",
        "createdAt": "2024-01-20"
      },
      {
        "id": "3",
        "name": "Bob Johnson",
        "email": "bob@example.com",
        "role": "user",
        "status": "inactive",
        "createdAt": "2024-02-01"
      },
      {
        "id": "4",
        "name": "Alice Williams",
        "email": "alice@example.com",
        "role": "moderator",
        "status": "active",
        "createdAt": "2024-02-10"
      },
      {
        "id": "5",
        "name": "Charlie Brown",
        "email": "charlie@example.com",
        "role": "user",
        "status": "pending",
        "createdAt": "2024-02-15"
      }
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
  const detailContext$1 = {
    "$schema": "@maia/schema/context",
    "$id": "@maia/db/context/detail",
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
  const vibeState$1 = {
    "$schema": "@maia/schema/state",
    "$id": "@maia/db/state/vibe",
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
                  "selectedNavItems": {
                    "$$navId": true
                  }
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
                  "selectedRowItems": {
                    "$$rowId": true
                  }
                }
              }
            ]
          }
        }
      }
    }
  };
  const tableState = {
    "$schema": "@maia/schema/state",
    "$id": "@maia/db/state/table",
    "initial": "idle",
    "states": {
      "idle": {
        "on": {
          "SELECT_ROW": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "selectedRowId": "$$rowId"
                }
              }
            ]
          }
        }
      }
    }
  };
  const detailState$1 = {
    "$schema": "@maia/schema/state",
    "$id": "@maia/db/state/detail",
    "initial": "idle",
    "states": {
      "idle": {}
    }
  };
  const vibeInbox$1 = {
    "$schema": "@maia/schema/inbox",
    "$id": "@maia/db/inbox/vibe",
    "cotype": "costream"
  };
  const tableInbox = {
    "$schema": "@maia/schema/inbox",
    "$id": "@maia/db/inbox/table",
    "cotype": "costream"
  };
  const detailInbox$1 = {
    "$schema": "@maia/schema/inbox",
    "$id": "@maia/db/inbox/detail",
    "cotype": "costream"
  };
  const DbVibeRegistry = {
    vibe: dbVibe,
    styles: {
      "@maia/db/style/brand": brandStyle$1
    },
    actors: {
      "@maia/db/actor/vibe": vibeActor$1,
      "@maia/db/actor/table": tableActor,
      "@maia/db/actor/detail": detailActor$1
    },
    views: {
      "@maia/db/view/vibe": vibeView$1,
      "@maia/db/view/table": tableView,
      "@maia/db/view/detail": detailView$1
    },
    contexts: {
      "@maia/db/context/vibe": vibeContext$1,
      "@maia/db/context/table": tableContext,
      "@maia/db/context/detail": detailContext$1
    },
    states: {
      "@maia/db/state/vibe": vibeState$1,
      "@maia/db/state/table": tableState,
      "@maia/db/state/detail": detailState$1
    },
    inboxes: {
      "@maia/db/inbox/vibe": vibeInbox$1,
      "@maia/db/inbox/table": tableInbox,
      "@maia/db/inbox/detail": detailInbox$1
    },
    // No initial data - this vibe uses mocked data in context
    data: {}
  };
  const loadDbVibe = createVibeLoader("db", DbVibeRegistry, ["db", "core"]);
  const sparksVibe = {
    "$schema": "@maia/schema/vibe",
    "$id": "@maia/vibe/sparks",
    "name": "Sparks",
    "description": "Create and manage collaborative groups (sparks)",
    "actor": "@maia/sparks/actor/vibe"
  };
  const brandStyle = {
    "$schema": "@maia/schema/style",
    "$id": "@maia/sparks/style/brand",
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
        "error": "#DC3545",
        "errorBg": "rgba(220, 53, 69, 0.1)",
        "errorBorder": "rgba(220, 53, 69, 0.2)",
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
      "sparksTitle": {
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
      },
      "errorMessage": {
        "padding": "{spacing.sm} {spacing.md}",
        "background": "{colors.errorBg}",
        "color": "{colors.error}",
        "borderRadius": "{radii.md}",
        "border": "1px solid {colors.errorBorder}",
        "margin": "{spacing.md} 0",
        "display": "none",
        "data": {
          "hasError": {
            "true": {
              "display": "block"
            }
          }
        }
      },
      "buttonDismiss": {
        "marginLeft": "{spacing.sm}",
        "padding": "0.25rem 0.5rem",
        "background": "transparent",
        "color": "{colors.error}",
        "border": "1px solid {colors.errorBorder}",
        "borderRadius": "{radii.sm}",
        "cursor": "pointer",
        "fontSize": "0.5rem",
        "fontWeight": "600",
        "transition": "{transitions.fast}",
        ":hover": {
          "background": "{colors.error}",
          "color": "white"
        }
      },
      "sparksList": {
        "display": "flex",
        "flexDirection": "column",
        "gap": "0.25rem",
        "width": "100%"
      },
      "sparkItem": {
        "padding": "0.5rem 0.75rem",
        "background": "rgba(255, 255, 255, 0.3)",
        "backdropFilter": "blur(4px)",
        "borderRadius": "{radii.md}",
        "border": "1px solid {colors.border}",
        "boxShadow": "{shadows.sm}",
        "display": "flex",
        "flexDirection": "column",
        "gap": "0.25rem"
      },
      "sparkName": {
        "fontFamily": "{typography.fontFamily.heading}",
        "fontSize": "0.75rem",
        "fontWeight": "{typography.fontWeight.bold}",
        "color": "{colors.marineBlue}",
        "margin": "0"
      },
      "sparkGroupId": {
        "fontSize": "0.6rem",
        "color": "{colors.marineBlueLight}",
        "fontFamily": "{typography.fontFamily.body}"
      },
      "splitContainer": {
        "display": "flex",
        "flexDirection": "row",
        "gap": "{spacing.md}",
        "width": "100%",
        "height": "100%",
        "overflow": "hidden"
      },
      "sparksListPanel": {
        "width": "50%",
        "display": "flex",
        "flexDirection": "column",
        "overflowY": "auto",
        "overflowX": "hidden",
        "paddingRight": "{spacing.sm}"
      },
      "sparksDetailPanel": {
        "width": "50%",
        "display": "flex",
        "flexDirection": "column",
        "overflowY": "auto",
        "overflowX": "hidden",
        "paddingLeft": "{spacing.sm}"
      },
      "detailContentWrapper": {
        "display": "flex",
        "flexDirection": "column",
        "height": "100%",
        "width": "100%"
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
      "detailCategory": {
        "fontFamily": "{typography.fontFamily.heading}",
        "fontSize": "0.85rem",
        "fontStyle": "italic",
        "color": "{colors.paradiseWater}",
        "marginBottom": "0.5rem",
        "display": "block",
        "textShadow": "0 0 10px rgba(0, 189, 214, 0.2)"
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
      "detailList": {
        "display": "flex",
        "flexDirection": "column",
        "gap": "{spacing.sm}"
      },
      "detailItem": {
        "display": "flex",
        "flexDirection": "row",
        "justifyContent": "space-between",
        "alignItems": "center",
        "padding": "{spacing.sm}",
        "background": "rgba(255, 255, 255, 0.2)",
        "borderRadius": "{radii.md}",
        "gap": "{spacing.md}"
      },
      "detailLabel": {
        "fontWeight": "{typography.fontWeight.semibold}",
        "color": "{colors.marineBlueLight}",
        "fontSize": "0.75rem"
      },
      "detailValue": {
        "color": "{colors.marineBlue}",
        "fontSize": "0.75rem",
        "fontFamily": "{typography.fontFamily.body}",
        "wordBreak": "break-all"
      },
      "membersTitle": {
        "fontFamily": "{typography.fontFamily.heading}",
        "fontSize": "{typography.fontSize.lg}",
        "fontWeight": "{typography.fontWeight.bold}",
        "color": "{colors.marineBlue}",
        "marginTop": "{spacing.lg}",
        "marginBottom": "{spacing.md}"
      },
      "membersList": {
        "display": "flex",
        "flexDirection": "column",
        "gap": "{spacing.sm}"
      },
      "memberItem": {
        "display": "flex",
        "flexDirection": "row",
        "justifyContent": "space-between",
        "alignItems": "center",
        "padding": "{spacing.sm}",
        "background": "rgba(255, 255, 255, 0.3)",
        "borderRadius": "{radii.md}",
        "border": "1px solid {colors.border}",
        "gap": "{spacing.md}"
      },
      "memberId": {
        "color": "{colors.marineBlue}",
        "fontSize": "0.7rem",
        "fontFamily": "{typography.fontFamily.body}",
        "wordBreak": "break-all",
        "flex": "1"
      },
      "memberRole": {
        "padding": "0.25rem 0.5rem",
        "borderRadius": "{radii.sm}",
        "fontSize": "0.6rem",
        "fontWeight": "{typography.fontWeight.bold}",
        "textTransform": "uppercase",
        "letterSpacing": "0.05em"
      },
      "memberRemoveButton": {
        "padding": "0.15rem 0.4rem",
        "minWidth": "1.5rem",
        "fontSize": "1rem",
        "lineHeight": "1",
        "color": "#DC3545",
        "background": "rgba(220, 53, 69, 0.15)",
        "border": "1px solid rgba(220, 53, 69, 0.4)",
        "borderRadius": "{radii.sm}",
        "cursor": "pointer"
      }
    },
    "selectors": {
      ":host": {
        "display": "block",
        "height": "100%",
        "background": "transparent"
      },
      ".spark-item[data-selected='true']": {
        "background": "rgba(0, 189, 214, 0.2)",
        "borderColor": "{colors.paradiseWater}",
        "boxShadow": "0 4px 12px rgba(0, 189, 214, 0.3)"
      },
      ".spark-item:hover": {
        "background": "rgba(255, 255, 255, 0.5)",
        "cursor": "pointer",
        "transform": "translateY(-1px)",
        "boxShadow": "{shadows.md}"
      },
      ".member-role[data-role='admin']": {
        "background": "rgba(220, 53, 69, 0.2)",
        "color": "#DC3545",
        "border": "1px solid rgba(220, 53, 69, 0.3)"
      },
      ".member-role[data-role='manager']": {
        "background": "rgba(255, 193, 7, 0.2)",
        "color": "#FFC107",
        "border": "1px solid rgba(255, 193, 7, 0.3)"
      },
      ".member-role[data-role='writer']": {
        "background": "rgba(78, 154, 88, 0.2)",
        "color": "{colors.lushGreen}",
        "border": "1px solid rgba(78, 154, 88, 0.3)"
      },
      ".member-role[data-role='reader']": {
        "background": "rgba(0, 189, 214, 0.2)",
        "color": "{colors.paradiseWater}",
        "border": "1px solid rgba(0, 189, 214, 0.3)"
      },
      ".member-role[data-role='writeOnly']": {
        "background": "rgba(230, 185, 77, 0.2)",
        "color": "{colors.sunYellow}",
        "border": "1px solid rgba(230, 185, 77, 0.3)"
      },
      ".empty-state": {
        "display": "none",
        "padding": "{spacing.lg}",
        "textAlign": "center",
        "color": "{colors.marineBlueLight}",
        "fontSize": "0.85rem"
      },
      ".empty-state[data-visible='true']": {
        "display": "block"
      },
      ".loading-state": {
        "display": "none",
        "padding": "{spacing.lg}",
        "textAlign": "center",
        "color": "{colors.marineBlueLight}",
        "fontSize": "0.85rem"
      },
      ".loading-state[data-visible='true']": {
        "display": "block"
      },
      ".error-state": {
        "display": "none",
        "padding": "{spacing.md}",
        "background": "{colors.errorBg}",
        "color": "{colors.error}",
        "borderRadius": "{radii.md}",
        "border": "1px solid {colors.errorBorder}",
        "marginBottom": "{spacing.md}"
      },
      ".error-state[data-visible='true']": {
        "display": "block"
      },
      ".detail-content": {
        "display": "none"
      },
      ".detail-content[data-visible='true']": {
        "display": "flex",
        "flexDirection": "column"
      },
      ".empty-members": {
        "display": "none",
        "padding": "{spacing.md}",
        "textAlign": "center",
        "color": "{colors.marineBlueLight}",
        "fontSize": "0.75rem"
      },
      ".empty-members[data-visible='true']": {
        "display": "block"
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
        ".sparksTitle": {
          "fontSize": "1.15rem"
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
        },
        ".sparkItem": {
          "padding": "0.625rem 0.875rem"
        },
        ".sparkName": {
          "fontSize": "0.85rem"
        },
        ".sparkGroupId": {
          "fontSize": "0.65rem"
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
        ".sparksTitle": {
          "fontSize": "1.3rem"
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
        },
        ".sparkItem": {
          "padding": "0.75rem 1rem"
        },
        ".sparkName": {
          "fontSize": "0.95rem"
        },
        ".sparkGroupId": {
          "fontSize": "0.7rem"
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
        ".sparksTitle": {
          "fontSize": "1.45rem"
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
        },
        ".sparkItem": {
          "padding": "0.875rem 1.125rem"
        },
        ".sparkName": {
          "fontSize": "1.1rem"
        },
        ".sparkGroupId": {
          "fontSize": "0.75rem"
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
        ".sparksTitle": {
          "fontSize": "1.55rem"
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
        },
        ".sparkItem": {
          "padding": "1rem 1.25rem"
        },
        ".sparkName": {
          "fontSize": "1.2rem"
        },
        ".sparkGroupId": {
          "fontSize": "0.8rem"
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
        ".sparksTitle": {
          "fontSize": "1.65rem"
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
        },
        ".sparkItem": {
          "padding": "1.125rem 1.375rem"
        },
        ".sparkName": {
          "fontSize": "1.3rem"
        },
        ".sparkGroupId": {
          "fontSize": "0.85rem"
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
        ".sparksTitle": {
          "fontSize": "1.75rem"
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
        },
        ".sparkItem": {
          "padding": "1.25rem 1.5rem"
        },
        ".sparkName": {
          "fontSize": "1.4rem"
        },
        ".sparkGroupId": {
          "fontSize": "0.9rem"
        }
      }
    }
  };
  const vibeActor = {
    "$schema": "@maia/schema/actor",
    "$id": "@maia/sparks/actor/vibe",
    "type": "service",
    "state": "@maia/sparks/state/vibe",
    "view": "@maia/sparks/view/vibe",
    "context": "@maia/sparks/context/vibe",
    "brand": "@maia/sparks/style/brand",
    "inbox": "@maia/sparks/inbox/vibe",
    "messageTypes": [
      "CREATE_BUTTON",
      "UPDATE_INPUT",
      "SELECT_SPARK",
      "SUCCESS",
      "ERROR",
      "DISMISS"
    ]
  };
  const detailActor = {
    "$schema": "@maia/schema/actor",
    "$id": "@maia/sparks/actor/detail",
    "role": "ui",
    "context": "@maia/sparks/context/detail",
    "view": "@maia/sparks/view/detail",
    "state": "@maia/sparks/state/detail",
    "brand": "@maia/sparks/style/brand",
    "inbox": "@maia/sparks/inbox/detail",
    "messageTypes": [
      "LOAD_ACTOR",
      "SUCCESS",
      "ADD_AGENT",
      "REMOVE_MEMBER",
      "UPDATE_AGENT_INPUT",
      "ERROR"
    ]
  };
  const vibeView = {
    "$schema": "@maia/schema/view",
    "$id": "@maia/sparks/view/vibe",
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
              "class": "sparks-title",
              "text": "My Sparks"
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
              "value": "$newSparkName",
              "$on": {
                "input": {
                  "send": "UPDATE_INPUT",
                  "payload": {
                    "value": "@inputValue"
                  }
                },
                "blur": {
                  "send": "UPDATE_INPUT",
                  "payload": {
                    "value": "@inputValue"
                  }
                },
                "keydown": {
                  "send": "CREATE_BUTTON",
                  "payload": {
                    "value": "@inputValue"
                  },
                  "key": "Enter"
                }
              }
            },
            {
              "tag": "button",
              "class": "button",
              "text": "$createButtonText",
              "$on": {
                "click": {
                  "send": "CREATE_BUTTON",
                  "payload": {
                    "value": "@inputValue"
                  }
                }
              }
            }
          ]
        },
        {
          "tag": "div",
          "class": "error-message",
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
              "class": "button-dismiss",
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
          "class": "split-container",
          "children": [
            {
              "tag": "div",
              "class": "sparks-list-panel",
              "children": [
                {
                  "tag": "div",
                  "class": "sparks-list",
                  "$each": {
                    "items": "$sparks",
                    "template": {
                      "tag": "div",
                      "class": "spark-item",
                      "children": [
                        {
                          "tag": "h3",
                          "class": "spark-name",
                          "text": "$$name"
                        }
                      ],
                      "$on": {
                        "click": {
                          "send": "SELECT_SPARK",
                          "payload": {
                            "sparkId": "$$id"
                          }
                        }
                      }
                    }
                  }
                }
              ]
            },
            {
              "tag": "div",
              "class": "sparks-detail-panel",
              "children": [
                {
                  "tag": "div",
                  "class": "detail-content-wrapper",
                  "$slot": "$currentDetail"
                }
              ]
            }
          ]
        }
      ]
    }
  };
  const detailView = {
    "$schema": "@maia/schema/view",
    "$id": "@maia/sparks/view/detail",
    "content": {
      "tag": "div",
      "class": "detail-container",
      "children": [
        {
          "tag": "div",
          "class": "empty-state",
          "attrs": {
            "data": {
              "visible": "$showEmptyState"
            }
          },
          "children": [
            {
              "tag": "p",
              "text": "Select a spark to view details and members"
            }
          ]
        },
        {
          "tag": "div",
          "class": "detail-content",
          "attrs": {
            "data": {
              "visible": "$showContent"
            }
          },
          "children": [
            {
              "tag": "span",
              "class": "detail-category",
              "text": "Spark Details"
            },
            {
              "tag": "h2",
              "class": "detail-title",
              "text": "$sparkDetails.name"
            },
            {
              "tag": "div",
              "class": "detail-list",
              "children": [
                {
                  "tag": "div",
                  "class": "detail-item",
                  "children": [
                    {
                      "tag": "span",
                      "class": "detail-label",
                      "text": "Group ID"
                    },
                    {
                      "tag": "span",
                      "class": "detail-value",
                      "text": "$sparkDetails.groupId"
                    }
                  ]
                }
              ]
            },
            {
              "tag": "h3",
              "class": "members-title",
              "text": "Members"
            },
            {
              "tag": "div",
              "class": "members-list",
              "$each": {
                "items": "$sparkDetails.members",
                "template": {
                  "tag": "div",
                  "class": "member-item",
                  "children": [
                    {
                      "tag": "span",
                      "class": "member-id",
                      "text": "$$id"
                    },
                    {
                      "tag": "span",
                      "class": "member-role",
                      "attrs": {
                        "data": {
                          "role": "$$role"
                        }
                      },
                      "text": "$$role"
                    },
                    {
                      "tag": "button",
                      "class": "member-remove-button",
                      "text": "×",
                      "$on": {
                        "click": {
                          "send": "REMOVE_MEMBER",
                          "payload": {
                            "memberId": "$$id"
                          }
                        }
                      }
                    }
                  ]
                }
              }
            },
            {
              "tag": "h3",
              "class": "members-title add-agent-title",
              "text": "Add Agent"
            },
            {
              "tag": "div",
              "class": "form add-agent-form",
              "children": [
                {
                  "tag": "input",
                  "class": "input",
                  "attrs": {
                    "type": "text",
                    "placeholder": "Agent account co-id (e.g. co_z...)"
                  },
                  "value": "$agentIdInput",
                  "$on": {
                    "input": {
                      "send": "UPDATE_AGENT_INPUT",
                      "payload": {
                        "value": "@inputValue"
                      }
                    },
                    "blur": {
                      "send": "UPDATE_AGENT_INPUT",
                      "payload": {
                        "value": "@inputValue"
                      }
                    },
                    "keydown": {
                      "send": "ADD_AGENT",
                      "payload": {
                        "agentId": "@inputValue"
                      },
                      "key": "Enter"
                    }
                  }
                },
                {
                  "tag": "button",
                  "class": "button",
                  "text": "Add as writer",
                  "$on": {
                    "click": {
                      "send": "ADD_AGENT",
                      "payload": {
                        "agentId": "$agentIdInput"
                      }
                    }
                  }
                }
              ]
            },
            {
              "tag": "div",
              "class": "error-message add-agent-error",
              "attrs": {
                "data": {
                  "hasError": "$addAgentHasError"
                }
              },
              "children": [
                {
                  "tag": "strong",
                  "text": "Error: "
                },
                {
                  "text": "$addAgentError"
                }
              ]
            }
          ]
        }
      ]
    }
  };
  const vibeContext = {
    "$schema": "@maia/schema/context",
    "$id": "@maia/sparks/context/vibe",
    "sparks": {
      "schema": "@maia/schema/data/spark"
    },
    "newSparkName": "",
    "inputPlaceholder": "Enter spark name...",
    "createButtonText": "Create Spark",
    "error": null,
    "hasError": false,
    "loading": false,
    "selectedSparkId": null,
    "selectedSparkItems": {},
    "currentDetail": "@detail",
    "@actors": {
      "detail": "@maia/sparks/actor/detail"
    }
  };
  const detailContext = {
    "$schema": "@maia/schema/context",
    "$id": "@maia/sparks/context/detail",
    "sparkId": null,
    "sparkDetails": {
      "schema": "@maia/schema/data/spark",
      "filter": {
        "id": "$sparkId"
      },
      "options": {
        "map": {
          "members": "$$os.capabilities.guardian.accountMembers",
          "groupId": "$$os.capabilities.guardian.id"
        }
      }
    },
    "hasSpark": false,
    "showEmptyState": true,
    "showContent": false,
    "agentIdInput": "",
    "addAgentError": null,
    "addAgentHasError": false
  };
  const vibeState = {
    "$schema": "@maia/schema/state",
    "$id": "@maia/sparks/state/vibe",
    "initial": "idle",
    "states": {
      "idle": {
        "on": {
          "CREATE_BUTTON": {
            "target": "creating"
          },
          "UPDATE_INPUT": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "newSparkName": "$$value"
                }
              }
            ]
          },
          "SELECT_SPARK": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "selectedSparkId": "$$sparkId"
                }
              },
              "sendToDetailActor"
            ]
          }
        }
      },
      "creating": {
        "entry": {
          "tool": "@sparks",
          "payload": {
            "op": "createSpark",
            "name": "$$value"
          }
        },
        "on": {
          "SUCCESS": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "newSparkName": "",
                  "error": null,
                  "hasError": false
                }
              }
            ]
          },
          "ERROR": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "error": "$$errors.0.message",
                  "hasError": true
                }
              }
            ]
          }
        }
      },
      "error": {
        "entry": {
          "updateContext": {
            "error": "$$errors.0.message"
          }
        },
        "on": {
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
  const detailState = {
    "$schema": "@maia/schema/state",
    "$id": "@maia/sparks/state/detail",
    "initial": "idle",
    "states": {
      "idle": {
        "on": {
          "LOAD_ACTOR": {
            "target": "updating",
            "actions": [
              {
                "updateContext": {
                  "sparkId": "$$id"
                }
              }
            ]
          },
          "UPDATE_AGENT_INPUT": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "agentIdInput": "$$value"
                }
              }
            ]
          },
          "ADD_AGENT": {
            "target": "addingAgent"
          },
          "REMOVE_MEMBER": {
            "target": "removingMember"
          }
        },
        "entry": {
          "updateContext": {
            "hasSpark": {
              "$ne": [
                "$sparkId",
                null
              ]
            },
            "showEmptyState": {
              "$eq": [
                "$sparkId",
                null
              ]
            },
            "showContent": {
              "$ne": [
                "$sparkId",
                null
              ]
            }
          }
        }
      },
      "updating": {
        "entry": {
          "updateContext": {
            "hasSpark": {
              "$ne": [
                "$sparkId",
                null
              ]
            },
            "showEmptyState": {
              "$eq": [
                "$sparkId",
                null
              ]
            },
            "showContent": {
              "$ne": [
                "$sparkId",
                null
              ]
            }
          }
        },
        "on": {
          "SUCCESS": {
            "target": "idle"
          }
        }
      },
      "addingAgent": {
        "entry": {
          "tool": "@sparks",
          "payload": {
            "op": "addSparkMember",
            "id": "$sparkId",
            "memberId": "$$agentId",
            "role": "writer"
          }
        },
        "on": {
          "SUCCESS": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "agentIdInput": "",
                  "addAgentError": null,
                  "addAgentHasError": false
                }
              }
            ]
          },
          "ERROR": {
            "target": "idle",
            "actions": [
              {
                "updateContext": {
                  "addAgentError": "$$errors.0.message",
                  "addAgentHasError": true
                }
              }
            ]
          }
        }
      },
      "removingMember": {
        "entry": {
          "tool": "@sparks",
          "payload": {
            "op": "removeSparkMember",
            "id": "$sparkId",
            "memberId": "$$memberId"
          }
        },
        "on": {
          "SUCCESS": {
            "target": "idle"
          },
          "ERROR": {
            "target": "idle"
          }
        }
      }
    }
  };
  const vibeInbox = {
    "$schema": "@maia/schema/inbox",
    "$id": "@maia/sparks/inbox/vibe",
    "cotype": "costream"
  };
  const detailInbox = {
    "$schema": "@maia/schema/inbox",
    "$id": "@maia/sparks/inbox/detail",
    "cotype": "costream"
  };
  const SparksVibeRegistry = {
    vibe: sparksVibe,
    styles: {
      "@maia/sparks/style/brand": brandStyle
    },
    actors: {
      "@maia/sparks/actor/vibe": vibeActor,
      "@maia/sparks/actor/detail": detailActor
    },
    views: {
      "@maia/sparks/view/vibe": vibeView,
      "@maia/sparks/view/detail": detailView
    },
    contexts: {
      "@maia/sparks/context/vibe": vibeContext,
      "@maia/sparks/context/detail": detailContext
    },
    states: {
      "@maia/sparks/state/vibe": vibeState,
      "@maia/sparks/state/detail": detailState
    },
    inboxes: {
      "@maia/sparks/inbox/vibe": vibeInbox,
      "@maia/sparks/inbox/detail": detailInbox
    }
  };
  async function loadSparksVibe(maia, container) {
    if (!maia || !container) {
      throw new Error("[SparksVibe] MaiaOS instance and container required");
    }
    const vibe = SparksVibeRegistry.vibe;
    if (!vibe) {
      throw new Error("[SparksVibe] Vibe not found in registry");
    }
    const actorConfig = SparksVibeRegistry.actors[vibe.actor];
    if (!actorConfig) {
      throw new Error(`[SparksVibe] Actor ${vibe.actor} not found in registry`);
    }
    const actor = await maia.actors.create(actorConfig, container);
    return {
      vibe,
      actor
    };
  }
  const REGISTRY_IMPORTS = [
    ["./todos/registry.js", "TodosVibeRegistry"],
    ["./chat/registry.js", "ChatVibeRegistry"],
    ["./db/registry.js", "DbVibeRegistry"],
    ["./sparks/registry.js", "SparksVibeRegistry"],
    ["./creator/registry.js", "CreatorVibeRegistry"]
  ];
  async function getAllVibeRegistries() {
    const registries = [];
    for (const [path, name] of REGISTRY_IMPORTS) {
      try {
        const m = await import(path);
        const R = m[name];
        if (R?.vibe) registries.push(R);
      } catch (e) {
        console.warn(`[Vibes] Could not load ${name}:`, e.message);
      }
    }
    return registries;
  }
  function getVibeKey(vibe) {
    if (!vibe) return null;
    const originalVibeId = vibe.$id || "";
    if (originalVibeId.startsWith("@maia/vibe/")) {
      return originalVibeId.replace("@maia/vibe/", "");
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
      return vibeRegistries.filter((registry) => {
        if (!registry.vibe) return false;
        const vibeKey = getVibeKey(registry.vibe);
        return configKeys.includes(vibeKey);
      });
    }
    console.warn(`[Vibes] Invalid seeding config: ${config}. Expected null, "all", or array of vibe keys.`);
    return [];
  }
  Object.defineProperty(exports2, "MaiaOS", {
    enumerable: true,
    get: () => kernel.MaiaOS
  });
  exports2.DbRegistry = DbVibeRegistry;
  exports2.DbVibeRegistry = DbVibeRegistry;
  exports2.SparksRegistry = SparksVibeRegistry;
  exports2.SparksVibeRegistry = SparksVibeRegistry;
  exports2.TodosRegistry = TodosVibeRegistry;
  exports2.TodosVibeRegistry = TodosVibeRegistry;
  exports2.filterVibesForSeeding = filterVibesForSeeding;
  exports2.getAllVibeRegistries = getAllVibeRegistries;
  exports2.loadDbVibe = loadDbVibe;
  exports2.loadSparksVibe = loadSparksVibe;
  exports2.loadTodosVibe = loadTodosVibe;
  Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
}));
//# sourceMappingURL=maia-vibes.umd.js.map
