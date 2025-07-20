import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';

import yaml from 'js-yaml';

import type { Config } from '../types/config.js';
import type { TestCase } from '../types/plugin.js';

/**
 * Load test cases from various sources
 */
export class TestCaseLoader {
  constructor(private config: Config) {}

  /**
   * Load static test cases from files
   */
  async loadStaticCases(baselineFile: string): Promise<TestCase[]> {
    const testCases: TestCase[] = [];
    const baseDir = dirname(baselineFile);
    const baseName = basename(baselineFile, extname(baselineFile));

    // Look for test case files
    const patterns = [
      this.config.validation.cases,
      join(baseDir, `${baseName}.test.json`),
      join(baseDir, `${baseName}.test.yaml`),
      join(baseDir, `${baseName}.test.yml`),
      join(baseDir, '*.test.json'),
      join(baseDir, '*.test.yaml'),
      join(baseDir, '*.test.yml'),
      join(baseDir, '__tests__', '*.json'),
      join(baseDir, '__tests__', '*.yaml'),
    ].filter(Boolean);

    // Simple implementation - check for test files in the directory
    const files: string[] = [];
    const fs = await import('fs');
    const dirFiles = fs.readdirSync(baseDir);

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Handle wildcards
        const filePattern = pattern.startsWith('/') ? pattern : pattern;
        const searchDir = filePattern.includes('/') ? dirname(filePattern) : baseDir;
        const fileRegex = basename(filePattern);
        const regex = new RegExp('^' + fileRegex.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$');

        if (searchDir === baseDir) {
          const matchingFiles = dirFiles.filter((f) => regex.test(f));
          files.push(...matchingFiles.map((f) => join(baseDir, f)));
        }
      } else if (existsSync(pattern)) {
        files.push(pattern);
      }
    }

    for (const file of files) {
      const cases = await this.loadCaseFile(file);
      testCases.push(...cases);
    }

    if (testCases.length === 0) {
      throw new Error('No test cases found. Please provide test case files.');
    }

    return testCases;
  }

  /**
   * Load cases from a single file
   */
  private async loadCaseFile(filePath: string): Promise<TestCase[]> {
    const content = await readFile(filePath, 'utf-8');
    const ext = filePath.toLowerCase();

    let data: any;
    if (ext.endsWith('.json')) {
      data = JSON.parse(content);
    } else if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
      data = yaml.load(content);
    } else {
      throw new Error(`Unsupported test case format: ${filePath}`);
    }

    // Handle different formats
    if (Array.isArray(data)) {
      return data.map((item, index) => this.normalizeTestCase(item, index));
    } else if (data.cases && Array.isArray(data.cases)) {
      return data.cases.map((item: any, index: number) => this.normalizeTestCase(item, index));
    } else {
      throw new Error(`Invalid test case format in: ${filePath}`);
    }
  }

  /**
   * Normalize test case to standard format
   */
  private normalizeTestCase(item: any, index: number): TestCase {
    // Support multiple formats
    if ('input' in item && 'output' in item) {
      return {
        id: item.id || `case_${index}`,
        input: Array.isArray(item.input) ? item.input : [item.input],
        output: item.output,
        error: item.error,
        metadata: item.metadata,
      };
    } else if ('args' in item && 'result' in item) {
      return {
        id: item.id || `case_${index}`,
        input: Array.isArray(item.args) ? item.args : [item.args],
        output: item.result,
        error: item.error,
        metadata: item.metadata,
      };
    } else if (Array.isArray(item) && item.length >= 2) {
      // [input, output] format
      return {
        id: `case_${index}`,
        input: Array.isArray(item[0]) ? item[0] : [item[0]],
        output: item[1],
      };
    } else {
      throw new Error(`Invalid test case format at index ${index}`);
    }
  }
}
