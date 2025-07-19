import { existsSync } from 'fs';
import { resolve } from 'path';

import chalk from 'chalk';
import ora from 'ora';

import { BenchmarkRunner } from '../../benchmark/runner.js';
import { loadConfig } from '../../config/loader.js';
import { PluginManager } from '../../plugins/manager.js';
import { ProviderManager } from '../../providers/manager.js';
import type { BenchmarkResults } from '../../types/benchmark.js';
import { ResultsWriter } from '../../utils/results-writer.js';
import { ValidationRunner } from '../../validation/runner.js';
import { TUI } from '../tui/index.js';

/**
 * Run the full optimization pipeline
 */
export async function runCommand(
  file: string,
  targetFunction: string | undefined,
  options: any
): Promise<void> {
  const startTime = Date.now();
  const filePath = resolve(file);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const spinner = options.ci ? ora() : null;

  try {
    if (spinner) spinner.start('Loading configuration...');
    
    // Load configuration
    const config = await loadConfig(options.config, options);
    
    // Initialize managers
    const pluginManager = new PluginManager(config);
    const providerManager = new ProviderManager(config);
    
    await pluginManager.initialize();
    await providerManager.initialize();
    
    if (spinner) spinner.succeed('Configuration loaded');

    // Detect language plugin
    const plugin = await pluginManager.detectPlugin(filePath);
    if (!plugin) {
      throw new Error(`No language plugin found for file: ${filePath}`);
    }

    // Extract function
    if (spinner) spinner.start('Extracting function...');
    const extraction = await plugin.extract(filePath, targetFunction);
    if (spinner) spinner.succeed(`Extracted function: ${extraction.signature.name}`);

    // Initialize TUI if not in CI mode
    let tui: TUI | null = null;
    if (!options.ci && !options.quiet) {
      tui = new TUI(config, extraction.signature.name);
      await tui.start();
    }

    // Generate variants
    if (spinner) spinner.start('Generating variants...');
    const variants = await providerManager.generateAllVariants({
      code: extraction.code,
      signature: extraction.signature,
      language: plugin.id,
      onProgress: (provider, status) => {
        if (tui) {
          tui.updateProviderStatus(provider, status);
        }
      },
    });
    
    if (spinner) spinner.succeed(`Generated ${variants.length} variants`);

    // Write variant files
    for (const variant of variants) {
      await plugin.format(variant.code);
      // Write variant file logic here
    }

    // Validate variants
    if (spinner) spinner.start('Validating variants...');
    const validationRunner = new ValidationRunner(config, plugin);
    const validationResults = await validationRunner.validateAll(variants, filePath);
    
    const validVariants = validationResults.filter(r => r.passed);
    if (spinner) {
      spinner.succeed(`Validation complete: ${validVariants.length}/${variants.length} variants valid`);
    }

    // Benchmark valid variants
    if (validVariants.length > 0) {
      if (spinner) spinner.start('Running benchmarks...');
      const benchmarkRunner = new BenchmarkRunner(config, plugin);
      const benchResults = await benchmarkRunner.runAll(validVariants, filePath);
      
      if (spinner) spinner.succeed('Benchmarks complete');

      // Prepare results
      const results: BenchmarkResults = {
        timestamp: new Date().toISOString(),
        sourceFile: filePath,
        targetFunction: extraction.signature.name,
        config: {
          providers: config.providers,
          runs: config.bench.runs,
          warmup: config.bench.warmup,
        },
        variants: benchResults,
        summary: {
          totalVariants: variants.length,
          validVariants: validVariants.length,
          fastestVariant: benchResults[0]?.provider,
          maxImprovement: benchResults[0]?.benchmark?.improvement,
          totalCostUsd: variants.reduce((sum, v) => sum + v.meta.costUsd, 0),
          totalDurationMs: Date.now() - startTime,
        },
      };

      // Write results
      const writer = new ResultsWriter(config);
      await writer.write(results);

      // Update TUI with final results
      if (tui) {
        tui.showResults(results);
        await tui.waitForExit();
      }

      // Print summary in CI mode
      if (options.ci || options.quiet) {
        console.log(chalk.green('\n✅ Benchmark Complete!'));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(`Total variants: ${results.summary.totalVariants}`);
        console.log(`Valid variants: ${results.summary.validVariants}`);
        if (results.summary.fastestVariant) {
          console.log(`Fastest: ${chalk.cyan(results.summary.fastestVariant)}`);
          console.log(`Improvement: ${chalk.green(`+${results.summary.maxImprovement?.toFixed(1)}%`)}`);
        }
        console.log(`Total cost: ${chalk.yellow(`$${results.summary.totalCostUsd.toFixed(4)}`)}`);
        console.log(`Results saved to: ${chalk.dim(writer.getOutputPath())}`);
      }
    } else {
      console.log(chalk.yellow('\n⚠️  No valid variants to benchmark'));
    }
  } catch (error) {
    if (spinner) spinner.fail('Operation failed');
    throw error;
  }
}