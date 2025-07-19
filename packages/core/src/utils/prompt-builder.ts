import type { Config } from '../types/config.js';
import type { Signature } from '../types/plugin.js';

/**
 * Build prompts for LLM providers
 */
export class PromptBuilder {
  constructor(private config: Config) {}

  /**
   * Build system and user prompts
   */
  build(params: { code: string; signature: Signature; language: string; provider: string }): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt = this.buildSystemPrompt(params.language, params.provider);
    const userPrompt = this.buildUserPrompt(params.code, params.signature, params.language);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(language: string, provider: string): string {
    // Check for provider-specific override
    const modelConfig = this.config.models?.[provider];
    if (modelConfig?.systemPrompt) {
      return modelConfig.systemPrompt;
    }

    // Use base prompt or default
    const basePrompt = this.config.basePrompt || this.getDefaultSystemPrompt(language);

    return basePrompt.replace(/\{language\}/g, language);
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(code: string, signature: Signature, language: string): string {
    const langName = this.getLanguageName(language);

    return `Optimize this ${langName} function for maximum performance:

Function: ${signature.name}
${
  signature.params.length > 0
    ? `Parameters: ${signature.params.map((p) => p.name).join(', ')}`
    : 'No parameters'
}
${signature.async ? 'Type: Async function' : 'Type: Sync function'}

\`\`\`${language}
${code}
\`\`\`

Requirements:
1. Maintain EXACT functional behavior - all inputs must produce identical outputs
2. Preserve the function signature exactly as shown
3. Focus on algorithmic optimizations, not micro-optimizations
4. The code must be production-ready and handle edge cases
5. Return ONLY the optimized function code, no explanations

Optimized code:`;
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(language: string): string {
    return `You are an expert ${language} performance engineer with deep knowledge of:
- Algorithm optimization and computational complexity
- Data structure selection and memory efficiency  
- Language-specific performance patterns and best practices
- Common bottlenecks and optimization techniques

Your goal is to optimize code for maximum performance while maintaining 100% functional equivalence.

Key principles:
1. Correctness is paramount - optimized code must behave identically to the original
2. Focus on algorithmic improvements (O(n²) → O(n log n)) over micro-optimizations
3. Consider memory usage and cache efficiency
4. Ensure code remains readable and maintainable
5. Handle all edge cases that the original code handles

You will receive a function to optimize. Analyze it carefully and return ONLY the optimized version of the function.`;
  }

  /**
   * Get human-readable language name
   */
  private getLanguageName(languageId: string): string {
    const names: Record<string, string> = {
      js: 'JavaScript',
      ts: 'TypeScript',
      py: 'Python',
      rust: 'Rust',
      go: 'Go',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      rb: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kotlin: 'Kotlin',
      scala: 'Scala',
      hs: 'Haskell',
      ml: 'OCaml',
      clj: 'Clojure',
      ex: 'Elixir',
      jl: 'Julia',
      r: 'R',
      matlab: 'MATLAB',
      dart: 'Dart',
      zig: 'Zig',
    };

    return names[languageId] || languageId.toUpperCase();
  }
}
