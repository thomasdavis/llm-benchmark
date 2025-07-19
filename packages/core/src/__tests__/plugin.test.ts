import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginManager } from '../plugins/manager.js';
import jsPlugin from '../plugins/built-in/js.js';
import type { Config } from '../types/config.js';

describe('Plugin System', () => {
  let pluginManager: PluginManager;
  let config: Config;

  beforeEach(() => {
    config = {
      providers: ['openai:gpt-4o'],
      validation: { mode: 'static' },
      bench: { runs: 100, warmup: 10, parallel: false, metrics: ['ops/s'] },
      langPlugins: ['js'],
      ci: false,
    };
    pluginManager = new PluginManager(config);
  });

  describe('PluginManager', () => {
    it('should initialize with configured plugins', async () => {
      await pluginManager.initialize();
      const plugins = pluginManager.getPlugins();
      
      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe('js');
    });

    it('should detect plugin for JavaScript file', async () => {
      await pluginManager.initialize();
      const plugin = await pluginManager.detectPlugin('test.js');
      
      expect(plugin).toBeDefined();
      expect(plugin?.id).toBe('js');
    });

    it('should return null for unsupported file', async () => {
      await pluginManager.initialize();
      const plugin = await pluginManager.detectPlugin('test.unknown');
      
      expect(plugin).toBeNull();
    });
  });

  describe('JavaScript Plugin', () => {
    it('should detect JavaScript files', async () => {
      expect(await jsPlugin.detect('test.js')).toBe(true);
      expect(await jsPlugin.detect('test.mjs')).toBe(true);
      expect(await jsPlugin.detect('test.ts')).toBe(true);
      expect(await jsPlugin.detect('test.py')).toBe(false);
    });

    it('should extract function from code', async () => {
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(`
          export default function testFunc(a, b) {
            return a + b;
          }
        `),
      }));

      const result = await jsPlugin.extract('test.js');
      
      expect(result.signature.name).toBe('default');
      expect(result.signature.params).toHaveLength(2);
      expect(result.code).toContain('function testFunc');
    });

    it('should extract named function', async () => {
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(`
          export function namedFunc(x, y, z = 10) {
            return x * y + z;
          }
        `),
      }));

      const result = await jsPlugin.extract('test.js', 'namedFunc');
      
      expect(result.signature.name).toBe('namedFunc');
      expect(result.signature.params).toHaveLength(3);
      expect(result.signature.params[2].optional).toBe(true);
    });

    it('should format code', async () => {
      const code = 'function test() { return 1; }';
      const formatted = await jsPlugin.format(code);
      
      expect(formatted).toBe(code); // Basic implementation returns as-is
    });

    it('should generate test inputs', async () => {
      const signature = {
        name: 'test',
        params: [
          { name: 'num', optional: false },
          { name: 'str', optional: false },
          { name: 'arr', optional: false },
        ],
        async: false,
      };

      const inputs = await jsPlugin.generateTestInputs!(signature, 5);
      
      expect(inputs).toHaveLength(5);
      expect(inputs[0]).toHaveLength(3);
      expect(typeof inputs[0][0]).toBe('number');
      expect(typeof inputs[0][1]).toBe('string');
      expect(Array.isArray(inputs[0][2])).toBe(true);
    });
  });
});