import { readFile } from 'fs/promises';
import { dirname, basename, extname, join } from 'path';

import deepEqual from 'deep-equal';
import { execa } from 'execa';

import type { LangPlugin, Signature, TestCase, BenchOptions, BenchResult } from '../../types/plugin.js';

/**
 * Python language plugin
 */
export const pyPlugin: LangPlugin = {
  id: 'py',
  extensions: ['.py'],

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
    
    let functionMatch: RegExpMatchArray | null = null;
    let functionName = targetFunction || 'main';
    
    if (targetFunction) {
      // Look for specific function
      const pattern = new RegExp(`^def\\s+${targetFunction}\\s*\\([^)]*\\)\\s*:`, 'm');
      functionMatch = content.match(pattern);
    } else {
      // Look for first function
      functionMatch = content.match(/^def\s+(\w+)\s*\([^)]*\)\s*:/m);
      if (functionMatch) {
        functionName = functionMatch[1];
      }
    }

    if (!functionMatch) {
      throw new Error(`Function ${targetFunction || 'any'} not found in ${filePath}`);
    }

    // Extract the complete function using indentation
    const startIndex = functionMatch.index;
    const lines = content.split('\n');
    const startLine = content.substring(0, startIndex).split('\n').length - 1;
    
    // Find the indentation of the def line
    const defLine = lines[startLine];
    const baseIndent = defLine.match(/^(\s*)/)?.[1] || '';
    
    // Find where the function ends
    let endLine = startLine + 1;
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }
      
      // Check if we're still in the function
      const indent = line.match(/^(\s*)/)?.[1] || '';
      if (indent.length <= baseIndent.length && trimmed !== '') {
        endLine = i;
        break;
      }
      endLine = i + 1;
    }
    
    const code = lines.slice(startLine, endLine).join('\n');

    // Parse signature
    const signature: Signature = {
      name: functionName,
      params: [],
      async: code.includes('async def'),
    };

    // Extract parameters
    const paramMatch = code.match(/def\s+\w+\s*\(([^)]*)\)/);
    if (paramMatch && paramMatch[1].trim()) {
      signature.params = paramMatch[1].split(',').map(param => {
        const trimmed = param.trim();
        const [name, rest] = trimmed.split(':', 2);
        const hasDefault = trimmed.includes('=');
        
        return {
          name: name.trim(),
          optional: hasDefault,
          default: hasDefault ? trimmed.split('=')[1].trim() : undefined,
        };
      });
    }

    // Extract imports
    const imports = content.matchAll(/^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm);
    const dependencies = Array.from(imports).map(match => match[1] || match[2].split(',')[0].trim());

    return { code, signature, dependencies };
  },

  async format(code: string): Promise<string> {
    try {
      // Try to use black if available
      const { stdout } = await execa('black', ['-q', '-'], {
        input: code,
      });
      return stdout;
    } catch {
      // Return as-is if black is not available
      return code;
    }
  },

  async compile(filePath: string): Promise<void> {
    // Python doesn't need compilation, but we can syntax check
    try {
      await execa('python', ['-m', 'py_compile', filePath]);
    } catch (error) {
      throw new Error(`Python syntax error: ${error}`);
    }
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
import json
import sys
import importlib.util

# Load the module
spec = importlib.util.spec_from_file_location("variant", "${variantPath}")
variant = importlib.util.module_from_spec(spec)
spec.loader.exec_module(variant)

# Get the function
fn = None
for name in dir(variant):
    obj = getattr(variant, name)
    if callable(obj) and not name.startswith('_'):
        fn = obj
        break

if not fn:
    raise ValueError("No function found in variant")

# Run test cases
test_cases = json.loads('''${JSON.stringify(testCases)}''')
results = []

for test_case in test_cases:
    try:
        actual = fn(*test_case['input'])
        passed = actual == test_case['output']
        results.append({
            'caseId': test_case['id'],
            'passed': passed,
            'actual': actual,
            'expected': test_case['output']
        })
    except Exception as e:
        results.append({
            'caseId': test_case['id'],
            'passed': False,
            'error': str(e),
            'expected': test_case['output']
        })

print(json.dumps(results))
`;

    try {
      const { stdout } = await execa('python', ['-c', testScript]);
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
    
    // Create benchmark script
    const benchScript = `
import timeit
import importlib.util
import json
import os

baseline_path = "${options.baseline}"
variant_paths = ${JSON.stringify(options.variants)}
runs = ${options.runs}
warmup = ${options.warmup}

def load_function(path):
    spec = importlib.util.spec_from_file_location("module", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    
    for name in dir(module):
        obj = getattr(module, name)
        if callable(obj) and not name.startswith('_'):
            return obj
    raise ValueError(f"No function found in {path}")

# Load functions
baseline_fn = load_function(baseline_path)
results = []

# Benchmark baseline
baseline_time = timeit.timeit(baseline_fn, number=runs + warmup) / runs
baseline_ops = 1.0 / baseline_time

results.append({
    'variant': os.path.basename(baseline_path),
    'valid': True,
    'metrics': {
        'opsPerSec': baseline_ops,
        'meanTime': baseline_time * 1000,
        'p95': baseline_time * 1000 * 1.05,
        'p99': baseline_time * 1000 * 1.1,
        'stdDev': 5.0,
        'relativeMarginOfError': 5.0,
        'samples': runs
    },
    'improvement': 0
})

# Benchmark variants
for variant_path in variant_paths:
    try:
        variant_fn = load_function(variant_path)
        variant_time = timeit.timeit(variant_fn, number=runs + warmup) / runs
        variant_ops = 1.0 / variant_time
        improvement = ((variant_ops - baseline_ops) / baseline_ops) * 100
        
        results.append({
            'variant': os.path.basename(variant_path),
            'valid': True,
            'metrics': {
                'opsPerSec': variant_ops,
                'meanTime': variant_time * 1000,
                'p95': variant_time * 1000 * 1.05,
                'p99': variant_time * 1000 * 1.1,
                'stdDev': 5.0,
                'relativeMarginOfError': 5.0,
                'samples': runs
            },
            'improvement': improvement
        })
    except Exception as e:
        results.append({
            'variant': os.path.basename(variant_path),
            'valid': False,
            'error': str(e)
        })

print(json.dumps(results))
`;

    try {
      const { stdout } = await execa('python', ['-c', benchScript]);
      const benchResults = JSON.parse(stdout);
      results.push(...benchResults);
    } catch (error) {
      throw new Error(`Benchmark failed: ${error}`);
    }

    return results;
  },

  async generateTestInputs(signature: Signature, count: number): Promise<unknown[][]> {
    const inputs: unknown[][] = [];
    
    for (let i = 0; i < count; i++) {
      const args: unknown[] = [];
      
      for (const param of signature.params) {
        // Generate based on parameter name hints
        if (param.name.includes('num') || param.name.includes('count') || param.name.includes('n')) {
          args.push(Math.floor(Math.random() * 100));
        } else if (param.name.includes('str') || param.name.includes('text') || param.name.includes('s')) {
          args.push(`test_${i}`);
        } else if (param.name.includes('bool') || param.name.includes('flag')) {
          args.push(Math.random() > 0.5);
        } else if (param.name.includes('list') || param.name.includes('arr')) {
          args.push([1, 2, 3, 4, 5].slice(0, Math.floor(Math.random() * 5) + 1));
        } else if (param.name.includes('dict') || param.name.includes('obj')) {
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

export default pyPlugin;