import { describe, it, expect } from 'bun:test';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { ValidationEngine, getSchema } from './index.js';

describe('ValidationEngine Integration Tests', () => {
  let engine;

  beforeEach(() => {
    engine = new ValidationEngine();
    
    // Load all schemas
    const schemas = {
      actor: getSchema('actor'),
      context: getSchema('context'),
      state: getSchema('state'),
      view: getSchema('view'),
      style: getSchema('style'),
      brandStyle: getSchema('brandStyle'),
      'brand.style': getSchema('brand.style'),
      'actor.style': getSchema('actor.style'),
      interface: getSchema('interface'),
      'actor.interface': getSchema('actor.interface'),
      tool: getSchema('tool'),
      skill: getSchema('skill'),
      vibe: getSchema('vibe'),
      message: getSchema('message')
    };
    
    for (const [type, schema] of Object.entries(schemas)) {
      if (schema) {
        engine.loadSchema(type, schema);
      }
    }
  });

  /**
   * Discover all .maia files in vibes directory
   */
  async function discoverMaiaFiles(dir, baseDir = dir) {
    const files = [];
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await discoverMaiaFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.maia')) {
        // Determine type from filename
        let type = null;
        if (entry.name.includes('.actor.maia')) type = 'actor';
        else if (entry.name.includes('.context.maia')) type = 'context';
        else if (entry.name.includes('.state.maia')) type = 'state';
        else if (entry.name.includes('.view.maia')) type = 'view';
        else if (entry.name.includes('brand.style.maia')) type = 'brandStyle';
        else if (entry.name.includes('.style.maia')) type = 'style';
        else if (entry.name.includes('.interface.maia')) type = 'interface';
        else if (entry.name.includes('.tool.maia')) type = 'tool';
        else if (entry.name.includes('.skill.maia')) type = 'skill';
        else if (entry.name.includes('.vibe.maia')) type = 'vibe';
        
        if (type) {
          files.push({
            path: fullPath,
            relativePath: fullPath.replace(baseDir + '/', ''),
            type,
            name: entry.name
          });
        }
      }
    }
    
    return files;
  }

  describe('Validate all .maia files in vibes/', () => {
    it('should validate all actor files', async () => {
      const vibesDir = join(import.meta.dir, '../../vibes');
      const files = await discoverMaiaFiles(vibesDir);
      const actorFiles = files.filter(f => f.type === 'actor');
      
      expect(actorFiles.length).toBeGreaterThan(0);
      
      for (const file of actorFiles) {
        const content = await readFile(file.path, 'utf-8');
        const data = JSON.parse(content);
        
        const result = engine.validate('actor', data);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate all context files', async () => {
      const vibesDir = join(import.meta.dir, '../../vibes');
      const files = await discoverMaiaFiles(vibesDir);
      const contextFiles = files.filter(f => f.type === 'context');
      
      expect(contextFiles.length).toBeGreaterThan(0);
      
      for (const file of contextFiles) {
        const content = await readFile(file.path, 'utf-8');
        const data = JSON.parse(content);
        
        const result = engine.validate('context', data);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate all state files', async () => {
      const vibesDir = join(import.meta.dir, '../../vibes');
      const files = await discoverMaiaFiles(vibesDir);
      const stateFiles = files.filter(f => f.type === 'state');
      
      expect(stateFiles.length).toBeGreaterThan(0);
      
      for (const file of stateFiles) {
        const content = await readFile(file.path, 'utf-8');
        const data = JSON.parse(content);
        
        const result = engine.validate('state', data);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate all view files', async () => {
      const vibesDir = join(import.meta.dir, '../../vibes');
      const files = await discoverMaiaFiles(vibesDir);
      const viewFiles = files.filter(f => f.type === 'view');
      
      expect(viewFiles.length).toBeGreaterThan(0);
      
      for (const file of viewFiles) {
        const content = await readFile(file.path, 'utf-8');
        const data = JSON.parse(content);
        
        const result = engine.validate('view', data);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate all style files', async () => {
      const vibesDir = join(import.meta.dir, '../../vibes');
      const files = await discoverMaiaFiles(vibesDir);
      const styleFiles = files.filter(f => f.type === 'style' || f.type === 'brandStyle');
      
      expect(styleFiles.length).toBeGreaterThan(0);
      
      for (const file of styleFiles) {
        const content = await readFile(file.path, 'utf-8');
        const data = JSON.parse(content);
        
        const type = data.$type === 'brand.style' ? 'brandStyle' : 'style';
        const result = engine.validate(type, data);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate all interface files', async () => {
      const vibesDir = join(import.meta.dir, '../../vibes');
      const files = await discoverMaiaFiles(vibesDir);
      const interfaceFiles = files.filter(f => f.type === 'interface');
      
      expect(interfaceFiles.length).toBeGreaterThan(0);
      
      for (const file of interfaceFiles) {
        const content = await readFile(file.path, 'utf-8');
        const data = JSON.parse(content);
        
        const result = engine.validate('interface', data);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate all tool files', async () => {
      const toolsDir = join(import.meta.dir, '../../o/tools');
      const files = await discoverMaiaFiles(toolsDir);
      const toolFiles = files.filter(f => f.type === 'tool');
      
      expect(toolFiles.length).toBeGreaterThan(0);
      
      for (const file of toolFiles) {
        const content = await readFile(file.path, 'utf-8');
        const data = JSON.parse(content);
        
        const result = engine.validate('tool', data);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate all vibe files', async () => {
      const vibesDir = join(import.meta.dir, '../../vibes');
      const files = await discoverMaiaFiles(vibesDir);
      const vibeFiles = files.filter(f => f.type === 'vibe');
      
      expect(vibeFiles.length).toBeGreaterThan(0);
      
      for (const file of vibeFiles) {
        const content = await readFile(file.path, 'utf-8');
        const data = JSON.parse(content);
        
        const result = engine.validate('vibe', data);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Error message clarity', () => {
    it('should provide clear error messages for invalid actor data', () => {
      const invalidActor = {
        $type: 'actor',
        // Missing required fields
      };
      
      const result = engine.validate('actor', invalidActor);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toBeDefined();
      expect(result.errors[0].instancePath).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should cache compiled schemas for performance', () => {
      const schema = getSchema('actor');
      const data = {
        $type: 'actor',
        $id: 'actor_test_001',
        contextRef: 'test',
        viewRef: 'test',
        stateRef: 'test'
      };
      
      // First validation
      const start1 = performance.now();
      engine.validate('actor', data);
      const time1 = performance.now() - start1;
      
      // Second validation (should use cache)
      const start2 = performance.now();
      engine.validate('actor', data);
      const time2 = performance.now() - start2;
      
      // Cached validation should be faster (or at least not slower)
      expect(time2).toBeLessThanOrEqual(time1 * 2); // Allow some variance
    });
  });
});
