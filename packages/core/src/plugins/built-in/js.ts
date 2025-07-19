import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, basename, extname, join } from 'path';

import * as Benchmark from 'benchmark';
import deepEqual from 'deep-equal';
import { execaNode } from 'execa';

import type { LangPlugin, Signature, TestCase, BenchOptions, BenchResult } from '../../types/plugin.js';

/**
 * JavaScript/TypeScript language plugin
 */
export const jsPlugin: LangPlugin = {
  id: 'js',
  extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'],

  async detect(filePath: string): Promise<boolean> {
    const ext = extname(filePath).toLowerCase();
    return this.extensions.includes(ext);
  },

  async extract(filePath: string, targetFunction?: string): Promise<{
    code: string;
    signature: Signature;
    dependencies?: string[];
  }> {
    const content = await readFile(filePath, 'utf-8');
    
    // Simple extraction - look for export default or named function
    let functionMatch: RegExpMatchArray | null = null;
    const functionName = targetFunction || 'default';
    
    if (targetFunction) {
      // Look for specific function
      const patterns = [
        new RegExp(`export\\s+(?:async\\s+)?function\\s+${targetFunction}\\s*\\([^)]*\\)\\s*{`, 's'),
        new RegExp(`export\\s+const\\s+${targetFunction}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>`, 's'),
        new RegExp(`(?:async\\s+)?function\\s+${targetFunction}\\s*\\([^)]*\\)\\s*{`, 's'),
        new RegExp(`const\\s+${targetFunction}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>`, 's'),
      ];
      
      for (const pattern of patterns) {
        functionMatch = content.match(pattern);
        if (functionMatch) break;
      }
    } else {
      // Look for default export
      functionMatch = content.match(/export\s+default\s+(?:async\s+)?(?:function\s*)?(?:\w+\s*)?\([^)]*\)\s*{/s);
      if (!functionMatch) {
        functionMatch = content.match(/export\s+default\s+(?:async\s*)?(?:\([^)]*\)|[^=]+)\s*=>/s);
      }
    }

    if (!functionMatch) {
      throw new Error(`Function ${targetFunction || 'default export'} not found in ${filePath}`);
    }

    // Extract the complete function
    const startIndex = functionMatch.index;
    let endIndex = startIndex;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      
      if (!inString) {
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      } else {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
        }
      }
    }

    const code = content.substring(startIndex, endIndex);

    // Parse signature (simplified)
    const signature: Signature = {
      name: functionName,
      params: [],
      async: code.includes('async'),
    };

    // Extract parameters
    const paramMatch = code.match(/\(([^)]*)\)/);
    if (paramMatch && paramMatch[1].trim()) {
      signature.params = paramMatch[1].split(',').map(param => {
        const trimmed = param.trim();
        const [name, defaultValue] = trimmed.split('=').map(s => s.trim());
        return {
          name: name.replace(/[?:].*/g, '').trim(),
          optional: name.includes('?') || defaultValue !== undefined,
          default: defaultValue,
        };
      });
    }

    // Extract dependencies (imports)
    const imports = content.matchAll(/import\s+(?:{[^}]+}|[\w\s,]+)\s+from\s+['"]([^'"]+)['"]/g);
    const dependencies = Array.from(imports).map(match => match[1]);

    return { code, signature, dependencies };
  },

  async format(code: string): Promise<string> {
    // For now, return as-is. Could integrate prettier here
    return code;
  },

  async compile(filePath: string): Promise<void> {
    // JavaScript doesn't need compilation
    // TypeScript compilation would go here if needed
    return;
  },

  async validate(testCases: TestCase[], variantPath: string): Promise<{
    passed: boolean;
    results: Array<{
      caseId: string;
      passed: boolean;
      actual?: unknown;
      expected?: unknown;
      error?: string;
    }>;
  }> {
    const results = [];
    let allPassed = true;

    // Create a test runner script
    const testScript = `
      import('${variantPath}').then(async (module) => {
        const fn = module.default || module[Object.keys(module)[0]];
        
        const testCases = ${JSON.stringify(testCases)};
        const results = [];
        
        for (const testCase of testCases) {
          try {
            const actual = await fn(...testCase.input);
            const passed = JSON.stringify(actual) === JSON.stringify(testCase.output);
            results.push({
              caseId: testCase.id,
              passed,
              actual,
              expected: testCase.output,
            });
          } catch (error) {
            results.push({
              caseId: testCase.id,
              passed: false,
              error: error.message,
              expected: testCase.output,
            });
          }
        }
        
        console.log(JSON.stringify(results));
      }).catch(console.error);
    `;

    try {
      const { stdout } = await execaNode('-', {
        input: testScript,
        preferLocal: true,
      });

      const testResults = JSON.parse(stdout);
      results.push(...testResults);
      allPassed = testResults.every((r: any) => r.passed);
    } catch (error) {
      // All tests fail if runner fails
      for (const testCase of testCases) {
        results.push({
          caseId: testCase.id,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          expected: testCase.output,
        });
      }
      allPassed = false;
    }

    return { passed: allPassed, results };
  },

  async benchmark(options: BenchOptions): Promise<BenchResult[]> {
    const results: BenchResult[] = [];
    const suite = new Benchmark.Suite();

    // Load all functions
    const functions: Map<string, Function> = new Map();
    
    for (const variantPath of [options.baseline, ...options.variants]) {
      try {
        const module = await import(variantPath);
        const fn = module.default || module[Object.keys(module)[0]];
        functions.set(variantPath, fn);
      } catch (error) {
        results.push({
          variant: basename(variantPath),
          valid: false,
          error: error instanceof Error ? error.message : 'Failed to load',
        });
      }
    }

    // Get baseline function
    const baselineFn = functions.get(options.baseline);
    if (!baselineFn) {
      throw new Error('Baseline function not found');
    }

    // Add baseline to suite
    suite.add(basename(options.baseline), () => {
      baselineFn();
    });

    // Add variants to suite
    for (const variantPath of options.variants) {
      const fn = functions.get(variantPath);
      if (fn) {
        suite.add(basename(variantPath), () => {
          fn();
        });
      }
    }

    // Run benchmarks
    return new Promise((resolve) => {
      let baselineOps = 0;

      suite
        .on('cycle', (event: any) => {
          const bench = event.target;
          
          if (bench.name === basename(options.baseline)) {
            baselineOps = bench.hz;
          }

          const isBaseline = bench.name === basename(options.baseline);
          const improvement = isBaseline ? 0 : ((bench.hz - baselineOps) / baselineOps) * 100;

          results.push({
            variant: bench.name,
            valid: true,
            metrics: {
              opsPerSec: bench.hz,
              meanTime: bench.stats.mean * 1000, // Convert to ms
              p95: bench.stats.mean * 1000 * 1.96, // Approximate p95
              p99: bench.stats.mean * 1000 * 2.58, // Approximate p99
              stdDev: bench.stats.rme,
              relativeMarginOfError: bench.stats.rme,
              samples: bench.stats.sample.length,
            },
            improvement,
          });
        })
        .on('complete', () => {
          resolve(results);
        })
        .run({ async: true });
    });
  },

  async generateTestInputs(signature: Signature, count: number): Promise<unknown[][]> {
    // Simple test input generation
    const inputs: unknown[][] = [];
    
    for (let i = 0; i < count; i++) {
      const args: unknown[] = [];
      
      for (const param of signature.params) {
        // Generate based on parameter name hints
        if (param.name.includes('num') || param.name.includes('count')) {
          args.push(Math.floor(Math.random() * 100));
        } else if (param.name.includes('str') || param.name.includes('text')) {
          args.push(`test_${i}`);
        } else if (param.name.includes('bool')) {
          args.push(Math.random() > 0.5);
        } else if (param.name.includes('arr')) {
          args.push([1, 2, 3, 4, 5].slice(0, Math.floor(Math.random() * 5) + 1));
        } else if (param.name.includes('obj')) {
          args.push({ id: i, value: `value_${i}` });
        } else {
          // Default to number
          args.push(Math.floor(Math.random() * 100));
        }
      }
      
      inputs.push(args);
    }
    
    return inputs;
  },
};

export default jsPlugin;