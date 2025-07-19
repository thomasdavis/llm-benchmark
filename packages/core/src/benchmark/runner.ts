import { basename } from 'path';

import type { Config } from '../types/config.js';
import type { LangPlugin, BenchResult } from '../types/plugin.js';
import type { ValidationSummary } from '../types/validation.js';

/**
 * Benchmark runner for performance testing
 */
export class BenchmarkRunner {
  constructor(
    private config: Config,
    private plugin: LangPlugin,
  ) {}

  /**
   * Run benchmarks for all validated variants
   */
  async runAll(validatedVariants: ValidationSummary[], baselineFile: string): Promise<any[]> {
    const variantPaths = validatedVariants.map((v) => v.variant);

    // Run benchmarks
    const benchResults = await this.plugin.benchmark({
      runs: this.config.bench.runs,
      warmup: this.config.bench.warmup,
      timeout: this.config.bench.timeout,
      baseline: baselineFile,
      variants: variantPaths,
    });

    // Combine with validation data
    return benchResults.map((result) => {
      const validation = validatedVariants.find((v) => basename(v.variant) === result.variant);

      return {
        variant: result.variant,
        filePath: result.variant,
        valid: result.valid,
        validation: validation
          ? {
              totalCases: validation.totalCases,
              passedCases: validation.passedCases,
            }
          : undefined,
        benchmark: result.metrics
          ? {
              opsPerSec: result.metrics.opsPerSec,
              improvement: result.improvement || 0,
              p95: result.metrics.p95,
              stdDev: result.metrics.stdDev,
              memory: result.metrics.memory,
            }
          : undefined,
        error: result.error,
      };
    });
  }

  /**
   * Run benchmarks for validated variants
   */
  async runValidated(validationResults: ValidationSummary[], baselineFile: string): Promise<any[]> {
    const validVariants = validationResults.filter((r) => r.passed);
    const variantPaths = validVariants.map((v) => v.variant);

    // Run benchmarks
    const benchResults = await this.plugin.benchmark({
      runs: this.config.bench.runs,
      warmup: this.config.bench.warmup,
      timeout: this.config.bench.timeout,
      baseline: baselineFile,
      variants: variantPaths,
    });

    // Combine results
    return benchResults.map((result) => {
      const validation = validationResults.find((v) => basename(v.variant) === result.variant);

      return {
        variant: result.variant,
        filePath: variantPaths.find((p) => basename(p) === result.variant) || result.variant,
        valid: result.valid,
        validation: validation
          ? {
              totalCases: validation.totalCases,
              passedCases: validation.passedCases,
            }
          : undefined,
        benchmark: result.metrics
          ? {
              opsPerSec: result.metrics.opsPerSec,
              improvement: result.improvement || 0,
              p95: result.metrics.p95,
              stdDev: result.metrics.stdDev,
              memory: result.metrics.memory,
            }
          : undefined,
        error: result.error,
      };
    });
  }
}
