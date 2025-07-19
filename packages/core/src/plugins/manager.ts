import { resolve, extname } from 'path';

import type { Config } from '../types/config.js';
import type { LangPlugin } from '../types/plugin.js';

/**
 * Plugin manager for language adapters
 */
export class PluginManager {
  private plugins: Map<string, LangPlugin> = new Map();
  private extensionMap: Map<string, LangPlugin> = new Map();

  constructor(private config: Config) {}

  /**
   * Initialize configured plugins
   */
  async initialize(): Promise<void> {
    for (const pluginId of this.config.langPlugins) {
      try {
        const plugin = await this.loadPlugin(pluginId);
        this.plugins.set(pluginId, plugin);

        // Map extensions to plugins
        for (const ext of plugin.extensions) {
          this.extensionMap.set(ext, plugin);
        }
      } catch (error) {
        console.warn(`Failed to load plugin ${pluginId}:`, error);
      }
    }

    if (this.plugins.size === 0) {
      throw new Error('No language plugins loaded');
    }
  }

  /**
   * Load a plugin by ID
   */
  private async loadPlugin(pluginId: string): Promise<LangPlugin> {
    // Try built-in plugins first
    const builtinPath = `./built-in/${pluginId}.js`;
    try {
      const module = await import(builtinPath);
      return module.default || module;
    } catch {
      // Try external package
      const packageName = `@llm-benchmark/plugin-${pluginId}`;
      try {
        const module = await import(packageName);
        return module.default || module;
      } catch (error) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }
    }
  }

  /**
   * Detect plugin for a file
   */
  async detectPlugin(filePath: string): Promise<LangPlugin | null> {
    const ext = extname(filePath).toLowerCase();

    // Check extension map
    const plugin = this.extensionMap.get(ext);
    if (plugin) {
      const canHandle = await plugin.detect(filePath);
      if (canHandle) return plugin;
    }

    // Try all plugins
    for (const plugin of this.plugins.values()) {
      const canHandle = await plugin.detect(filePath);
      if (canHandle) return plugin;
    }

    return null;
  }

  /**
   * Get plugin by ID
   */
  getPlugin(id: string): LangPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): LangPlugin[] {
    return Array.from(this.plugins.values());
  }
}
