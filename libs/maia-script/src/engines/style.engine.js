import { getSchemaCoIdSafe } from '../utils/utils.js';

function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export class StyleEngine {
  constructor() {
    this.cache = new Map();
    this.dbEngine = null;
  }

  resolveStyleRef(ref) {
    if (!ref || !ref.startsWith('co_z')) {
      throw new Error(`[StyleEngine] Style reference must be a co-id (starts with 'co_z'), got: ${ref}`);
    }
    return ref;
  }

  async loadStyle(coId) {
    const styleSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: coId });
    const store = await this.dbEngine.execute({
      op: 'read',
      schema: styleSchemaCoId,
      key: coId
    });
    return store;
  }

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

  _interpolateTokens(value, tokens) {
    if (typeof value !== 'string') return value;
    return value.replace(/\{([^}]+)\}/g, (match, path) => {
      const tokenValue = resolvePath(tokens, path);
      return tokenValue !== undefined ? tokenValue : match;
    });
  }

  _toKebabCase(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  compileModifierStyles(styles, tokens) {
    if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) return '';
    return Object.entries(styles)
      .map(([prop, value]) => {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        const cssValue = this._interpolateTokens(value, tokens);
        return `  ${cssProp}: ${cssValue};`;
      })
      .join('\n');
  }

  _flattenTokens(tokens, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(tokens)) {
      const varName = prefix ? `${prefix}-${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this._flattenTokens(value, varName));
      } else {
        result[`--${varName}`] = value;
      }
    }
    return result;
  }

  compileTokensToCSS(tokens) {
    const flatTokens = this._flattenTokens(tokens);
    const cssVars = Object.entries(flatTokens)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n');
    return `:host {\n${cssVars}\n}\n`;
  }

  _compileDataAttributeSelectors(baseSelector, dataTree, tokens, currentPath = '') {
    const cssRules = [];
    if (!dataTree || typeof dataTree !== 'object' || Array.isArray(dataTree)) return cssRules;
    
    for (const [dataKey, dataValue] of Object.entries(dataTree)) {
      if (typeof dataValue !== 'object' || dataValue === null || Array.isArray(dataValue)) continue;
      
      const kebabDataKey = this._toKebabCase(dataKey);
      for (const [valueKey, styles] of Object.entries(dataValue)) {
        if (typeof styles !== 'object' || styles === null || Array.isArray(styles)) continue;
        
        const kebabValueKey = this._toKebabCase(valueKey);
        const dataAttr = `[data-${kebabDataKey}="${kebabValueKey}"]`;
        const selector = `${baseSelector}${currentPath}${dataAttr}`;
        
        const cssProps = {};
        const pseudoSelectors = {};
        let nestedData = null;
        
        for (const [prop, propValue] of Object.entries(styles)) {
          if (prop === 'data') nestedData = propValue;
          else if (prop.startsWith(':')) pseudoSelectors[prop] = propValue;
          else cssProps[prop] = propValue;
        }
        
        if (Object.keys(cssProps).length > 0) {
          cssRules.push(`${selector} {\n${this.compileModifierStyles(cssProps, tokens)}\n}`);
        }
        
        for (const [pseudo, pseudoStyles] of Object.entries(pseudoSelectors)) {
          cssRules.push(`${selector}${pseudo} {\n${this.compileModifierStyles(pseudoStyles, tokens)}\n}`);
        }
        
        if (nestedData && typeof nestedData === 'object' && !Array.isArray(nestedData)) {
          cssRules.push(...this._compileDataAttributeSelectors(baseSelector, nestedData, tokens, `${currentPath}${dataAttr}`));
        }
      }
    }
    return cssRules;
  }

  compileComponentsToCSS(components, tokens) {
    if (!components || Object.keys(components).length === 0) return '';

    const cssRules = [];
    for (const [className, styles] of Object.entries(components)) {
      const kebabClassName = className.replace(/([A-Z])/g, '-$1').toLowerCase();
      const dataTree = styles.data;
      const stylesWithoutData = { ...styles };
      delete stylesWithoutData.data;
      
      const baseStyles = {};
      const modifiers = {};
      
      for (const [prop, value] of Object.entries(stylesWithoutData)) {
        const isModifier = prop.startsWith(':') || prop.startsWith('[') || (typeof value === 'object' && value !== null && !Array.isArray(value));
        if (isModifier) modifiers[prop] = value;
        else baseStyles[prop] = value;
      }
      
      if (Object.keys(baseStyles).length > 0) {
        const cssProperties = Object.entries(baseStyles)
          .map(([prop, value]) => {
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `  ${cssProp}: ${this._interpolateTokens(value, tokens)};`;
          })
          .join('\n');
        cssRules.push(`.${kebabClassName} {\n${cssProperties}\n}`);
      }
      
      for (const [modifier, modifierStyles] of Object.entries(modifiers)) {
        let selector;
        if (modifier.startsWith(':')) selector = `.${kebabClassName}${modifier}`;
        else if (modifier.startsWith('[')) selector = `.${kebabClassName}${modifier}`;
        else if (modifier.includes(' ')) selector = `.${kebabClassName} ${modifier}`;
        else selector = `.${kebabClassName}[${modifier}]`;
        
        cssRules.push(`${selector} {\n${this.compileModifierStyles(modifierStyles, tokens)}\n}`);
      }
      
      if (dataTree && typeof dataTree === 'object' && !Array.isArray(dataTree)) {
        cssRules.push(...this._compileDataAttributeSelectors(`.${kebabClassName}`, dataTree, tokens));
      }
    }
    return cssRules.join('\n\n');
  }

  compileSelectors(selectors, tokens) {
    if (!selectors || Object.keys(selectors).length === 0) return '';
    const cssRules = [];
    for (const [selector, styles] of Object.entries(selectors)) {
      const cssProperties = Object.entries(styles)
        .map(([prop, value]) => {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `  ${cssProp}: ${this._interpolateTokens(value, tokens)};`;
        })
        .join('\n');
      cssRules.push(`${selector} {\n${cssProperties}\n}`);
    }
    return cssRules.join('\n\n');
  }

  compileToCSS(tokens, components, selectors = {}, rawCSS = '') {
    let css = `${this.compileTokensToCSS(tokens)}\n${this.compileComponentsToCSS(components, tokens)}`;
    const selectorCSS = this.compileSelectors(selectors, tokens);
    if (selectorCSS) css += `\n\n/* State-based selectors */\n${selectorCSS}`;
    if (rawCSS) css += `\n\n/* Raw CSS fallback */\n${rawCSS}`;
    return css;
  }

  async getStyleSheets(actorConfig) {
    const brandCoId = actorConfig.brand;
    const styleCoId = actorConfig.style;
    
    if (!brandCoId) {
      throw new Error(`[StyleEngine] Actor config must have 'brand' property with co-id. Config keys: ${Object.keys(actorConfig).join(', ')}. Config: ${JSON.stringify(actorConfig, null, 2)}`);
    }
    
    const cacheKey = `${brandCoId}_${styleCoId || 'none'}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const brandResolved = this.resolveStyleRef(brandCoId);
    const brandSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: brandResolved });
    const brandStore = await this.dbEngine.execute({ op: 'read', schema: brandSchemaCoId, key: brandResolved });
    const brand = brandStore.value;
    
    let actor = { tokens: {}, components: {} };
    if (styleCoId) {
      const styleResolved = this.resolveStyleRef(styleCoId);
      const styleSchemaCoId = await getSchemaCoIdSafe(this.dbEngine, { fromCoValue: styleResolved });
      const styleStore = await this.dbEngine.execute({ op: 'read', schema: styleSchemaCoId, key: styleResolved });
      actor = styleStore.value;
    }
    
    const mergedTokens = this.deepMerge(brand.tokens || {}, actor.tokens || {});
    const mergedComponents = this.deepMerge(brand.components || {}, actor.components || {});
    const mergedSelectors = this.deepMerge(brand.selectors || {}, actor.selectors || {});
    const rawCSS = [brand.rawCSS, actor.rawCSS].filter(Boolean).join('\n\n');
    
    const css = this.compileToCSS(mergedTokens, mergedComponents, mergedSelectors, rawCSS);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    
    const sheets = [sheet];
    this.cache.set(cacheKey, sheets);
    return sheets;
  }

  clearCache() {
    this.cache.clear();
  }
}
