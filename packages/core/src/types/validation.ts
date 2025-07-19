/**
 * Validation mode types
 */
export type ValidationMode = 'record-replay' | 'property-based' | 'static';

/**
 * Validation result for a single test case
 */
export interface ValidationResult {
  caseId: string;
  passed: boolean;
  input: unknown[];
  expected: unknown;
  actual?: unknown;
  error?: string;
  duration?: number;
}

/**
 * Overall validation summary
 */
export interface ValidationSummary {
  variant: string;
  passed: boolean;
  mode: ValidationMode;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  results: ValidationResult[];
  duration: number;
}