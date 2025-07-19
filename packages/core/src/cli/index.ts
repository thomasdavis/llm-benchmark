import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import chalk from 'chalk';
import { Command } from 'commander';
import updateNotifier from 'update-notifier';
import { z } from 'zod';

import type { CLIOptionsSchema } from '../types/config.js';

import { benchCommand } from './commands/bench.js';
import { generateCommand } from './commands/generate.js';
import { promptCommand } from './commands/prompt.js';
import { runCommand } from './commands/run.js';
import { validateCommand } from './commands/validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

/**
 * Check for updates
 */
const notifier = updateNotifier({ pkg: packageJson });
notifier.notify();

/**
 * Main CLI program
 */
const program = new Command();

program
  .name('llm-benchmark')
  .description('Everywhere-Ready LLM Code Optimizer & Self-Validating Benchmark Suite')
  .version(packageJson.version)
  .option('-c, --config <path>', 'path to config file', 'llm-benchmark.json')
  .option('-e, --dotenv <path>', 'path to .env file', '.env')
  .option('-p, --providers <providers...>', 'override configured providers')
  .option('--overwrite', 'overwrite existing variant files', false)
  .option('-r, --runs <number>', 'override number of benchmark runs', parseInt)
  .option('--ci', 'run in CI mode (no interactive UI)', false)
  .option('--no-color', 'disable colored output')
  .option('--debug', 'enable debug logging', false)
  .option('-q, --quiet', 'suppress non-essential output', false);

/**
 * Default command - run full pipeline
 */
program
  .argument('<file>', 'source file to optimize')
  .argument('[function]', 'specific function to target')
  .action(async (file: string, targetFunction: string | undefined, options: unknown) => {
    try {
      const validatedOptions = z
        .object({
          config: z.string(),
          dotenv: z.string().optional(),
          providers: z.array(z.string()).optional(),
          overwrite: z.boolean(),
          runs: z.number().optional(),
          ci: z.boolean(),
          color: z.boolean(),
          debug: z.boolean(),
          quiet: z.boolean(),
        })
        .parse(options);

      await runCommand(file, targetFunction, validatedOptions);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Generate command - only generate variants
 */
program
  .command('generate <file> [function]')
  .description('Generate optimized variants without validation or benchmarking')
  .action(async (file: string, targetFunction: string | undefined, options: unknown) => {
    try {
      const parentOptions = program.opts();
      const mergedOptions = Object.assign({}, parentOptions, options);
      await generateCommand(file, targetFunction, mergedOptions);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Validate command - validate existing variants
 */
program
  .command('validate <file> [function]')
  .description('Validate existing variants against test cases')
  .action(async (file: string, targetFunction: string | undefined, options: unknown) => {
    try {
      const parentOptions = program.opts();
      const mergedOptions = Object.assign({}, parentOptions, options);
      await validateCommand(file, targetFunction, mergedOptions);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Bench command - benchmark existing validated variants
 */
program
  .command('bench <file> [function]')
  .description('Benchmark existing validated variants')
  .action(async (file: string, targetFunction: string | undefined, options: unknown) => {
    try {
      const parentOptions = program.opts();
      const mergedOptions = Object.assign({}, parentOptions, options);
      await benchCommand(file, targetFunction, mergedOptions);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Prompt command - preview prompts
 */
program
  .command('prompt <file> [function]')
  .description('Preview the prompt that will be sent to each provider')
  .action(async (file: string, targetFunction: string | undefined, options: unknown) => {
    try {
      const parentOptions = program.opts();
      const mergedOptions = Object.assign({}, parentOptions, options);
      await promptCommand(file, targetFunction, mergedOptions);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Parse arguments and run
 */
program.parse(process.argv);
