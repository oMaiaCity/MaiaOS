import { describe, it, expect, beforeEach } from 'bun:test';
import { StyleEngine } from './style.engine.js';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

// Helper: Find all .style.maia files in vibes folder
function discoverStyleFiles(vibesDir) {
  const styleFiles = [];
  
  try {
    const vibes = readdirSync(vibesDir);
    
    for (const vibe of vibes) {
      const vibePath = join(vibesDir, vibe);
      
      // Skip if not a directory
      if (!statSync(vibePath).isDirectory()) continue;
      
      // Find all .style.maia files in this vibe
      const files = readdirSync(vibePath);
      for (const file of files) {
        if (file.endsWith('.style.maia')) {
          styleFiles.push({
            vibe: vibe,
            filename: file,
            path: join(vibePath, file),
            type: file.includes('brand') ? 'brand' : 'actor'
          });
        }
      }
    }
  } catch (error) {
    console.warn('Could not discover style files:', error.message);
  }
  
  return styleFiles;
}

describe('StyleEngine Integration Tests', () => {
  let engine;
  const vibesDir = resolve(__dirname, '../../../vibes');
  const styleFiles = discoverStyleFiles(vibesDir);

  beforeEach(() => {
    engine = new StyleEngine();
  });

  describe('Auto-discovered Style Files', () => {
    it('should discover style files from vibes folder', () => {
      expect(styleFiles.length).toBeGreaterThan(0);
      console.log(`✅ Discovered ${styleFiles.length} style files from vibes/`);
      
      // Log what was found
      styleFiles.forEach(file => {
        console.log(`  - ${file.vibe}/${file.filename} (${file.type})`);
      });
    });

    // Dynamically generate tests for each style file
    for (const styleFile of styleFiles) {
      describe(`${styleFile.vibe}/${styleFile.filename}`, () => {
        let parsedStyle;

        beforeEach(() => {
          const content = readFileSync(styleFile.path, 'utf-8');
          parsedStyle = JSON.parse(content);
        });

        it('validates structure and generates valid CSS', () => {
          // Test 1: Valid $type
          expect(parsedStyle.$type).toBeDefined();
          expect(['brand.style', 'actor.style']).toContain(parsedStyle.$type);
          
          // Test 2: Has tokens object
          expect(parsedStyle.tokens).toBeDefined();
          expect(typeof parsedStyle.tokens).toBe('object');
          
          // Test 3: Brand-specific checks
          if (styleFile.type === 'brand') {
            expect(parsedStyle.tokens.colors).toBeDefined();
            expect(typeof parsedStyle.tokens.colors).toBe('object');
            expect(parsedStyle.components).toBeDefined();
            expect(typeof parsedStyle.components).toBe('object');
          }
          
          // Test 4: Generate CSS from tokens
          const tokenCSS = engine.compileTokensToCSS(parsedStyle.tokens);
          expect(tokenCSS).toContain(':host {');
          expect(tokenCSS).toContain('--');
          expect(tokenCSS).not.toContain('undefined');
          expect(tokenCSS).not.toContain('[object Object]');
          
          // Test 5: Generate CSS from components (if present)
          if (parsedStyle.components && Object.keys(parsedStyle.components).length > 0) {
            const componentCSS = engine.compileComponentsToCSS(
              parsedStyle.components,
              parsedStyle.tokens
            );
            expect(componentCSS).toBeTruthy();
            expect(componentCSS).toContain('{');
            expect(componentCSS).toContain('}');
            expect(componentCSS).not.toContain('undefined');
          }
          
          // Test 6: Generate CSS from selectors (if present)
          if (parsedStyle.selectors && Object.keys(parsedStyle.selectors).length > 0) {
            const selectorCSS = engine.compileSelectors(
              parsedStyle.selectors,
              parsedStyle.tokens
            );
            expect(selectorCSS).toBeTruthy();
            expect(selectorCSS).toContain('{');
            expect(selectorCSS).toContain('}');
          }
          
          // Test 7: Complete CSS compilation
          const css = engine.compileToCSS(
            parsedStyle.tokens || {},
            parsedStyle.components || {},
            parsedStyle.selectors || {}
          );
          
          expect(css).toContain(':host {');
          expect(css).toBeTruthy();
          
          // Validate CSS syntax
          const openBraces = (css.match(/{/g) || []).length;
          const closeBraces = (css.match(/}/g) || []).length;
          expect(openBraces).toBe(closeBraces);
          
          expect(css).not.toContain('undefined');
          expect(css).not.toContain('[object Object]');
        });
      });
    }
  });

  // Test merging between brand and actor styles (for each vibe that has both)
  describe('Brand + Actor Style Merging', () => {
    // Group style files by vibe
    const vibeGroups = {};
    for (const file of styleFiles) {
      if (!vibeGroups[file.vibe]) {
        vibeGroups[file.vibe] = {};
      }
      vibeGroups[file.vibe][file.type] = file;
    }

    // Test each vibe that has both brand and actor styles
    for (const [vibeName, files] of Object.entries(vibeGroups)) {
      if (files.brand && files.actor) {
        describe(`${vibeName} merge`, () => {
          let brandStyle, actorStyle;

          beforeEach(() => {
            brandStyle = JSON.parse(readFileSync(files.brand.path, 'utf-8'));
            actorStyle = JSON.parse(readFileSync(files.actor.path, 'utf-8'));
          });

          it('validates merge and generates valid stylesheet', () => {
            // Test token merging
            const mergedTokens = engine.deepMerge(
              brandStyle.tokens || {},
              actorStyle.tokens || {}
            );
            
            expect(mergedTokens).toBeDefined();
            expect(typeof mergedTokens).toBe('object');
            
            // Actor overrides should win
            if (actorStyle.tokens?.colors?.primary) {
              expect(mergedTokens.colors.primary).toBe(actorStyle.tokens.colors.primary);
            }
            
            // Test complete merge and CSS generation
            const mergedComponents = engine.deepMerge(
              brandStyle.components || {},
              actorStyle.components || {}
            );
            const mergedSelectors = engine.deepMerge(
              brandStyle.selectors || {},
              actorStyle.selectors || {}
            );
            
            const css = engine.compileToCSS(
              mergedTokens,
              mergedComponents,
              mergedSelectors
            );
            
            expect(css).toContain(':host {');
            expect(css.split('{').length).toBeGreaterThan(5);
            
            // Validate CSS syntax
            const openBraces = (css.match(/{/g) || []).length;
            const closeBraces = (css.match(/}/g) || []).length;
            expect(openBraces).toBe(closeBraces);
            
            expect(css).not.toContain('undefined');
            expect(css).not.toContain('[object Object]');
          });
        });
      }
    }
  });
});
