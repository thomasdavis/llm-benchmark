import { existsSync } from 'fs';
import { resolve } from 'path';

import chalk from 'chalk';
import { diffLines } from 'diff';
import ora from 'ora';

import { loadConfig } from '../../config/loader.js';
import { PluginManager } from '../../plugins/manager.js';
import { VariantFinder } from '../../utils/variant-finder.js';
import { ValidationRunner } from '../../validation/runner.js';

/**
 * Validate existing variants against test cases
 */
export async function validateCommand(
  file: string,
  targetFunction: string | undefined,
  options: any,
): Promise<void> {
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

    // Extract original function for comparison
    const extraction = await plugin.extract(filePath, targetFunction);

    // Run validation
    spinner.start('Running validation...');
    const validationRunner = new ValidationRunner(config, plugin);
    const results = await validationRunner.validateFiles(
      variantFiles,
      filePath,
      extraction.signature,
    );

    spinner.succeed('Validation complete');

    // Print results
    console.log(chalk.green('\n📊 Validation Results'));
    console.log(chalk.dim('─'.repeat(50)));

    let totalPassed = 0;
    let totalFailed = 0;

    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      const status = result.passed ? chalk.green('PASSED') : chalk.red('FAILED');

      console.log(`\n${icon} ${chalk.bold(result.variant)}: ${status}`);
      console.log(`   Cases: ${result.passedCases}/${result.totalCases} passed`);

      if (!result.passed && result.results.some((r) => !r.passed)) {
        console.log(chalk.dim('\n   Failed cases:'));

        for (const testResult of result.results.filter((r) => !r.passed)) {
          console.log(chalk.red(`\n   Case ${testResult.caseId}:`));
          console.log(chalk.dim(`     Input: ${JSON.stringify(testResult.input)}`));
          console.log(chalk.dim(`     Expected: ${JSON.stringify(testResult.expected)}`));
          console.log(chalk.dim(`     Actual: ${JSON.stringify(testResult.actual)}`));

          if (testResult.error) {
            console.log(chalk.red(`     Error: ${testResult.error}`));
          }

          // Show diff for complex outputs
          if (typeof testResult.expected === 'object' && typeof testResult.actual === 'object') {
            const expectedStr = JSON.stringify(testResult.expected, null, 2);
            const actualStr = JSON.stringify(testResult.actual, null, 2);
            const diff = diffLines(expectedStr, actualStr);

            console.log(chalk.dim('\n     Diff:'));
            diff.forEach((part) => {
              const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.dim;
              process.stdout.write(color(part.value));
            });
          }
        }
      }

      if (result.passed) totalPassed++;
      else totalFailed++;
    }

    // Summary
    console.log(chalk.dim('\n' + '─'.repeat(50)));
    console.log(chalk.bold('\n📈 Summary:'));
    console.log(`  Total variants: ${results.length}`);
    console.log(`  ${chalk.green(`Passed: ${totalPassed}`)}`);
    console.log(`  ${chalk.red(`Failed: ${totalFailed}`)}`);

    if (totalPassed > 0) {
      console.log(chalk.cyan('\n💡 Next step:'));
      console.log(
        `  Run ${chalk.bold('llm-benchmark bench')} to benchmark the ${totalPassed} valid variant${
          totalPassed > 1 ? 's' : ''
        }`,
      );
    }

    // Exit with error code if validation failed
    if (totalFailed > 0 && options.ci) {
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Validation failed');
    throw error;
  }
}
