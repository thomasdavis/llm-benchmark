# Contributing to llm-benchmark

First off, thank you for considering contributing to llm-benchmark! It's people like you that make llm-benchmark such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [llm-benchmark Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps which reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs if possible**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes (`pnpm test`)
5. Make sure your code lints (`pnpm lint`)
6. Issue that pull request!

## Development Setup

1. Fork and clone the repository

   ```bash
   git clone https://github.com/your-username/llm-benchmark.git
   cd llm-benchmark
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Build all packages

   ```bash
   pnpm build
   ```

4. Run tests

   ```bash
   pnpm test
   ```

5. Link for local development
   ```bash
   cd packages/core
   npm link
   ```

## Project Structure

```
llm-benchmark/
├── packages/
│   ├── core/              # Main CLI and orchestration
│   ├── adapters/         # Provider adapters
│   └── plugins/          # Language plugins
├── examples/             # Example projects
├── docs/                # Documentation
└── scripts/             # Build and maintenance scripts
```

### Creating a Language Plugin

1. Create a new package in `packages/plugins/`
2. Implement the `LangPlugin` interface
3. Add tests for your plugin
4. Update documentation

Example structure:

```typescript
export const myPlugin: LangPlugin = {
  id: 'mylang',
  extensions: ['.ml'],
  async detect(filePath) {
    /* ... */
  },
  async extract(filePath) {
    /* ... */
  },
  async format(code) {
    /* ... */
  },
  async validate(cases, variantPath) {
    /* ... */
  },
  async benchmark(options) {
    /* ... */
  },
};
```

### Creating a Provider Adapter

1. Create a new package in `packages/adapters/`
2. Implement the `ProviderAdapter` interface
3. Add appropriate rate limiting and error handling
4. Update documentation

Example structure:

```typescript
export const myProvider: ProviderAdapter = {
  id: 'myprovider',
  name: 'My Provider',
  models: ['model-1', 'model-2'],
  async initialize(config) {
    /* ... */
  },
  async generateVariant(params) {
    /* ... */
  },
  estimateCost(params) {
    /* ... */
  },
  async isAvailable() {
    /* ... */
  },
};
```

## Testing

- Write unit tests for all new functionality
- Ensure 90%+ code coverage
- Use meaningful test descriptions
- Mock external API calls

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch
```

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that don't affect code meaning
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Code change that improves performance
- `test:` Adding missing tests
- `chore:` Changes to the build process or auxiliary tools

## Documentation

- Update README.md with details of changes to the interface
- Update JSDoc comments for all public APIs
- Add examples for new features
- Keep the CLI help text up to date

## Release Process

1. Update version numbers following [SemVer](https://semver.org/)
2. Update CHANGELOG.md
3. Create a pull request for the release
4. After merge, tag the release
5. GitHub Actions will handle npm publishing

## Questions?

Feel free to open an issue with your question or reach out to the maintainers.

Thank you for your contributions! 🎉
