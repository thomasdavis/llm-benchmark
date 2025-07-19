import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';

import type { TestCase, LangPlugin } from '../types/plugin.js';

/**
 * Record test cases by executing functions
 */
export class TestCaseRecorder {
  private recordingDir = '.llmbench/recordings';

  /**
   * Get recording path for a file
   */
  getRecordingPath(sourceFile: string): string {
    const hash = createHash('md5').update(sourceFile).digest('hex').slice(0, 8);
    const name = basename(sourceFile, '.js').replace(/\./g, '_');
    return join(this.recordingDir, `${name}_${hash}.json`);
  }

  /**
   * Load recorded test cases
   */
  async loadRecording(recordingPath: string): Promise<TestCase[]> {
    const content = await readFile(recordingPath, 'utf-8');
    return JSON.parse(content) as TestCase[];
  }

  /**
   * Record test cases by running the function
   */
  async recordCases(sourceFile: string, plugin: LangPlugin): Promise<TestCase[]> {
    const cases: TestCase[] = [];

    // Generate diverse test inputs
    const { signature } = await plugin.extract(sourceFile);

    if (!plugin.generateTestInputs) {
      throw new Error('Plugin does not support test input generation');
    }

    const inputs = await plugin.generateTestInputs(signature, 50);

    // Execute function with each input set
    const module = await import(sourceFile);
    const fn = module.default || module[signature.name];

    if (!fn) {
      throw new Error(`Function ${signature.name} not found in ${sourceFile}`);
    }

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      try {
        const output = await Promise.resolve(fn(...input));
        cases.push({
          id: `recorded_${i}`,
          input,
          output,
        });
      } catch (error) {
        cases.push({
          id: `recorded_${i}`,
          input,
          output: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Save recording
    const recordingPath = this.getRecordingPath(sourceFile);
    await this.saveRecording(recordingPath, cases);

    return cases;
  }

  /**
   * Save recorded cases to file
   */
  private async saveRecording(recordingPath: string, cases: TestCase[]): Promise<void> {
    await mkdir(dirname(recordingPath), { recursive: true });
    await writeFile(recordingPath, JSON.stringify(cases, null, 2), 'utf-8');
  }
}
