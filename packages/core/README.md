# @llm-benchmark/core

Core package for llm-benchmark - the LLM Code Optimizer & Self-Validating Benchmark Suite.

## Installation

```bash
npm install -g @llm-benchmark/core
# or
pnpm add -g @llm-benchmark/core
```

## Usage

```bash
# Basic usage
llm-benchmark optimizeProcess.js

# With options
llm-benchmark optimizeProcess.js --providers openai:gpt-4o anthropic:claude-3

# Generate only
llm-benchmark generate optimizeProcess.js

# Validate only
llm-benchmark validate optimizeProcess.js

# Benchmark only
llm-benchmark bench optimizeProcess.js
```

## Configuration

Create `llm-benchmark.yaml`:

```yaml
providers:
  - openai:gpt-4o
  - anthropic:claude-3-sonnet

validation:
  mode: static
  cases: './test-cases.json'

bench:
  runs: 5000
  warmup: 20

langPlugins:
  - js
  - py
```

## API Usage

```typescript
import {
  PluginManager,
  ProviderManager,
  ValidationRunner,
  BenchmarkRunner,
} from '@llm-benchmark/core';

// Load configuration
const config = await loadConfig('llm-benchmark.yaml');

// Initialize managers
const pluginManager = new PluginManager(config);
const providerManager = new ProviderManager(config);

await pluginManager.initialize();
await providerManager.initialize();

// Generate variants
const variants = await providerManager.generateAllVariants({
  code: sourceCode,
  signature: functionSignature,
  language: 'js',
});

// Validate variants
const validationRunner = new ValidationRunner(config, plugin);
const validationResults = await validationRunner.validateAll(variants, 'source.js');

// Benchmark valid variants
const benchmarkRunner = new BenchmarkRunner(config, plugin);
const benchResults = await benchmarkRunner.runAll(validationResults, 'source.js');
```

## Creating a Language Plugin

```typescript
import type { LangPlugin } from '@llm-benchmark/core';

export const myPlugin: LangPlugin = {
  id: 'mylang',
  extensions: ['.ml'],

  async detect(filePath) {
    return filePath.endsWith('.ml');
  },

  async extract(filePath, targetFunction) {
    // Extract function code and signature
    return { code, signature };
  },

  async format(code) {
    // Format code according to language conventions
    return formattedCode;
  },

  async validate(testCases, variantPath) {
    // Validate variant against test cases
    return { passed, results };
  },

  async benchmark(options) {
    // Run performance benchmarks
    return benchResults;
  },
};
```

## Creating a Provider Adapter

```typescript
import type { ProviderAdapter } from '@llm-benchmark/core';

export const myProvider: ProviderAdapter = {
  id: 'myprovider',
  name: 'My Provider',
  models: ['model-1', 'model-2'],

  async initialize(config) {
    // Set up API client
  },

  async generateVariant(params) {
    // Call LLM API
    return {
      code: optimizedCode,
      meta: {
        promptTokens,
        completionTokens,
        latencyMs,
        costUsd,
        model,
        provider,
      },
    };
  },

  estimateCost(params) {
    // Calculate estimated cost
    return costInUsd;
  },

  async isAvailable() {
    // Check if provider is reachable
    return true;
  },
};
```

## License

MIT
