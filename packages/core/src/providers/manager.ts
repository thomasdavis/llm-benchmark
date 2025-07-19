import pLimit from 'p-limit';

import type { Config } from '../types/config.js';
import type { Signature } from '../types/plugin.js';
import type { ProviderAdapter, GenerationResult } from '../types/provider.js';

/**
 * Provider manager for LLM adapters
 */
export class ProviderManager {
  private providers: Map<string, ProviderAdapter> = new Map();
  private limit: ReturnType<typeof pLimit>;

  constructor(private config: Config) {
    // Limit concurrent API calls
    this.limit = pLimit(3);
  }

  /**
   * Initialize configured providers
   */
  async initialize(): Promise<void> {
    for (const providerSpec of this.config.providers) {
      const [providerId, model] = providerSpec.split(':');
      
      try {
        const provider = await this.loadProvider(providerId);
        await provider.initialize({
          apiKey: process.env[`${providerId.toUpperCase()}_API_KEY`],
          apiBase: process.env[`${providerId.toUpperCase()}_API_BASE`],
          organization: process.env[`${providerId.toUpperCase()}_ORGANIZATION`],
        });
        
        this.providers.set(providerSpec, provider);
      } catch (error) {
        console.warn(`Failed to load provider ${providerSpec}:`, error);
      }
    }

    if (this.providers.size === 0) {
      throw new Error('No providers loaded');
    }
  }

  /**
   * Load a provider by ID
   */
  private async loadProvider(providerId: string): Promise<ProviderAdapter> {
    // Try built-in providers first
    const builtinPath = `./built-in/${providerId}.js`;
    try {
      const module = await import(builtinPath);
      return module.default || module;
    } catch {
      // Try external package
      const packageName = `@llm-benchmark/adapter-${providerId}`;
      try {
        const module = await import(packageName);
        return module.default || module;
      } catch (error) {
        throw new Error(`Provider not found: ${providerId}`);
      }
    }
  }

  /**
   * Generate variants from all configured providers
   */
  async generateAllVariants(params: {
    code: string;
    signature: Signature;
    language: string;
    onProgress?: (provider: string, status: string) => void;
  }): Promise<Array<GenerationResult & { provider: string; model: string }>>{
    const results: Array<GenerationResult & { provider: string; model: string }> = [];

    const tasks = Array.from(this.providers.entries()).map(([spec, provider]) => {
      const [providerId, model] = spec.split(':');
      
      return this.limit(async () => {
        try {
          params.onProgress?.(spec, 'generating');
          
          const result = await provider.generateVariant({
            systemPrompt: this.buildSystemPrompt(params.language),
            userPrompt: this.buildUserPrompt(params.code, params.signature),
            code: params.code,
            model,
            config: this.config.models?.[spec],
          });

          params.onProgress?.(spec, 'completed');
          
          return {
            ...result,
            provider: providerId,
            model,
          };
        } catch (error) {
          params.onProgress?.(spec, 'failed');
          throw error;
        }
      });
    });

    const settled = await Promise.allSettled(tasks);
    
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.warn('Provider generation failed:', result.reason);
      }
    }

    return results;
  }

  /**
   * Build system prompt for code optimization
   */
  private buildSystemPrompt(language: string): string {
    const basePrompt = this.config.basePrompt || `You are a world-class performance engineer specializing in ${language} optimization.

Your task is to optimize the given function for maximum performance while maintaining exact functional equivalence.

Guidelines:
1. The optimized code MUST produce identical outputs for all inputs
2. Focus on algorithmic improvements, not micro-optimizations
3. Preserve the exact function signature
4. Return ONLY the optimized function code, no explanations
5. Ensure the code is syntactically valid and complete`;

    return basePrompt;
  }

  /**
   * Build user prompt with the code
   */
  private buildUserPrompt(code: string, signature: Signature): string {
    return `Optimize this ${signature.name} function for performance:

\`\`\`
${code}
\`\`\`

Return only the optimized function code.`;
  }

  /**
   * Get all loaded providers
   */
  async getProviders(): Promise<ProviderAdapter[]> {
    return Array.from(this.providers.values());
  }
}