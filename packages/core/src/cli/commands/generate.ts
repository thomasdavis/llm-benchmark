import { existsSync } from 'fs';
import { resolve } from 'path';

import chalk from 'chalk';
import ora from 'ora';

import { loadConfig } from '../../config/loader.js';
import { PluginManager } from '../../plugins/manager.js';
import { ProviderManager } from '../../providers/manager.js';
import { VariantWriter } from '../../utils/variant-writer.js';

/**
 * Generate optimized variants without validation or benchmarking
 */
export async function generateCommand(
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

    // Initialize managers
    const pluginManager = new PluginManager(config);
    const providerManager = new ProviderManager(config);

    await pluginManager.initialize();
    await providerManager.initialize();

    spinner.succeed('Configuration loaded');

    // Detect language plugin
    const plugin = await pluginManager.detectPlugin(filePath);
    if (!plugin) {
      throw new Error(`No language plugin found for file: ${filePath}`);
    }

    // Extract function
    spinner.start('Extracting function...');
    const extraction = await plugin.extract(filePath, targetFunction);
    spinner.succeed(`Extracted function: ${extraction.signature.name}`);

    // Generate variants
    spinner.start('Generating variants...');
    const variants = await providerManager.generateAllVariants({
      code: extraction.code,
      signature: extraction.signature,
      language: plugin.id,
      onProgress: (provider, status) => {
        spinner.text = `Generating variants... [${provider}] ${status}`;
      },
    });

    spinner.succeed(`Generated ${variants.length} variants`);

    // Write variant files
    spinner.start('Writing variant files...');
    const writer = new VariantWriter(plugin);
    const writtenFiles: string[] = [];

    for (const variant of variants) {
      const formattedCode = await plugin.format(variant.code);
      const outputPath = writer.getVariantPath(filePath, variant.provider, variant.model);

      if (existsSync(outputPath) && !options.overwrite) {
        spinner.warn(`Skipping existing file: ${outputPath}`);
        continue;
      }

      await writer.write(outputPath, formattedCode, variant.meta);
      writtenFiles.push(outputPath);
    }

    spinner.succeed(`Written ${writtenFiles.length} variant files`);

    // Print summary
    console.log(chalk.green('\n✅ Generation Complete!'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(`Total variants: ${variants.length}`);
    console.log(`Files written: ${writtenFiles.length}`);
    console.log(
      `Total cost: ${chalk.yellow(
        `$${variants.reduce((sum, v) => sum + v.meta.costUsd, 0).toFixed(4)}`,
      )}`,
    );

    if (writtenFiles.length > 0) {
      console.log('\nGenerated files:');
      writtenFiles.forEach((file) => {
        console.log(chalk.dim(`  - ${file}`));
      });
    }

    console.log(chalk.cyan('\n💡 Next steps:'));
    console.log(`  1. Review generated variants`);
    console.log(`  2. Run ${chalk.bold('llm-benchmark validate')} to validate variants`);
    console.log(`  3. Run ${chalk.bold('llm-benchmark bench')} to benchmark valid variants`);
  } catch (error) {
    spinner.fail('Generation failed');
    throw error;
  }
}
