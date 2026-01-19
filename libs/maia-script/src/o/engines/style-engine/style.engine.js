// Import validation helper
import { validateOrThrow, validateAgainstSchemaOrThrow } from '../../../schemata/validation.helper.js';
// Import schema loader utility
import { loadSchemaFromDB } from '../../../schemata/schema-loader.js';

/**
 * StyleEngine - Compiles .maia style files to CSS with Constructable Stylesheets
 * Handles: Brand design system + Actor overrides, Shadow DOM isolation
 */
export class StyleEngine {
  constructor() {
    this.cache = new Map(); // Cache compiled stylesheets by ID
    this.dbEngine = null; // Database operation engine (set by kernel)
  }

  /**
   * Resolve a style reference to key name
   * @param {string} ref - Style reference (e.g., './brand', 'co_brand_001')
   * @returns {string} The style key
   */
  resolveStyleRef(ref) {
    // Legacy CoMap ID mappings (for backwards compatibility during migration)
    const coMapToKey = {
      'co_brand_001': 'brand',
      'co_brand_002': 'sunset',
      'co_todo_001': 'todo'
    };
    
    // If it's a CoMap ID, map to key
    if (coMapToKey[ref]) {
      return coMapToKey[ref];
    }
    
    // Extract key from relative path or use as-is
    return ref.replace('./', '').replace('.style.maia', '');
  }

  /**
   * Load a .maia style file
   * @param {string} path - Path to the .maia file
   * @returns {Promise<Object>} The parsed JSON
   */
  async loadStyle(path) {
    // Load from database via maia.db()
    if (this.dbEngine) {
      const styleKey = path.replace('./', '').replace('.style.maia', '');
      const styleDef = await this.dbEngine.execute({
        op: 'query',
        schema: '@schema/style',
        key: styleKey
      });
      
      if (styleDef) {
        // Validate style data (determine type from $type field)
        const type = styleDef.$type === 'brand.style' ? 'brandStyle' : 'style';
        
        // Load schema from IndexedDB and validate on-the-fly
        const schema = await loadSchemaFromDB(this.dbEngine, type);
        if (schema) {
          await validateAgainstSchemaOrThrow(schema, styleDef, type);
        }
        
        return styleDef;
      }
      
      throw new Error(`Failed to load style from database: ${styleKey}`);
    }
    
    throw new Error(`[StyleEngine] Database engine not available`);
  }

  /**
   * Deep merge two objects (actor wins on conflicts)
   * @param {Object} target - Base object (brand)
   * @param {Object} source - Override object (actor)
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
        output[key] = this.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }

  /**
   * Compile modifier styles (handles nested objects recursively)
   * @param {Object} styles - The modifier styles object
   * @param {Object} tokens - The tokens for interpolation
   * @returns {string} CSS properties string
   */
  compileModifierStyles(styles, tokens) {
    if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) {
      return '';
    }
    
    return Object.entries(styles)
      .map(([prop, value]) => {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        const cssValue = this.interpolateTokens(value, tokens);
        return `  ${cssProp}: ${cssValue};`;
      })
      .join('\n');
  }

  /**
   * Interpolate {token.path} references in a string
   * @param {string} value - The value with {token.path} placeholders
   * @param {Object} tokens - The token object
   * @returns {string} The interpolated value
   */
  interpolateTokens(value, tokens) {
    if (typeof value !== 'string') return value;
    
    return value.replace(/\{([^}]+)\}/g, (match, path) => {
      const tokenValue = this.resolvePath(tokens, path);
      return tokenValue !== undefined ? tokenValue : match;
    });
  }

  /**
   * Resolve a dot-separated path in an object
   * @param {Object} obj - The object to traverse
   * @param {string} path - Dot-separated path
   * @returns {any} The resolved value
   */
  resolvePath(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  /**
   * Flatten nested tokens into CSS variable names
   * @param {Object} tokens - The token object
   * @param {string} prefix - The prefix for variable names
   * @returns {Object} Flattened key-value pairs
   */
  flattenTokens(tokens, prefix = '') {
    const result = {};
    
    for (const [key, value] of Object.entries(tokens)) {
      const varName = prefix ? `${prefix}-${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, this.flattenTokens(value, varName));
      } else {
        // Leaf value - create CSS variable
        result[`--${varName}`] = value;
      }
    }
    
    return result;
  }

  /**
   * Compile tokens to CSS variables
   * @param {Object} tokens - The merged token object
   * @returns {string} CSS variable declarations
   */
  compileTokensToCSS(tokens) {
    const flatTokens = this.flattenTokens(tokens);
    const cssVars = Object.entries(flatTokens)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n');
    
    return `:host {\n${cssVars}\n}\n`;
  }

  /**
   * Convert camelCase to kebab-case
   * @param {string} str - camelCase string
   * @returns {string} kebab-case string
   */
  _toKebabCase(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Compile data-attribute selectors from nested data tree
   * @param {string} baseSelector - Base selector (e.g., ".kanban-column-content")
   * @param {Object} dataTree - Nested data tree
   * @param {Object} tokens - Tokens for interpolation
   * @param {string} currentPath - Current selector path (for nested data)
   * @returns {Array} Array of CSS rule strings
   */
  _compileDataAttributeSelectors(baseSelector, dataTree, tokens, currentPath = '') {
    const cssRules = [];
    
    if (!dataTree || typeof dataTree !== 'object' || Array.isArray(dataTree)) {
      return cssRules;
    }
    
    // Process each data key (e.g., "dragOver", "draggedItemId")
    for (const [dataKey, dataValue] of Object.entries(dataTree)) {
      if (typeof dataValue !== 'object' || dataValue === null || Array.isArray(dataValue)) {
        continue;
      }
      
      const kebabDataKey = this._toKebabCase(dataKey);
      
      // Process each value for this data key (e.g., "todo", "done", "item-123")
      for (const [valueKey, styles] of Object.entries(dataValue)) {
        if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) {
          continue;
        }
        
        const kebabValueKey = this._toKebabCase(valueKey);
        const dataAttr = `[data-${kebabDataKey}="${kebabValueKey}"]`;
        const selector = `${baseSelector}${currentPath}${dataAttr}`;
        
        // Separate CSS properties, pseudo-selectors, and nested data
        const cssProps = {};
        const pseudoSelectors = {};
        let nestedData = null;
        
        for (const [prop, propValue] of Object.entries(styles)) {
          if (prop === 'data') {
            nestedData = propValue;
          } else if (prop.startsWith(':')) {
            pseudoSelectors[prop] = propValue;
          } else {
            cssProps[prop] = propValue;
          }
        }
        
        // Generate CSS for this selector
        if (Object.keys(cssProps).length > 0) {
          const cssProperties = this.compileModifierStyles(cssProps, tokens);
          cssRules.push(`${selector} {\n${cssProperties}\n}`);
        }
        
        // Handle pseudo-selectors on this data-attribute selector
        for (const [pseudo, pseudoStyles] of Object.entries(pseudoSelectors)) {
          const pseudoSelector = `${selector}${pseudo}`;
          const cssProperties = this.compileModifierStyles(pseudoStyles, tokens);
          cssRules.push(`${pseudoSelector} {\n${cssProperties}\n}`);
        }
        
        // Handle nested data (combine selectors - e.g., [data-state="dragging"][data-column="todo"])
        if (nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)) {
          const nestedRules = this._compileDataAttributeSelectors(
            baseSelector, 
            nestedData, 
            tokens, 
            `${currentPath}${dataAttr}`
          );
          cssRules.push(...nestedRules);
        }
      }
    }
    
    return cssRules;
  }

  /**
   * Compile components to CSS classes with support for:
   * - Pseudo-classes (:hover, :focus, etc.)
   * - Attribute selectors ([data-*])
   * - Descendant selectors (parent child)
   * - State-based styling
   * - Nested data-attribute syntax
   * @param {Object} components - The component definitions
   * @param {Object} tokens - The merged tokens for interpolation
   * @returns {string} CSS class declarations
   */
  compileComponentsToCSS(components, tokens) {
    if (!components || Object.keys(components).length === 0) {
      return '';
    }

    const cssRules = [];
    
    for (const [className, styles] of Object.entries(components)) {
      // Convert camelCase class name to kebab-case
      const kebabClassName = className.replace(/([A-Z])/g, '-$1').toLowerCase();
      
      // Extract data-attribute tree if present
      const dataTree = styles.data;
      const stylesWithoutData = { ...styles };
      delete stylesWithoutData.data;
      
      // Separate base styles from modifiers
      const baseStyles = {};
      const modifiers = {};
      
      for (const [prop, value] of Object.entries(stylesWithoutData)) {
        // Check if it's a modifier (pseudo-class, attribute selector, or nested object)
        const isModifier = prop.startsWith(':') || 
                          prop.startsWith('[') || 
                          (typeof value === 'object' && value !== null && !Array.isArray(value));
        
        if (isModifier) {
          modifiers[prop] = value;
        } else {
          baseStyles[prop] = value;
        }
      }
      
      // Compile base styles
      if (Object.keys(baseStyles).length > 0) {
        const cssProperties = Object.entries(baseStyles)
          .map(([prop, value]) => {
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            const cssValue = this.interpolateTokens(value, tokens);
            return `  ${cssProp}: ${cssValue};`;
          })
          .join('\n');
        cssRules.push(`.${kebabClassName} {\n${cssProperties}\n}`);
      }
      
      // Compile modifiers (pseudo-classes, attribute selectors, descendants)
      for (const [modifier, modifierStyles] of Object.entries(modifiers)) {
        // Build selector: .className + modifier
        let selector;
        if (modifier.startsWith(':')) {
          // Pseudo-class: .className:hover
          selector = `.${kebabClassName}${modifier}`;
        } else if (modifier.startsWith('[')) {
          // Attribute selector or attribute + descendant: .className[data-attr="value"] or .className[data-attr="value"] .child
          selector = `.${kebabClassName}${modifier}`;
        } else if (modifier.includes(' ')) {
          // Descendant selector: .className .child
          selector = `.${kebabClassName} ${modifier}`;
        } else {
          // Nested modifier object - treat as attribute selector
          selector = `.${kebabClassName}[${modifier}]`;
        }
        
        // Recursively compile nested styles
        const cssProperties = this.compileModifierStyles(modifierStyles, tokens);
        cssRules.push(`${selector} {\n${cssProperties}\n}`);
      }
      
      // Compile nested data-attribute selectors
      if (dataTree && typeof dataTree === 'object' && !Array.isArray(dataTree)) {
        const dataRules = this._compileDataAttributeSelectors(`.${kebabClassName}`, dataTree, tokens);
        cssRules.push(...dataRules);
      }
    }
    
    return cssRules.join('\n\n');
  }

  /**
   * Compile advanced selectors (parent state cascading, attribute selectors, etc.)
   * @param {Object} selectors - Selector definitions { "selector": { styles } }
   * @param {Object} tokens - The merged tokens for interpolation
   * @returns {string} CSS selector rules
   */
  compileSelectors(selectors, tokens) {
    if (!selectors || Object.keys(selectors).length === 0) {
      return '';
    }

    const cssRules = [];
    
    for (const [selector, styles] of Object.entries(selectors)) {
      const cssProperties = Object.entries(styles)
        .map(([prop, value]) => {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          // Interpolate tokens (handles {token.path} syntax)
          let cssValue = this.interpolateTokens(value, tokens);
          // Preserve !important if present in the value
          return `  ${cssProp}: ${cssValue};`;
        })
        .join('\n');
      
      // Use selector as-is (already has proper CSS syntax from JSON)
      // JSON escaped quotes \" become " in the final CSS
      cssRules.push(`${selector} {\n${cssProperties}\n}`);
    }
    
    return cssRules.join('\n\n');
  }

  /**
   * Compile merged tokens and components to complete CSS
   * @param {Object} tokens - Merged tokens
   * @param {Object} components - Merged components
   * @param {Object} selectors - Advanced selector definitions
   * @param {string} rawCSS - Optional raw CSS string (fallback for edge cases)
   * @returns {string} Complete CSS
   */
  compileToCSS(tokens, components, selectors = {}, rawCSS = '') {
    const tokenCSS = this.compileTokensToCSS(tokens);
    const componentCSS = this.compileComponentsToCSS(components, tokens);
    const selectorCSS = this.compileSelectors(selectors, tokens);
    
    // Order matters: tokens → components → selectors (selectors override components)
    let css = `${tokenCSS}\n${componentCSS}`;
    
    if (selectorCSS) {
      css += `\n\n/* State-based selectors (Nue.js style: parent state cascades) */\n${selectorCSS}`;
    }
    
    // Append raw CSS only if absolutely necessary (fallback)
    if (rawCSS) {
      css += `\n\n/* Raw CSS fallback */\n${rawCSS}`;
    }
    
    return css;
  }

  /**
   * Get stylesheets for an actor (brand + actor overrides merged)
   * @param {Object} actorConfig - The actor configuration
   * @returns {Promise<CSSStyleSheet[]>} Array of stylesheets
   */
  async getStyleSheets(actorConfig) {
    const cacheKey = `${actorConfig.brandRef}_${actorConfig.styleRef || 'none'}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Resolve brand ref (CoMap ID → filename)
    const brandFile = this.resolveStyleRef(actorConfig.brandRef);
    const brand = await this.loadStyle(`./${brandFile}.style.maia`);
    
    // Load actor (overrides only) - optional
    const actor = actorConfig.styleRef 
      ? await this.loadStyle(`./${this.resolveStyleRef(actorConfig.styleRef)}.style.maia`)
      : { tokens: {}, components: {} };
    
    // Deep merge (actor wins on conflicts)
    const mergedTokens = this.deepMerge(brand.tokens || {}, actor.tokens || {});
    const mergedComponents = this.deepMerge(brand.components || {}, actor.components || {});
    const mergedSelectors = this.deepMerge(brand.selectors || {}, actor.selectors || {});
    
    // Merge raw CSS (brand first, then actor) - only as fallback
    const rawCSS = [brand.rawCSS, actor.rawCSS].filter(Boolean).join('\n\n');
    
    // Compile to CSS
    const css = this.compileToCSS(mergedTokens, mergedComponents, mergedSelectors, rawCSS);
    
    // Create Constructable Stylesheet
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    
    // Cache it
    const sheets = [sheet];
    this.cache.set(cacheKey, sheets);
    
    return sheets;
  }

  /**
   * Clear the cache (useful for development/hot reload)
   */
  clearCache() {
    this.cache.clear();
  }
  
}
