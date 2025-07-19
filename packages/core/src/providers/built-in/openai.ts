import type { ModelConfig } from '../../types/config.js';
import type { ProviderAdapter, GenerationResult } from '../../types/provider.js';

/**
 * OpenAI provider adapter
 */
export const openaiProvider: ProviderAdapter = {
  id: 'openai',
  name: 'OpenAI',
  models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],

  async initialize(config: {
    apiKey?: string;
    apiBase?: string;
    organization?: string;
  }): Promise<void> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
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
      `${apiConfig.apiBase || 'https://api.openai.com'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
          ...(apiConfig.organization && { 'OpenAI-Organization': apiConfig.organization }),
        },
        body: JSON.stringify({
          model: params.model,
          messages: [
            { role: 'system', content: params.systemPrompt },
            { role: 'user', content: params.userPrompt },
          ],
          temperature: params.config?.temperature ?? 0.2,
          max_tokens: params.config?.maxTokens ?? 4096,
          top_p: params.config?.topP ?? 1,
          frequency_penalty: params.config?.frequencyPenalty ?? 0,
          presence_penalty: params.config?.presencePenalty ?? 0,
          stop: params.config?.stopSequences,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as any;
    const latencyMs = Date.now() - startTime;

    // Extract code from response
    const content = data.choices[0].message.content;
    const code = this.extractCode(content);

    return {
      code,
      meta: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        latencyMs,
        costUsd: this.calculateCost(
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          params.model,
        ),
        model: params.model,
        provider: this.id,
      },
    };
  },

  estimateCost(params: { promptTokens: number; model: string }): number {
    // Rough estimates based on OpenAI pricing
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4o': { prompt: 0.005, completion: 0.015 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
    };

    const modelPricing = pricing[params.model] || pricing['gpt-4'];
    return (params.promptTokens / 1000) * modelPricing.prompt;
  },

  async isAvailable(): Promise<boolean> {
    try {
      const apiConfig = this._config;
      const response = await fetch(`${apiConfig.apiBase || 'https://api.openai.com'}/v1/models`, {
        headers: {
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
      });
      return response.ok;
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

  calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4o': { prompt: 0.005, completion: 0.015 },
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4'];

    return (
      (promptTokens / 1000) * modelPricing.prompt +
      (completionTokens / 1000) * modelPricing.completion
    );
  },
};

export default openaiProvider;
