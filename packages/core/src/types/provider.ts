import type { ModelConfig } from './config.js';

/**
 * Provider generation result
 */
export interface GenerationResult {
  code: string;
  meta: {
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
    costUsd: number;
    model: string;
    provider: string;
  };
}

/**
 * Provider adapter interface
 */
export interface ProviderAdapter {
  /**
   * Unique identifier for the provider
   */
  id: string;

  /**
   * Display name for the provider
   */
  name: string;

  /**
   * Available models for this provider
   */
  models: string[];

  /**
   * Initialize the provider with API credentials
   */
  initialize(config: {
    apiKey?: string;
    apiBase?: string;
    organization?: string;
    [key: string]: unknown;
  }): Promise<void>;

  /**
   * Generate a code variant
   */
  generateVariant(params: {
    systemPrompt: string;
    userPrompt: string;
    code: string;
    model: string;
    config?: ModelConfig;
  }): Promise<GenerationResult>;

  /**
   * Estimate cost for a prompt
   */
  estimateCost(params: {
    promptTokens: number;
    model: string;
  }): number;

  /**
   * Check if the provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Extract code from response
   */
  extractCode?(content: string): string;

  /**
   * Calculate cost based on usage
   */
  calculateCost?(promptTokens: number, completionTokens: number, model: string): number;

  /**
   * Estimate tokens
   */
  estimateTokens?(text: string): number;
}