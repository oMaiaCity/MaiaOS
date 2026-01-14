import { describe, it, expect, beforeEach } from 'bun:test';
import { StyleEngine } from './style.engine.js';

describe('StyleEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new StyleEngine();
  });

  describe('deepMerge', () => {
    it('should merge two flat objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = engine.deepMerge(target, source);
      
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deep merge nested objects', () => {
      const target = { colors: { primary: '#000', secondary: '#111' } };
      const source = { colors: { primary: '#fff' } };
      const result = engine.deepMerge(target, source);
      
      expect(result).toEqual({
        colors: { primary: '#fff', secondary: '#111' }
      });
    });

    it('should handle arrays by replacing (not merging)', () => {
      const target = { items: [1, 2, 3] };
      const source = { items: [4, 5] };
      const result = engine.deepMerge(target, source);
      
      expect(result).toEqual({ items: [4, 5] });
    });
  });

  describe('flattenTokens', () => {
    it('should flatten nested token objects', () => {
      const tokens = {
        colors: {
          primary: '#8fa89b',
          secondary: '#d4a373'
        },
        spacing: {
          sm: '0.5rem'
        }
      };
      
      const result = engine.flattenTokens(tokens);
      
      expect(result).toEqual({
        '--colors-primary': '#8fa89b',
        '--colors-secondary': '#d4a373',
        '--spacing-sm': '0.5rem'
      });
    });

    it('should handle deeply nested objects', () => {
      const tokens = {
        typography: {
          fontSize: {
            base: '1rem',
            lg: '1.25rem'
          }
        }
      };
      
      const result = engine.flattenTokens(tokens);
      
      expect(result).toEqual({
        '--typography-fontSize-base': '1rem',
        '--typography-fontSize-lg': '1.25rem'
      });
    });
  });

  describe('interpolateTokens', () => {
    it('should replace {token.path} with token values', () => {
      const tokens = {
        colors: { primary: '#8fa89b' },
        spacing: { md: '1rem' }
      };
      
      const value = 'padding: {spacing.md}; color: {colors.primary};';
      const result = engine.interpolateTokens(value, tokens);
      
      expect(result).toBe('padding: 1rem; color: #8fa89b;');
    });

    it('should leave unmatched placeholders unchanged', () => {
      const tokens = { colors: { primary: '#000' } };
      const value = '{colors.primary} {colors.nonexistent}';
      const result = engine.interpolateTokens(value, tokens);
      
      expect(result).toBe('#000 {colors.nonexistent}');
    });

    it('should handle non-string values', () => {
      const tokens = {};
      const value = 123;
      const result = engine.interpolateTokens(value, tokens);
      
      expect(result).toBe(123);
    });
  });

  describe('compileTokensToCSS', () => {
    it('should generate CSS variables from tokens', () => {
      const tokens = {
        colors: { primary: '#8fa89b' },
        spacing: { md: '1rem' }
      };
      
      const css = engine.compileTokensToCSS(tokens);
      
      expect(css).toContain(':host {');
      expect(css).toContain('--colors-primary: #8fa89b;');
      expect(css).toContain('--spacing-md: 1rem;');
    });
  });

  describe('compileComponentsToCSS', () => {
    it('should compile components to CSS classes', () => {
      const components = {
        button: {
          padding: '0.5rem 1rem',
          background: '#8fa89b'
        }
      };
      const tokens = {};
      
      const css = engine.compileComponentsToCSS(components, tokens);
      
      expect(css).toContain('.button {');
      expect(css).toContain('padding: 0.5rem 1rem;');
      expect(css).toContain('background: #8fa89b;');
    });

    it('should handle pseudo-classes', () => {
      const components = {
        button: {
          background: '#000',
          ':hover': {
            background: '#111'
          }
        }
      };
      const tokens = {};
      
      const css = engine.compileComponentsToCSS(components, tokens);
      
      expect(css).toContain('.button {');
      expect(css).toContain('background: #000;');
      expect(css).toContain('.button:hover {');
      expect(css).toContain('background: #111;');
    });

    it('should interpolate token references', () => {
      const components = {
        button: {
          padding: '{spacing.md}',
          color: '{colors.primary}'
        }
      };
      const tokens = {
        spacing: { md: '1rem' },
        colors: { primary: '#8fa89b' }
      };
      
      const css = engine.compileComponentsToCSS(components, tokens);
      
      expect(css).toContain('padding: 1rem;');
      expect(css).toContain('color: #8fa89b;');
    });

    it('should convert camelCase to kebab-case', () => {
      const components = {
        myButton: {
          backgroundColor: '#000'
        }
      };
      const tokens = {};
      
      const css = engine.compileComponentsToCSS(components, tokens);
      
      expect(css).toContain('.my-button {');
      expect(css).toContain('background-color: #000;');
    });
  });

  describe('compileSelectors', () => {
    it('should compile advanced selectors', () => {
      const selectors = {
        '.button[data-active="true"]': {
          background: '#8fa89b'
        }
      };
      const tokens = {};
      
      const css = engine.compileSelectors(selectors, tokens);
      
      expect(css).toContain('.button[data-active="true"] {');
      expect(css).toContain('background: #8fa89b;');
    });
  });
});
