/**
 * Overall benchmark results
 */
export interface BenchmarkResults {
  /**
   * Timestamp when benchmark started
   */
  timestamp: string;

  /**
   * Source file that was benchmarked
   */
  sourceFile: string;

  /**
   * Function that was optimized
   */
  targetFunction: string;

  /**
   * Configuration used
   */
  config: {
    providers: string[];
    runs: number;
    warmup: number;
  };

  /**
   * Results for each variant
   */
  variants: Array<{
    provider: string;
    model: string;
    filePath: string;
    valid: boolean;
    generation: {
      promptTokens: number;
      completionTokens: number;
      latencyMs: number;
      costUsd: number;
    };
    validation?: {
      passed: boolean;
      totalCases: number;
      passedCases: number;
      failureReasons?: string[];
    };
    benchmark?: {
      opsPerSec: number;
      improvement: number;
      p95: number;
      stdDev: number;
      memory?: {
        rss: number;
        heapUsed: number;
      };
    };
    error?: string;
  }>;

  /**
   * Summary statistics
   */
  summary: {
    totalVariants: number;
    validVariants: number;
    fastestVariant?: string;
    maxImprovement?: number;
    totalCostUsd: number;
    totalDurationMs: number;
  };
}
