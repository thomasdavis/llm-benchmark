import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ValidationRunner } from '../validation/runner.js';
import { TestCaseLoader } from '../validation/test-case-loader.js';
import type { Config } from '../types/config.js';
import type { LangPlugin, TestCase } from '../types/plugin.js';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

// Mock modules at top level
vi.mock('fs');
vi.mock('fs/promises');
vi.mock('globby');

describe.skip('Validation System', () => {
  let validationRunner: ValidationRunner;
  let mockPlugin: LangPlugin;
  let config: Config;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      providers: ['openai:gpt-4o'],
      validation: { mode: 'static' },
      bench: { runs: 100, warmup: 10, parallel: false, metrics: ['ops/s'] },
      langPlugins: ['js'],
      ci: false,
    };

    mockPlugin = {
      id: 'js',
      extensions: ['.js'],
      extract: vi.fn(),
      detect: vi.fn(),
      validate: vi.fn().mockResolvedValue({
        passed: true,
        results: [
          { caseId: '1', passed: true, actual: 3 },
          { caseId: '2', passed: true, actual: 10 },
        ],
      }),
      generateVariant: vi.fn(),
      formatCode: vi.fn(),
    };

    validationRunner = new ValidationRunner(config, mockPlugin, false);
  });

  describe('ValidationRunner', () => {
    it('should validate all variants', async () => {
      const testCases: TestCase[] = [
        { id: '1', input: [1, 2], output: 3 },
        { id: '2', input: [5, 5], output: 10 },
      ];

      const variants = [
        {
          code: 'function add(a, b) { return a + b; }',
          provider: 'openai',
          model: 'gpt-4o',
          meta: {
            promptTokens: 100,
            completionTokens: 50,
            latencyMs: 1000,
            costUsd: 0.01,
            model: 'gpt-4o',
            provider: 'openai',
          },
        },
      ];

      // Mock file system operations
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path.toString().includes('.test.json');
      });
      vi.mocked(fs.readdirSync).mockReturnValue(['add.test.json']);
      vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify({ cases: testCases }));
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue(['add.test.json']);

      const results = await validationRunner.validateAll(variants, 'baseline.js');

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].totalCases).toBe(2);
      expect(results[0].passedCases).toBe(2);
    });

    it('should handle validation failures', async () => {
      mockPlugin.validate = vi.fn().mockResolvedValue({
        passed: false,
        results: [
          { caseId: '1', passed: false, actual: 4, expected: 3 },
          { caseId: '2', passed: true, actual: 10 },
        ],
      });

      // Mock file system
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path.toString().includes('.test.json');
      });
      vi.mocked(fs.readdirSync).mockReturnValue(['add.test.json']);
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify({
          cases: [
            { id: '1', input: [1, 2], output: 3 },
            { id: '2', input: [5, 5], output: 10 },
          ],
        }),
      );

      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue(['add.test.json']);

      const results = await validationRunner.validateFiles(['variant.js'], 'baseline.js', {
        name: 'add',
        params: ['a', 'b'],
        defaults: {},
      });

      expect(results[0].passed).toBe(false);
      expect(results[0].failedCases).toBe(1);
    });
  });

  describe('TestCaseLoader', () => {
    let testCaseLoader: TestCaseLoader;

    beforeEach(() => {
      testCaseLoader = new TestCaseLoader(config, false);
    });

    it('should load JSON test cases', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path.toString().includes('.test.json');
      });
      vi.mocked(fs.readdirSync).mockReturnValue(['add.test.json']);
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify({
          cases: [
            { input: [1, 2], output: 3 },
            { input: [5, 5], output: 10 },
          ],
        }),
      );

      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue(['add.test.json']);

      const cases = await testCaseLoader.loadStaticCases('baseline.js');

      expect(cases).toHaveLength(2);
      expect(cases[0].input).toEqual([1, 2]);
      expect(cases[0].output).toBe(3);
    });

    it('should handle array format', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path.toString().includes('.test.json');
      });
      vi.mocked(fs.readdirSync).mockReturnValue(['add.test.json']);
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify([
          [[1, 2], 3],
          [[5, 5], 10],
        ]),
      );

      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue(['add.test.json']);

      const cases = await testCaseLoader.loadStaticCases('baseline.js');

      expect(cases).toHaveLength(2);
      expect(cases[0].input).toEqual([1, 2]);
      expect(cases[0].output).toBe(3);
    });

    it('should load YAML test cases', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path.toString().includes('.test.yaml');
      });
      vi.mocked(fs.readdirSync).mockReturnValue(['add.test.yaml']);
      vi.mocked(fsPromises.readFile).mockResolvedValue(`
cases:
  - input: [1, 2]
    output: 3
  - input: [5, 5]
    output: 10
`);

      const { globby } = await import('globby');
      vi.mocked(globby).mockResolvedValue(['add.test.yaml']);

      const cases = await testCaseLoader.loadStaticCases('baseline.js');

      expect(cases).toHaveLength(2);
    });
  });
});
