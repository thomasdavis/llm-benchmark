import { z } from 'zod';

/**
 * Model configuration schema
 */
export const ModelConfigSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  stopSequences: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Validation configuration schema
 */
export const ValidationConfigSchema = z.object({
  mode: z.enum(['record-replay', 'property-based', 'static']),
  cases: z.string().optional(),
  recordingEnabled: z.boolean().optional(),
  propertyTests: z
    .object({
      generators: z.record(z.string(), z.any()).optional(),
      invariants: z.array(z.string()).optional(),
    })
    .optional(),
});

export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;

/**
 * Benchmark configuration schema
 */
export const BenchmarkConfigSchema = z.object({
  runs: z.number().int().positive().default(5000),
  warmup: z.number().int().nonnegative().default(20),
  timeout: z.number().int().positive().optional(),
  parallel: z.boolean().default(false),
  metrics: z
    .array(z.enum(['ops/s', 'p95', 'stddev', 'memory', 'gcCount']))
    .default(['ops/s', 'p95', 'stddev']),
});

export type BenchmarkConfig = z.infer<typeof BenchmarkConfigSchema>;

/**
 * Main configuration schema
 */
export const ConfigSchema = z.object({
  providers: z.array(z.string()),
  models: z.record(z.string(), ModelConfigSchema).optional(),
  basePrompt: z.string().optional(),
  validation: ValidationConfigSchema,
  bench: BenchmarkConfigSchema,
  langPlugins: z.array(z.string()).default(['js', 'py', 'rust']),
  output: z
    .object({
      format: z.enum(['json', 'junit', 'csv', 'html']).default('json'),
      path: z.string().default('./results.json'),
    })
    .optional(),
  ci: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * CLI options schema
 */
export const CLIOptionsSchema = z.object({
  config: z.string().optional(),
  dotenv: z.string().optional(),
  providers: z.array(z.string()).optional(),
  overwrite: z.boolean().default(false),
  runs: z.number().int().positive().optional(),
  ci: z.boolean().default(false),
  noColor: z.boolean().default(false),
  debug: z.boolean().default(false),
  quiet: z.boolean().default(false),
});