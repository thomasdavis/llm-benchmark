import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

import { stringify as stringifyCSV } from 'csv-stringify/sync';

import type { BenchmarkResults } from '../types/benchmark.js';
import type { Config } from '../types/config.js';

/**
 * Write benchmark results in various formats
 */
export class ResultsWriter {
  constructor(private config: Config) {}

  /**
   * Get output path
   */
  getOutputPath(): string {
    return resolve(this.config.output?.path || './results.json');
  }

  /**
   * Write results to file
   */
  async write(results: BenchmarkResults): Promise<void> {
    const format = this.config.output?.format || 'json';
    const outputPath = this.getOutputPath();

    await mkdir(dirname(outputPath), { recursive: true });

    switch (format) {
      case 'json':
        await this.writeJSON(outputPath, results);
        break;

      case 'junit':
        await this.writeJUnit(outputPath, results);
        break;

      case 'csv':
        await this.writeCSV(outputPath, results);
        break;

      case 'html':
        await this.writeHTML(outputPath, results);
        break;

      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  /**
   * Write JSON format
   */
  private async writeJSON(path: string, results: BenchmarkResults): Promise<void> {
    await writeFile(path, JSON.stringify(results, null, 2), 'utf-8');
  }

  /**
   * Write JUnit XML format
   */
  private async writeJUnit(path: string, results: BenchmarkResults): Promise<void> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="llm-benchmark" tests="${results.variants.length}" time="${
      results.summary.totalDurationMs / 1000
    }">
  <testsuite name="${results.targetFunction}" tests="${results.variants.length}">
    ${results.variants
      .map(
        (variant) => `
    <testcase name="${variant.provider}.${variant.model}" classname="${
      results.targetFunction
    }" time="${variant.generation.latencyMs / 1000}">
      ${
        !variant.valid
          ? `<failure message="Validation failed">${variant.error || 'Unknown error'}</failure>`
          : ''
      }
      <system-out>
        Ops/sec: ${variant.benchmark?.opsPerSec || 'N/A'}
        Improvement: ${variant.benchmark?.improvement || 0}%
        Cost: $${variant.generation.costUsd}
      </system-out>
    </testcase>`,
      )
      .join('')}
  </testsuite>
</testsuites>`;

    await writeFile(path.replace(/\.json$/, '.xml'), xml, 'utf-8');
  }

  /**
   * Write CSV format
   */
  private async writeCSV(path: string, results: BenchmarkResults): Promise<void> {
    const rows = results.variants.map((variant) => ({
      provider: variant.provider,
      model: variant.model,
      valid: variant.valid,
      opsPerSec: variant.benchmark?.opsPerSec || null,
      improvement: variant.benchmark?.improvement || null,
      p95: variant.benchmark?.p95 || null,
      stdDev: variant.benchmark?.stdDev || null,
      promptTokens: variant.generation.promptTokens,
      completionTokens: variant.generation.completionTokens,
      costUsd: variant.generation.costUsd,
      latencyMs: variant.generation.latencyMs,
    }));

    const csv = stringifyCSV(rows, {
      header: true,
      columns: Object.keys(rows[0]),
    });

    await writeFile(path.replace(/\.json$/, '.csv'), csv, 'utf-8');
  }

  /**
   * Write HTML report
   */
  private async writeHTML(path: string, results: BenchmarkResults): Promise<void> {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>LLM Benchmark Results - ${results.targetFunction}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; font-weight: 600; }
    .valid { color: #22c55e; }
    .invalid { color: #ef4444; }
    .improvement { color: #3b82f6; font-weight: 500; }
    .fastest { background: #fef3c7; }
  </style>
</head>
<body>
  <h1>🚀 LLM Benchmark Results</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Function:</strong> ${results.targetFunction}</p>
    <p><strong>Source:</strong> ${results.sourceFile}</p>
    <p><strong>Total Variants:</strong> ${results.summary.totalVariants}</p>
    <p><strong>Valid Variants:</strong> ${results.summary.validVariants}</p>
    <p><strong>Fastest:</strong> ${results.summary.fastestVariant || 'N/A'} 
       ${
         results.summary.maxImprovement ? `(+${results.summary.maxImprovement.toFixed(1)}%)` : ''
       }</p>
    <p><strong>Total Cost:</strong> $${results.summary.totalCostUsd.toFixed(4)}</p>
    <p><strong>Duration:</strong> ${(results.summary.totalDurationMs / 1000).toFixed(1)}s</p>
  </div>

  <h2>Detailed Results</h2>
  <table>
    <thead>
      <tr>
        <th>Provider</th>
        <th>Model</th>
        <th>Status</th>
        <th>Ops/sec</th>
        <th>Improvement</th>
        <th>P95 (ms)</th>
        <th>Std Dev</th>
        <th>Cost</th>
      </tr>
    </thead>
    <tbody>
      ${results.variants
        .map(
          (variant, i) => `
      <tr class="${i === 0 && variant.valid ? 'fastest' : ''}">
        <td>${variant.provider}</td>
        <td>${variant.model}</td>
        <td class="${variant.valid ? 'valid' : 'invalid'}">
          ${variant.valid ? '✅ Valid' : '❌ Invalid'}
        </td>
        <td>${variant.benchmark?.opsPerSec?.toFixed(0) || '-'}</td>
        <td class="improvement">
          ${variant.benchmark?.improvement ? `+${variant.benchmark.improvement.toFixed(1)}%` : '-'}
        </td>
        <td>${variant.benchmark?.p95?.toFixed(3) || '-'}</td>
        <td>${variant.benchmark?.stdDev ? `±${variant.benchmark.stdDev.toFixed(1)}%` : '-'}</td>
        <td>$${variant.generation.costUsd.toFixed(4)}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <footer>
    <p><small>Generated by llm-benchmark on ${new Date().toLocaleString()}</small></p>
  </footer>
</body>
</html>`;

    await writeFile(path.replace(/\.json$/, '.html'), html, 'utf-8');
  }
}
