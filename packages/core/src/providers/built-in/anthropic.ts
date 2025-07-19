import type { ModelConfig } from '../../types/config.js';
import type { ProviderAdapter, GenerationResult } from '../../types/provider.js';

/**
 * Anthropic Claude provider adapter
 */
export const anthropicProvider: ProviderAdapter = {
  id: 'anthropic',
  name: 'Anthropic',
  models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1'],

  async initialize(config: { apiKey?: string; apiBase?: string }): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    // Store config for later use
    this._config = config;
  },

  async generateVariant(params: {
    systemPrompt: string;
    userPrompt: string;
    code: string;
    model: string;
    config?: ModelConfig;
  }): Promise<GenerationResult> {
    const startTime = Date.now();
    const apiConfig = this._config;

    const response = await fetch(
      `${apiConfig.apiBase || 'https://api.anthropic.com'}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiConfig.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: params.model,
          system: params.systemPrompt,
          messages: [
            {
              role: 'user',
              content: params.userPrompt,
            },
          ],
          temperature: params.config?.temperature ?? 0.2,
          max_tokens: params.config?.maxTokens ?? 4096,
          top_p: params.config?.topP ?? 1,
          stop_sequences: params.config?.stopSequences,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as any;
    const latencyMs = Date.now() - startTime;

    // Extract code from response
    const content = data.content[0].text;
    const code = this.extractCode(content);

    // Calculate tokens (Anthropic uses different structure)
    const promptTokens = this.estimateTokens(params.systemPrompt + params.userPrompt);
    const completionTokens = this.estimateTokens(content);

    return {
      code,
      meta: {
        promptTokens,
        completionTokens,
        latencyMs,
        costUsd: this.calculateCost(promptTokens, completionTokens, params.model),
        model: params.model,
        provider: this.id,
      },
    };
  },

  estimateCost(params: { promptTokens: number; model: string }): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'claude-3-opus': { prompt: 0.015, completion: 0.075 },
      'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
      'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
      'claude-2.1': { prompt: 0.008, completion: 0.024 },
    };

    const modelPricing = pricing[params.model] || pricing['claude-3-sonnet'];
    return (params.promptTokens / 1000) * modelPricing.prompt;
  },

  async isAvailable(): Promise<boolean> {
    try {
      const apiConfig = this._config;
      const response = await fetch(
        `${apiConfig.apiBase || 'https://api.anthropic.com'}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'x-api-key': apiConfig.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1,
          }),
        },
      );
      return response.status !== 401;
    } catch {
      return false;
    }
  },

  extractCode(content: string): string {
    // Try to extract code from markdown code blocks
    const codeBlockMatch = content.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // If no code block, assume the entire response is code
    return content.trim();
  },

  estimateTokens(text: string): number {
    // Claude uses a similar tokenization to GPT models
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  },

  calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'claude-3-opus': { prompt: 0.015, completion: 0.075 },
      'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
      'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
      'claude-2.1': { prompt: 0.008, completion: 0.024 },
    };

    const modelPricing = pricing[model] || pricing['claude-3-sonnet'];

    return (
      (promptTokens / 1000) * modelPricing.prompt +
      (completionTokens / 1000) * modelPricing.completion
    );
  },
};

export default anthropicProvider;
