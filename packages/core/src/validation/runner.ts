import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';

import type { Config } from '../types/config.js';
import type { LangPlugin, TestCase, Signature } from '../types/plugin.js';
import type { GenerationResult } from '../types/provider.js';
import type { ValidationSummary } from '../types/validation.js';

import { TestCaseLoader } from './test-case-loader.js';
import { TestCaseRecorder } from './test-case-recorder.js';

/**
 * Validation runner for testing variants
 */
export class ValidationRunner {
  private testCaseLoader: TestCaseLoader;
  private testCaseRecorder: TestCaseRecorder;

  constructor(
    private config: Config,
    private plugin: LangPlugin
  ) {
    this.testCaseLoader = new TestCaseLoader(config);
    this.testCaseRecorder = new TestCaseRecorder();
  }

  /**
   * Validate all generated variants
   */
  async validateAll(
    variants: Array<GenerationResult & { provider: string; model: string }>,
    baselineFile: string
  ): Promise<ValidationSummary[]> {
    const results: ValidationSummary[] = [];

    // Load or generate test cases
    const testCases = await this.loadTestCases(baselineFile);

    for (const variant of variants) {
      const variantName = `${variant.provider}.${variant.model}`;
      const summary = await this.validateVariant(
        variant.code,
        variantName,
        testCases
      );
      results.push(summary);
    }

    return results;
  }

  /**
   * Validate variant files
   */
  async validateFiles(
    variantFiles: string[],
    baselineFile: string,
    signature: Signature
  ): Promise<ValidationSummary[]> {
    const results: ValidationSummary[] = [];

    // Load test cases
    const testCases = await this.loadTestCases(baselineFile, signature);

    for (const variantFile of variantFiles) {
      const startTime = Date.now();
      const validation = await this.plugin.validate(testCases, variantFile);
      
      results.push({
        variant: basename(variantFile),
        passed: validation.passed,
        mode: this.config.validation.mode,
        totalCases: testCases.length,
        passedCases: validation.results.filter(r => r.passed).length,
        failedCases: validation.results.filter(r => !r.passed).length,
        results: validation.results.map(r => {
          const testCase = testCases.find(tc => tc.id === r.caseId);
          return {
            caseId: r.caseId,
            passed: r.passed,
            input: testCase?.input || [],
            expected: r.expected || testCase?.output || null,
            actual: r.actual,
            error: r.error,
            duration: 0
          };
        }),
        duration: Date.now() - startTime,
      });
    }

    return results;
  }

  /**
   * Validate a single variant
   */
  private async validateVariant(
    code: string,
    variantName: string,
    testCases: TestCase[]
  ): Promise<ValidationSummary> {
    const startTime = Date.now();
    
    // Write variant to temp file for validation
    const tempFile = join(process.cwd(), '.llmbench', `temp_${variantName}.js`);
    await this.writeVariantFile(tempFile, code);

    try {
      const validation = await this.plugin.validate(testCases, tempFile);
      
      return {
        variant: variantName,
        passed: validation.passed,
        mode: this.config.validation.mode,
        totalCases: testCases.length,
        passedCases: validation.results.filter(r => r.passed).length,
        failedCases: validation.results.filter(r => !r.passed).length,
        results: validation.results.map(r => {
          const testCase = testCases.find(tc => tc.id === r.caseId);
          return {
            caseId: r.caseId,
            passed: r.passed,
            input: testCase?.input || [],
            expected: r.expected || testCase?.output || null,
            actual: r.actual,
            error: r.error,
            duration: 0
          };
        }),
        duration: Date.now() - startTime,
      };
    } finally {
      // Clean up temp file
      // await unlink(tempFile).catch(() => {});
    }
  }

  /**
   * Load test cases based on configuration
   */
  private async loadTestCases(
    baselineFile: string,
    signature?: Signature
  ): Promise<TestCase[]> {
    switch (this.config.validation.mode) {
      case 'static':
        return this.testCaseLoader.loadStaticCases(baselineFile);
      
      case 'record-replay':
        // Check for existing recordings
        const recordingPath = this.testCaseRecorder.getRecordingPath(baselineFile);
        if (existsSync(recordingPath)) {
          return this.testCaseRecorder.loadRecording(recordingPath);
        } else if (this.config.validation.recordingEnabled) {
          // Record new cases
          return this.testCaseRecorder.recordCases(baselineFile, this.plugin);
        } else {
          throw new Error('No test cases found. Enable recording or provide static cases.');
        }
      
      case 'property-based':
        if (!signature) {
          throw new Error('Signature required for property-based testing');
        }
        if (!this.plugin.generateTestInputs) {
          throw new Error('Plugin does not support property-based testing');
        }
        
        // Generate test inputs
        const inputs = await this.plugin.generateTestInputs(signature, 100);
        const cases: TestCase[] = [];
        
        // Run baseline to get expected outputs
        for (let i = 0; i < inputs.length; i++) {
          const input = inputs[i];
          // Would need to execute baseline here
          cases.push({
            id: `prop_${i}`,
            input,
            output: null, // Placeholder
          });
        }
        
        return cases;
      
      default:
        throw new Error(`Unknown validation mode: ${this.config.validation.mode}`);
    }
  }

  /**
   * Write variant code to file
   */
  private async writeVariantFile(filePath: string, code: string): Promise<void> {
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, code, 'utf-8');
  }
}