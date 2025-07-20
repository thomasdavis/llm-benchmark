import { existsSync } from 'fs';
import { resolve } from 'path';

import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';

import { BenchmarkRunner } from '../../benchmark/runner.js';
import { loadConfig } from '../../config/loader.js';
import { PluginManager } from '../../plugins/manager.js';
import type { BenchmarkResults } from '../../types/benchmark.js';
import { ResultsWriter } from '../../utils/results-writer.js';
import { VariantFinder } from '../../utils/variant-finder.js';
import { ValidationRunner } from '../../validation/runner.js';

/**
 * Benchmark existing validated variants
 */
export async function benchCommand(
  file: string,
  targetFunction: string | undefined,
  options: any,
): Promise<void> {
  const startTime = Date.now();
  const filePath = resolve(file);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const spinner = ora();

  try {
    spinner.start('Loading configuration...');

    // Load configuration
    const config = await loadConfig(options.config, options);

    // Initialize plugin manager
    const pluginManager = new PluginManager(config);
    await pluginManager.initialize();

    spinner.succeed('Configuration loaded');

    // Detect language plugin
    const plugin = await pluginManager.detectPlugin(filePath);
    if (!plugin) {
      throw new Error(`No language plugin found for file: ${filePath}`);
    }

    // Find existing variants
    spinner.start('Finding variant files...');
    const variantFinder = new VariantFinder();
    const variantFiles = await variantFinder.findVariants(filePath);

    if (variantFiles.length === 0) {
      spinner.fail('No variant files found');
      console.log(chalk.yellow('\n⚠️  No variants found. Run "llm-benchmark generate" first.'));
      return;
    }

    spinner.succeed(`Found ${variantFiles.length} variant files`);

    // Extract original function
    const extraction = await plugin.extract(filePath, targetFunction);

    // Validate variants first
    spinner.start('Validating variants...');
    const validationRunner = new ValidationRunner(config, plugin, options.debug);
    const validationResults = await validationRunner.validateFiles(
      variantFiles,
      filePath,
      extraction.signature,
    );

    const validVariants = validationResults.filter((r) => r.passed);
    spinner.succeed(
      `Validation complete: ${validVariants.length}/${variantFiles.length} variants valid`,
    );

    if (validVariants.length === 0) {
      console.log(chalk.yellow('\n⚠️  No valid variants to benchmark'));
      return;
    }

    // Run benchmarks
    spinner.start(`Running benchmarks (${config.bench.runs} iterations)...`);
    const benchmarkRunner = new BenchmarkRunner(config, plugin);
    const benchResults = await benchmarkRunner.runValidated(validVariants, filePath);

    spinner.succeed('Benchmarks complete');

    // Sort by performance
    benchResults.sort((a, b) => (b.benchmark?.improvement || 0) - (a.benchmark?.improvement || 0));

    // Print results table
    console.log(chalk.green('\n🏆 Benchmark Results'));
    console.log(chalk.dim('─'.repeat(80)));
    console.log(
      chalk.bold(
        'Variant'.padEnd(30) +
          'Ops/sec'.padEnd(15) +
          'Improvement'.padEnd(15) +
          'P95 (ms)'.padEnd(12) +
          'σ'.padEnd(8),
      ),
    );
    console.log(chalk.dim('─'.repeat(80)));

    benchResults.forEach((result, index) => {
      const icon = index === 0 ? '🔥' : '  ';
      const variant = result.variant.substring(0, 28);
      const opsPerSec = result.benchmark?.opsPerSec.toFixed(0) || 'N/A';
      const improvement = result.benchmark?.improvement
        ? chalk.green(`+${result.benchmark.improvement.toFixed(1)}%`)
        : 'baseline';
      const p95 = result.benchmark?.p95 ? result.benchmark.p95.toFixed(3) : 'N/A';
      const stdDev = result.benchmark?.stdDev ? `±${result.benchmark.stdDev.toFixed(1)}%` : 'N/A';

      console.log(
        `${icon} ${variant.padEnd(28)} ${opsPerSec.padEnd(13)} ${improvement.padEnd(
          13,
        )} ${p95.padEnd(10)} ${stdDev}`,
      );
    });

    console.log(chalk.dim('─'.repeat(80)));

    // Prepare full results
    const results: BenchmarkResults = {
      timestamp: new Date().toISOString(),
      sourceFile: filePath,
      targetFunction: extraction.signature.name,
      config: {
        providers: config.providers,
        runs: config.bench.runs,
        warmup: config.bench.warmup,
      },
      variants: benchResults.map((r) => ({
        provider: r.variant.split('.')[1] || 'unknown',
        model: r.variant.split('.')[2] || 'unknown',
        filePath: r.filePath,
        valid: true,
        generation: r.generation || {
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: 0,
          costUsd: 0,
        },
        validation: {
          passed: true,
          totalCases: r.validation?.totalCases || 0,
          passedCases: r.validation?.passedCases || 0,
        },
        benchmark: r.benchmark,
      })),
      summary: {
        totalVariants: variantFiles.length,
        validVariants: validVariants.length,
        fastestVariant: benchResults[0]?.variant,
        maxImprovement: benchResults[0]?.benchmark?.improvement,
        totalCostUsd: 0, // Would need to load from variant metadata
        totalDurationMs: Date.now() - startTime,
      },
    };

    // Write results
    const writer = new ResultsWriter(config);
    await writer.write(results);

    // Print summary box
    const summaryBox = boxen(
      [
        chalk.bold('📊 Summary'),
        '',
        `Function: ${chalk.cyan(extraction.signature.name)}`,
        `Valid variants: ${chalk.green(validVariants.length)}/${variantFiles.length}`,
        results.summary.fastestVariant
          ? `Fastest: ${chalk.cyan(results.summary.fastestVariant)}`
          : '',
        results.summary.maxImprovement
          ? `Max improvement: ${chalk.green(`+${results.summary.maxImprovement.toFixed(1)}%`)}`
          : '',
        `Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        '',
        `Results saved to: ${chalk.dim(writer.getOutputPath())}`,
      ]
        .filter(Boolean)
        .join('\n'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
      },
    );

    console.log(summaryBox);
  } catch (error) {
    spinner.fail('Benchmark failed');
    throw error;
  }
}
