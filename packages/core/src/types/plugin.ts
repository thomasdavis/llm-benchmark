/**
 * Function signature information
 */
export interface Signature {
  name: string;
  params: Array<{
    name: string;
    type?: string;
    optional?: boolean;
    default?: unknown;
  }>;
  returnType?: string;
  async?: boolean;
}

/**
 * Test case for validation
 */
export interface TestCase {
  id: string;
  input: unknown[];
  output: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Benchmark options
 */
export interface BenchOptions {
  runs: number;
  warmup: number;
  timeout?: number;
  baseline: string;
  variants: string[];
}

/**
 * Benchmark result for a single variant
 */
export interface BenchResult {
  variant: string;
  valid: boolean;
  metrics?: {
    opsPerSec: number;
    meanTime: number;
    p95: number;
    p99: number;
    stdDev: number;
    relativeMarginOfError: number;
    samples: number;
    memory?: {
      rss: number;
      heapUsed: number;
      external: number;
    };
    gcCount?: number;
  };
  error?: string;
  improvement?: number;
}

/**
 * Language plugin interface
 */
export interface LangPlugin {
  /**
   * Unique identifier for the plugin
   */
  id: string;

  /**
   * File extensions handled by this plugin
   */
  extensions: string[];

  /**
   * Detect if a file can be handled by this plugin
   */
  detect(filePath: string): Promise<boolean>;

  /**
   * Extract function code and signature from a file
   */
  extract(filePath: string, targetFunction?: string): Promise<{
    code: string;
    signature: Signature;
    dependencies?: string[];
  }>;

  /**
   * Format code according to language conventions
   */
  format(code: string): Promise<string>;

  /**
   * Optional compilation step
   */
  compile?(filePath: string): Promise<void>;

  /**
   * Validate a variant against test cases
   */
  validate(testCases: TestCase[], variantPath: string): Promise<{
    passed: boolean;
    results: Array<{
      caseId: string;
      passed: boolean;
      actual?: unknown;
      expected?: unknown;
      error?: string;
    }>;
  }>;

  /**
   * Run benchmarks
   */
  benchmark(options: BenchOptions): Promise<BenchResult[]>;

  /**
   * Generate test inputs for property-based testing
   */
  generateTestInputs?(signature: Signature, count: number): Promise<unknown[][]>;
}