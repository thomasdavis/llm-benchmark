# 🚀 llm-benchmark

> **Everywhere-Ready LLM Code Optimizer & Self-Validating Benchmark Suite**

[![npm version](https://img.shields.io/npm/v/@llm-benchmark/core.svg)](https://www.npmjs.com/package/@llm-benchmark/core)
[![CI](https://github.com/ajaxdavis/llm-benchmark/actions/workflows/ci.yml/badge.svg)](https://github.com/ajaxdavis/llm-benchmark/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Ship "optimized by AI" code with confidence. `llm-benchmark` automatically generates, validates, and benchmarks LLM-optimized variants of your functions across multiple providers.

![Demo](./docs/demo.gif)

## ✨ Features

- 🤖 **Multi-Provider Support** - OpenAI, Anthropic, Azure, Ollama, and more
- 🌍 **Polyglot** - JavaScript, TypeScript, Python, Rust, Go, and growing
- ✅ **Self-Validating** - Ensures functional equivalence before benchmarking
- 📊 **Rich Benchmarks** - Ops/sec, percentiles, memory usage, cost analysis
- 🎨 **Beautiful TUI** - Real-time progress, results visualization
- 🔌 **Extensible** - Plugin architecture for languages and providers
- 📦 **Zero Lock-in** - Export to JSON, CSV, JUnit, HTML

## 🚀 Quick Start

```bash
# Install globally
npm install -g @llm-benchmark/core

# Or use npx
npx @llm-benchmark/core demo

# Optimize a function
llm-benchmark optimizeProcess.js

# With specific providers
llm-benchmark optimizeProcess.js --providers openai:gpt-4o anthropic:claude-3

# CI mode (no interactive UI)
llm-benchmark optimizeProcess.js --ci
```

## 📋 Prerequisites

- Node.js ≥ 18
- API keys for your chosen providers (OpenAI, Anthropic, etc.)

## 🔧 Configuration

Create `llm-benchmark.yaml` in your project:

```yaml
providers:
  - openai:gpt-4o
  - anthropic:claude-3-sonnet

validation:
  mode: record-replay # or 'static' or 'property-based'
  cases: ./test-cases.json

bench:
  runs: 5000
  warmup: 20

langPlugins:
  - js
  - py
  - rust
```

Set up your `.env`:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## 📚 Example

Given this function:

```javascript
// optimizeProcess.js
export default function optimizeProcess(records) {
  const valid = records.filter((r) => r.status === 'active' && r.value > 0);
  const transformed = valid.map((r) => ({
    ...r,
    value: r.value * 1.1,
    category: r.category.toUpperCase(),
  }));

  return Object.values(
    transformed.reduce((acc, r) => {
      if (!acc[r.category]) {
        acc[r.category] = { count: 0, total: 0 };
      }
      acc[r.category].count++;
      acc[r.category].total += r.value;
      return acc;
    }, {}),
  );
}
```

### Running the Benchmark

```bash
# Step 1: Navigate to the example directory
cd examples/js

# Step 2: Install dependencies (if needed)
npm install

# Step 3: Run the benchmark
llm-benchmark optimizeProcess.js

# Or run from the monorepo root
cd ../..
node packages/core/bin/llm-benchmark.js examples/js/optimizeProcess.js
```

### Sample Output

```
🚀 LLM Benchmark

📝 Generating optimized variants...
  ✓ openai:gpt-4o completed
  ✓ anthropic:claude-3-sonnet completed

✅ Validating variants...
  ✓ All variants passed 100 test cases

📊 Running benchmarks...

🏆 Benchmark Results
──────────────────────────────────────────────────────────────────────
Variant                     Ops/sec      Improvement   P95 (ms)   σ
──────────────────────────────────────────────────────────────────────
🔥 openai.gpt_4o           125,420      +34.2%        0.045      ±2.1%
   anthropic.claude_3      118,230      +26.5%        0.048      ±1.8%
   original                 93,420      baseline      0.062      ±2.3%
──────────────────────────────────────────────────────────────────────

✅ All variants passed validation (1,000 test cases)
💰 Total cost: $0.0234
📄 Results saved to: ./results.json
```

### Generated Optimized Code

The tool will generate optimized variants like:

```javascript
// optimizeProcess.openai.gpt-4o.js
export default function optimizeProcess(records) {
  const grouped = {};

  // Single pass through records
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record && record.status === 'active' && record.value > 0) {
      const category = record.category.toUpperCase();
      const transformedValue = record.value * 1.1;

      if (!grouped[category]) {
        grouped[category] = { total: 0, count: 0 };
      }

      grouped[category].total += transformedValue;
      grouped[category].count++;
    }
  }

  return Object.values(grouped);
}
```

## 🏗️ Architecture

```
llm-benchmark
├── packages/
│   ├── core/              # CLI and orchestration
│   ├── adapters/         # Provider adapters (OpenAI, Anthropic, etc.)
│   └── plugins/          # Language plugins (JS, Python, Rust, etc.)
├── examples/             # Example projects
└── docs/                # Documentation
```

## 🧩 Plugins

### Language Plugins

- ✅ JavaScript/TypeScript
- ✅ Python
- ✅ Rust
- 🚧 Go
- 🚧 Java
- 🚧 C/C++

### Provider Adapters

- ✅ OpenAI (GPT-4, GPT-3.5)
- ✅ Anthropic (Claude 3)
- 🚧 Azure OpenAI
- 🚧 Google Vertex AI
- 🚧 Ollama (local models)
- 🚧 Cohere

## 🛠️ Advanced Usage

### Command Reference

```bash
# Generate variants only
llm-benchmark generate <file> [function]

# Validate existing variants
llm-benchmark validate <file> [function]

# Benchmark validated variants
llm-benchmark bench <file> [function]

# Preview prompts
llm-benchmark prompt <file> [function]
```

### Global Options

- `--config <path>` - Config file path (default: `llm-benchmark.json`)
- `--providers <providers...>` - Override configured providers
- `--runs <number>` - Override benchmark iterations
- `--ci` - CI mode (no interactive UI)
- `--no-color` - Disable colored output
- `--debug` - Enable debug logging

## 🧪 Validation Modes

### Static Test Cases

Provide test cases in JSON/YAML:

```json
{
  "cases": [
    {
      "input": [{ "status": "active", "value": 100, "category": "electronics" }],
      "output": { "ELECTRONICS": { "count": 1, "total": 110 } }
    }
  ]
}
```

### Record-Replay

Automatically capture real execution:

```yaml
validation:
  mode: record-replay
  recordingEnabled: true
```

### Property-Based Testing

Generate test inputs with invariants:

```yaml
validation:
  mode: property-based
  propertyTests:
    invariants:
      - 'output.total >= 0'
      - 'output.count === input.length'
```

## 📊 Output Formats

- **JSON** - Detailed results with metadata
- **CSV** - Spreadsheet-friendly format
- **JUnit XML** - CI integration
- **HTML** - Interactive report

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Clone the repo
git clone https://github.com/ajaxdavis/llm-benchmark.git
cd llm-benchmark

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build all packages
pnpm build
```

## 📜 License

MIT © Ajax Davis

## 🙏 Acknowledgments

Built with:

- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- [Benchmark.js](https://benchmarkjs.com/) - Benchmarking library

---

<p align="center">
  Made with ❤️ by developers, for developers
</p>
