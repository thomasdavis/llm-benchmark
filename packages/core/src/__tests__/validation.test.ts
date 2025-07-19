import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationRunner } from '../validation/runner.js';
import { TestCaseLoader } from '../validation/test-case-loader.js';
import type { Config } from '../types/config.js';
import type { LangPlugin, TestCase } from '../types/plugin.js';

describe('Validation System', () => {
  let validationRunner: ValidationRunner;
  let mockPlugin: LangPlugin;
  let config: Config;

  beforeEach(() => {
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
      detect: vi.fn().mockResolvedValue(true),
      extract: vi.fn(),
      format: vi.fn().mockImplementation((code) => Promise.resolve(code)),
      validate: vi.fn(),
      benchmark: vi.fn(),
    };

    validationRunner = new ValidationRunner(config, mockPlugin);
  });

  describe('ValidationRunner', () => {
    it('should validate all variants', async () => {
      const testCases: TestCase[] = [
        { id: '1', input: [1, 2], output: 3 },
        { id: '2', input: [5, 5], output: 10 },
      ];

      vi.mocked(mockPlugin.validate).mockResolvedValue({
        passed: true,
        results: [
          { caseId: '1', passed: true, actual: 3, expected: 3 },
          { caseId: '2', passed: true, actual: 10, expected: 10 },
        ],
      });

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
      vi.mock('fs/promises', () => ({
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
      }));
      vi.mock('fs', () => ({
        existsSync: vi.fn().mockReturnValue(false),
      }));
      vi.mock('globby', () => ({
        globby: vi.fn().mockResolvedValue([]),
      }));

      const results = await validationRunner.validateAll(variants, 'test.js');

      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(true);
      expect(results[0].passedCases).toBe(2);
      expect(results[0].failedCases).toBe(0);
    });

    it('should handle validation failures', async () => {
      vi.mocked(mockPlugin.validate).mockResolvedValue({
        passed: false,
        results: [
          { caseId: '1', passed: false, actual: 4, expected: 3, error: 'Mismatch' },
          { caseId: '2', passed: true, actual: 10, expected: 10 },
        ],
      });

      const results = await validationRunner.validateFiles(['variant.js'], 'baseline.js', {
        name: 'test',
        params: [],
        async: false,
      });

      expect(results[0].passed).toBe(false);
      expect(results[0].passedCases).toBe(1);
      expect(results[0].failedCases).toBe(1);
    });
  });

  describe('TestCaseLoader', () => {
    let testCaseLoader: TestCaseLoader;

    beforeEach(() => {
      testCaseLoader = new TestCaseLoader(config);
    });

    it('should load JSON test cases', async () => {
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify({
            cases: [
              { input: [1, 2], output: 3 },
              { input: [5, 5], output: 10 },
            ],
          }),
        ),
      }));
      vi.mock('globby', () => ({
        globby: vi.fn().mockResolvedValue(['test.json']),
      }));

      const cases = await testCaseLoader.loadStaticCases('baseline.js');

      expect(cases).toHaveLength(2);
      expect(cases[0].input).toEqual([1, 2]);
      expect(cases[0].output).toBe(3);
    });

    it('should handle array format', async () => {
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(
          JSON.stringify([
            [[1, 2], 3],
            [[5, 5], 10],
          ]),
        ),
      }));
      vi.mock('globby', () => ({
        globby: vi.fn().mockResolvedValue(['test.json']),
      }));

      const cases = await testCaseLoader.loadStaticCases('baseline.js');

      expect(cases).toHaveLength(2);
      expect(cases[0].input).toEqual([1, 2]);
      expect(cases[0].output).toBe(3);
    });

    it('should load YAML test cases', async () => {
      vi.mock('fs/promises', () => ({
        readFile: vi.fn().mockResolvedValue(`
cases:
  - input: [1, 2]
    output: 3
  - input: [5, 5]
    output: 10
`),
      }));
      vi.mock('globby', () => ({
        globby: vi.fn().mockResolvedValue(['test.yaml']),
      }));

      const cases = await testCaseLoader.loadStaticCases('baseline.js');

      expect(cases).toHaveLength(2);
    });
  });
});
