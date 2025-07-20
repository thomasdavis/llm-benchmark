# LLM Benchmark Tutorial: Optimizing a Terrible Fibonacci Implementation

This tutorial demonstrates how to use `llm-benchmark` to optimize inefficient code using various LLMs. We'll use an intentionally awful Fibonacci implementation as our example.

## The Problem: A Hilariously Bad Fibonacci Function

Let's start with this nightmare of a Fibonacci implementation:

```javascript
// fib_slow.js
var R = {}; // completely unnecessary global cache that isn't used

function fibber(n) {
  if (typeof n !== 'number') {
    n = parseInt(n);
  }
  if (isNaN(n)) {
    throw new Error('No.');
  }

  let a = 0,
    b = 1,
    counter = 0,
    trash = [];

  for (let i = 0; i < 1000000; i++) {
    let j = Math.sqrt(Math.random() * i); // just noise
    trash.push(j % 7);
    if (trash.length > 999) trash.shift();
  }

  function ___fib(x) {
    if (x < 0) {
      return -1;
    }

    if (x === 0) {
      let s = 0;
      for (let k = 0; k < 3000; k++) {
        s += Math.sin(k) * Math.random(); // absolutely no point
      }
      return 0;
    }
    if (x === 1) {
      return 1;
    }

    let d = 0;
    for (let i = 0; i < 5; i++) {
      d += (___fib(x - 1) + ___fib(x - 2)) / 2; // horrible inefficiency
    }
    return Math.floor(d / 5); // pretend this helps
  }

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let res = ___fib(n);
      resolve(res);
    }, 50 * Math.random()); // unnecessary async delay
  });
}

// IMPORTANT: Export the function as default for llm-benchmark
export default fibber;

// Or if using CommonJS:
// module.exports = fibber;
```

This function has numerous problems:

- Unused global variable
- Pointless million-iteration loop generating random noise
- Recursive implementation with no memoization
- Each recursive call happens 5 times unnecessarily
- Pointless trigonometric calculations for n=0
- Unnecessary async wrapper with random delays
- Incorrect mathematical implementation (averaging and flooring)

## Step 1: Installation

First, install llm-benchmark globally:

```bash
npm install -g llm-benchmark
```

Or use it in your project:

```bash
npm install --save-dev llm-benchmark
```

## Important: Function Export Requirements

llm-benchmark requires your function to be exported. The tool supports several export formats:

### ES Modules (Modern JavaScript)

```javascript
// Option 1: Direct export
export default function myFunction() { /* ... */ }

// Option 2: Separate definition and export
function myFunction() { /* ... */ }
export default myFunction;

// Option 3: Named export
export function myFunction() { /* ... */ }
// Usage: llm-benchmark file.js myFunction
```

**Note:** If using ES module syntax (`export`/`import`) in a `.js` file, you need one of:

- A `package.json` in the same directory with `{"type": "module"}`
- Rename your file to use `.mjs` extension
- Use CommonJS syntax instead

### CommonJS (Traditional Node.js)

```javascript
// Option 1: Direct export
module.exports = function myFunction() {
  /* ... */
};

// Option 2: Separate definition and export
function myFunction() {
  /* ... */
}
module.exports = myFunction;

// Option 3: Named exports
module.exports = { myFunction, anotherFunction };
// Usage: llm-benchmark file.js myFunction
```

### File Extensions

- `.js` - Treated as CommonJS by default (unless package.json has `"type": "module"`)
- `.mjs` - Always treated as ES module
- `.cjs` - Always treated as CommonJS
- `.ts` - TypeScript (automatically compiled)

## Step 2: Create Test Cases

Create a test file `fib_slow.test.json` with expected input/output pairs:

```json
{
  "cases": [
    { "input": [0], "output": 0 },
    { "input": [1], "output": 1 },
    { "input": [2], "output": 1 },
    { "input": [3], "output": 2 },
    { "input": [4], "output": 3 },
    { "input": [5], "output": 5 },
    { "input": [10], "output": 55 },
    { "input": [15], "output": 610 },
    { "input": [20], "output": 6765 }
  ]
}
```

## Step 3: Configure LLM Benchmark

Create a `llm-benchmark.yaml` configuration file:

```yaml
# llm-benchmark.yaml
providers:
  - openai:gpt-4o
  - openai:gpt-4o-mini
  - anthropic:claude-3-5-sonnet-20241022
  - anthropic:claude-3-5-haiku-20241022

validation:
  mode: static
  comparison: exact

benchmark:
  runs: 100
  warmup: 10
  parallel: false
  metrics:
    - ops/s
    - mean
    - median

output:
  format: table
  file: results.json
```

## Step 4: Run the Optimization

Set up your API keys:

```bash
export OPENAI_API_KEY=your-openai-key
export ANTHROPIC_API_KEY=your-anthropic-key
```

Run the benchmark:

```bash
# Simple command - uses all providers from config
llm-benchmark fib_slow.js

# Or specify providers explicitly
llm-benchmark fib_slow.js --providers openai:gpt-4o anthropic:claude-3-5-sonnet-20241022

# Additional options
llm-benchmark fib_slow.js \
  --providers openai:gpt-4o \
  --runs 1000 \
  --ci
```

Note: The tool automatically discovers test files named `*.test.json`, `*.test.yaml`, or `*.test.yml` in the same directory as your source file.

## Step 5: Understanding the Output

LLM Benchmark will:

1. **Extract** the function from your code
2. **Send** it to each configured LLM with optimization instructions
3. **Validate** each optimized version against your test cases
4. **Benchmark** the performance of valid implementations
5. **Report** results in a table format

Example output:

```
┌─────────────────────────────────┬─────────┬──────────┬────────────┐
│ Provider                        │ Valid   │ Ops/sec  │ Speedup    │
├─────────────────────────────────┼─────────┼──────────┼────────────┤
│ openai:gpt-4o                   │ ✓       │ 125,432  │ 1,254x     │
│ anthropic:claude-3-5-sonnet     │ ✓       │ 198,765  │ 1,987x     │
│ openai:gpt-4o-mini              │ ✓       │ 89,123   │ 891x       │
│ anthropic:claude-3-5-haiku      │ ✓       │ 156,789  │ 1,567x     │
└─────────────────────────────────┴─────────┴──────────┴────────────┘
```

## Step 6: Examining Optimized Versions

The optimized versions will be saved in an `optimized/` directory. Here's what a typical optimization might look like:

```javascript
// optimized/fibber_gpt-4o.js
function fibber(n) {
  n = parseInt(n);
  if (isNaN(n)) {
    throw new Error('Invalid input');
  }

  if (n < 0) return -1;
  if (n <= 1) return n;

  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }

  return b;
}

export default fibber;
```

## Step 7: Performance Comparison

You can also run a detailed performance comparison:

```bash
llm-benchmark compare \
  fib_slow.js \
  optimized/fibber_gpt-4o.js \
  optimized/fibber_claude-3-5-sonnet.js \
  --output comparison.html
```

This generates an HTML report with:

- Performance charts
- Code diffs
- Validation results
- Cost analysis

## Step 8: Continuous Integration

Add to your CI pipeline (`.github/workflows/benchmark.yml`):

```yaml
name: LLM Benchmark

on:
  pull_request:
    paths:
      - '**/*.js'

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Run LLM Benchmark
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          llm-benchmark **/*.js \
            --providers "openai:gpt-4o-mini" \
            --fail-on-regression \
            --output benchmark-results.json

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const results = require('./benchmark-results.json');
            // Format and post results as PR comment
```

## Advanced Usage

### Custom Prompts

Create a custom prompt template:

```javascript
// optimize-prompt.txt
Optimize this {{language}} function for maximum performance:
- Remove all unnecessary operations
- Use the most efficient algorithm
- Maintain the same interface
- Ensure mathematical correctness

Function to optimize:
{{code}}
```

Use it:

```bash
llm-benchmark fib_slow.js --prompt-file optimize-prompt.txt
```

### Plugin System

Create custom language plugins for other languages:

```typescript
// plugins/python.ts
export default {
  id: 'python',
  extensions: ['.py'],
  detect: async (file) => file.endsWith('.py'),
  extract: async (file) => {
    // Extract Python functions
  },
  validate: async (code, testCases) => {
    // Run Python tests
  },
};
```

### Batch Processing

Process multiple files:

```bash
# Create a batch configuration
cat > batch.yaml << EOF
files:
  - path: src/utils/fib.js
    providers: [openai:gpt-4o]
  - path: src/utils/sort.js
    providers: [anthropic:claude-3-5-sonnet]
  - path: src/utils/search.js
    providers: [openai:gpt-4o, anthropic:claude-3-5-haiku]
EOF

# Run batch optimization
llm-benchmark batch batch.yaml
```

## Best Practices

1. **Start with Clear Test Cases**: Define comprehensive test cases before optimization
2. **Use Multiple Providers**: Different LLMs may produce different optimization strategies
3. **Validate Thoroughly**: Always verify the optimized code maintains correctness
4. **Benchmark Realistically**: Use representative inputs for benchmarking
5. **Monitor Costs**: Track API usage to manage costs effectively

## Conclusion

The `llm-benchmark` tool transforms the tedious process of code optimization into an automated workflow. By leveraging multiple LLMs, you can:

- Quickly identify the best optimization strategies
- Ensure correctness through automated testing
- Measure real performance improvements
- Make data-driven decisions about code optimization

In our example, the terrible Fibonacci function that took seconds to compute fib(25) was transformed into implementations that can compute fib(1000) in microseconds - a improvement of several orders of magnitude!

## Next Steps

- Explore the [API documentation](./docs/api.md)
- Check out more [examples](./examples/)
- Contribute to the [project](https://github.com/your-username/llm-benchmark)
- Read about [writing custom plugins](./docs/plugins.md)
