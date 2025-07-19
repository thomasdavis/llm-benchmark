import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

import chalk from 'chalk';
import { config as loadDotenv } from 'dotenv';
import yaml from 'js-yaml';

import type { Config } from '../types/config.js';
import { ConfigSchema } from '../types/config.js';

/**
 * Load and validate configuration
 */
export async function loadConfig(configPath: string, cliOptions: any): Promise<Config> {
  // Load environment variables
  if (cliOptions.dotenv && existsSync(cliOptions.dotenv)) {
    loadDotenv({ path: cliOptions.dotenv });
  } else if (existsSync('.env')) {
    loadDotenv();
  }

  // Check for config file
  const resolvedPath = resolve(configPath);
  let rawConfig: any = {};

  if (existsSync(resolvedPath)) {
    const content = await readFile(resolvedPath, 'utf-8');

    if (resolvedPath.endsWith('.yaml') || resolvedPath.endsWith('.yml')) {
      rawConfig = yaml.load(content) as any;
    } else if (resolvedPath.endsWith('.json')) {
      rawConfig = JSON.parse(content);
    } else {
      throw new Error(`Unsupported config file format: ${resolvedPath}`);
    }
  } else if (configPath !== 'llm-benchmark.json') {
    // Only error if user explicitly specified a config file
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  // Merge with CLI options
  const mergedConfig = {
    ...rawConfig,
    ...(cliOptions.providers && { providers: cliOptions.providers }),
    ...(cliOptions.runs && {
      bench: {
        ...rawConfig.bench,
        runs: cliOptions.runs,
      },
    }),
    ...(cliOptions.ci !== undefined && { ci: cliOptions.ci }),
  };

  // Apply defaults if no config file
  if (!existsSync(resolvedPath)) {
    mergedConfig.providers = mergedConfig.providers || ['openai:gpt-4o'];
    mergedConfig.validation = mergedConfig.validation || { mode: 'record-replay' };
    mergedConfig.bench = mergedConfig.bench || { runs: 5000, warmup: 20 };
    mergedConfig.langPlugins = mergedConfig.langPlugins || ['js'];
  }

  // Validate configuration
  try {
    const validated = ConfigSchema.parse(mergedConfig);

    // Check for required environment variables
    validateEnvironment(validated);

    return validated;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid configuration: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate that required environment variables are set
 */
function validateEnvironment(config: Config): void {
  const missingVars: string[] = [];

  for (const provider of config.providers) {
    const [providerId] = provider.split(':');

    switch (providerId) {
      case 'openai':
        if (!process.env.OPENAI_API_KEY) {
          missingVars.push('OPENAI_API_KEY');
        }
        break;
      case 'anthropic':
        if (!process.env.ANTHROPIC_API_KEY) {
          missingVars.push('ANTHROPIC_API_KEY');
        }
        break;
      case 'azure':
        if (!process.env.AZURE_OPENAI_API_KEY) {
          missingVars.push('AZURE_OPENAI_API_KEY');
        }
        if (!process.env.AZURE_OPENAI_ENDPOINT) {
          missingVars.push('AZURE_OPENAI_ENDPOINT');
        }
        break;
      case 'ollama':
        // Ollama doesn't require API keys
        break;
    }
  }

  if (missingVars.length > 0) {
    console.error(chalk.red('\n❌ Missing required environment variables:'));
    missingVars.forEach((varName) => {
      console.error(chalk.red(`   - ${varName}`));
    });
    console.error(chalk.yellow('\n💡 Set these in your .env file or environment'));
    throw new Error('Missing required environment variables');
  }
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): Config {
  return {
    providers: ['openai:gpt-4o'],
    validation: {
      mode: 'record-replay',
    },
    bench: {
      runs: 5000,
      warmup: 20,
      parallel: false,
      metrics: ['ops/s', 'p95', 'stddev'],
    },
    langPlugins: ['js'],
    ci: false,
  };
}
