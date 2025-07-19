import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderManager } from '../providers/manager.js';
import openaiProvider from '../providers/built-in/openai.js';
import type { Config } from '../types/config.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Provider System', () => {
  let providerManager: ProviderManager;
  let config: Config;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      providers: ['openai:gpt-4o'],
      validation: { mode: 'static' },
      bench: { runs: 100, warmup: 10, parallel: false, metrics: ['ops/s'] },
      langPlugins: ['js'],
      ci: false,
    };
    process.env.OPENAI_API_KEY = 'test-key';
    providerManager = new ProviderManager(config);
  });

  describe('ProviderManager', () => {
    it('should initialize with configured providers', async () => {
      await providerManager.initialize();
      const providers = await providerManager.getProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('openai');
    });

    it('should generate variants from all providers', async () => {
      await providerManager.initialize();

      // Mock successful API response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```javascript\nfunction optimized() { return 42; }\n```',
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
          },
        }),
      } as any);

      const results = await providerManager.generateAllVariants({
        code: 'function test() { return 1; }',
        signature: {
          name: 'test',
          params: [],
          async: false,
        },
        language: 'js',
      });

      expect(results).toHaveLength(1);
      expect(results[0].code).toContain('function optimized');
      expect(results[0].meta.promptTokens).toBe(100);
      expect(results[0].meta.completionTokens).toBe(50);
    });
  });

  describe('OpenAI Provider', () => {
    it('should initialize with API key', async () => {
      await expect(openaiProvider.initialize({ apiKey: 'test-key' })).resolves.not.toThrow();
    });

    it('should throw without API key', async () => {
      await expect(openaiProvider.initialize({})).rejects.toThrow('OpenAI API key is required');
    });

    it('should generate variant', async () => {
      await openaiProvider.initialize({ apiKey: 'test-key' });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'function optimized() { return 42; }',
              },
            },
          ],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 75,
          },
        }),
      } as any);

      const result = await openaiProvider.generateVariant({
        systemPrompt: 'You are an optimizer',
        userPrompt: 'Optimize this function',
        code: 'function test() { return 1; }',
        model: 'gpt-4o',
      });

      expect(result.code).toBe('function optimized() { return 42; }');
      expect(result.meta.promptTokens).toBe(150);
      expect(result.meta.completionTokens).toBe(75);
      expect(result.meta.costUsd).toBeGreaterThan(0);
    });

    it('should extract code from markdown blocks', async () => {
      await openaiProvider.initialize({ apiKey: 'test-key' });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  'Here is the optimized code:\n\n```javascript\nfunction fast() { return 100; }\n```\n\nThis is faster.',
              },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      } as any);

      const result = await openaiProvider.generateVariant({
        systemPrompt: 'test',
        userPrompt: 'test',
        code: 'test',
        model: 'gpt-4o',
      });

      expect(result.code).toBe('function fast() { return 100; }');
    });

    it('should estimate cost', () => {
      const cost = openaiProvider.estimateCost({
        promptTokens: 1000,
        model: 'gpt-4o',
      });

      expect(cost).toBe(0.005); // $0.005 per 1K tokens
    });

    it('should check availability', async () => {
      await openaiProvider.initialize({ apiKey: 'test-key' });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
      } as any);

      const available = await openaiProvider.isAvailable();
      expect(available).toBe(true);
    });
  });
});
