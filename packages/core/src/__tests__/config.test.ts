import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConfig, getDefaultConfig } from '../config/loader.js';
import { ConfigSchema } from '../types/config.js';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('Config Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {};
  });

  describe('loadConfig', () => {
    it('should load default config when no file exists', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = await loadConfig('llm-benchmark.json', {});
      
      expect(config.providers).toEqual(['openai:gpt-4o']);
      expect(config.validation.mode).toBe('record-replay');
      expect(config.bench.runs).toBe(5000);
    });

    it('should load JSON config file', async () => {
      const fs = await import('fs');
      const fsPromises = await import('fs/promises');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify({
        providers: ['openai:gpt-4o', 'anthropic:claude-3'],
        validation: { mode: 'static' },
        bench: { runs: 10000 },
        langPlugins: ['js', 'py'],
      }));

      const config = await loadConfig('config.json', {});
      
      expect(config.providers).toEqual(['openai:gpt-4o', 'anthropic:claude-3']);
      expect(config.validation.mode).toBe('static');
      expect(config.bench.runs).toBe(10000);
    });

    it('should override config with CLI options', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = await loadConfig('llm-benchmark.json', {
        providers: ['anthropic:claude-3'],
        runs: 1000,
        ci: true,
      });
      
      expect(config.providers).toEqual(['anthropic:claude-3']);
      expect(config.bench.runs).toBe(1000);
      expect(config.ci).toBe(true);
    });

    it('should validate environment variables', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      process.env.OPENAI_API_KEY = 'test-key';

      const config = await loadConfig('llm-benchmark.json', {});
      expect(config).toBeDefined();
    });

    it('should throw on missing environment variables', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await expect(loadConfig('llm-benchmark.json', {}))
        .rejects.toThrow('Missing required environment variables');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default config', () => {
      const config = getDefaultConfig();
      const result = ConfigSchema.safeParse(config);
      
      expect(result.success).toBe(true);
      expect(config.providers).toEqual(['openai:gpt-4o']);
      expect(config.langPlugins).toEqual(['js']);
    });
  });
});