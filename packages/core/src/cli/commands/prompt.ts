import { existsSync } from 'fs';
import { resolve } from 'path';

import boxen from 'boxen';
import chalk from 'chalk';

import { loadConfig } from '../../config/loader.js';
import { PluginManager } from '../../plugins/manager.js';
import { ProviderManager } from '../../providers/manager.js';
import { PromptBuilder } from '../../utils/prompt-builder.js';

/**
 * Preview the prompt that will be sent to each provider
 */
export async function promptCommand(
  file: string,
  targetFunction: string | undefined,
  options: any
): Promise<void> {
  const filePath = resolve(file);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    // Load configuration
    const config = await loadConfig(options.config, options);
    
    // Initialize managers
    const pluginManager = new PluginManager(config);
    const providerManager = new ProviderManager(config);
    
    await pluginManager.initialize();
    await providerManager.initialize();

    // Detect language plugin
    const plugin = await pluginManager.detectPlugin(filePath);
    if (!plugin) {
      throw new Error(`No language plugin found for file: ${filePath}`);
    }

    // Extract function
    const extraction = await plugin.extract(filePath, targetFunction);

    // Build prompts for each provider
    const promptBuilder = new PromptBuilder(config);
    const providers = await providerManager.getProviders();

    console.log(chalk.green('\n📝 Prompt Preview'));
    console.log(chalk.dim('─'.repeat(80)));
    console.log(`Function: ${chalk.cyan(extraction.signature.name)}`);
    console.log(`Language: ${chalk.cyan(plugin.id)}`);
    console.log(chalk.dim('─'.repeat(80)));

    for (const provider of providers) {
      const { systemPrompt, userPrompt } = promptBuilder.build({
        code: extraction.code,
        signature: extraction.signature,
        language: plugin.id,
        provider: provider.id,
      });

      const promptBox = boxen(
        [
          chalk.bold(`Provider: ${provider.name}`),
          chalk.dim('─'.repeat(60)),
          '',
          chalk.yellow('System Prompt:'),
          systemPrompt,
          '',
          chalk.yellow('User Prompt:'),
          userPrompt,
          '',
          chalk.dim('─'.repeat(60)),
          chalk.dim(`Estimated tokens: ~${estimateTokens(systemPrompt + userPrompt)}`),
          chalk.dim(`Estimated cost: ~$${provider.estimateCost({ 
            promptTokens: estimateTokens(systemPrompt + userPrompt), 
            model: provider.models[0] 
          }).toFixed(4)}`),
        ].join('\n'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'blue',
        }
      );

      console.log(promptBox);
    }

    console.log(chalk.cyan('\n💡 Tips:'));
    console.log('  - Adjust prompts in your config file under "basePrompt" or model-specific overrides');
    console.log('  - Use --providers flag to preview specific providers only');
    console.log('  - Token estimates are approximate and may vary by model');
  } catch (error) {
    throw error;
  }
}

/**
 * Rough token estimation (4 chars ≈ 1 token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}