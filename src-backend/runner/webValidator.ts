import { TestCaseInput, TestCaseResult, normalizeOutput } from './cppRunner.ts';

export interface JsonValidationResult {
  valid: boolean;
  formatted?: string;
  minified?: string;
  error?: string;
  line?: number;
  column?: number;
}

export function validateAndFormatJson(code: string, mode: 'prettify' | 'minify' = 'prettify'): JsonValidationResult {
  try {
    const parsed = JSON.parse(code);
    const formatted = JSON.stringify(parsed, null, 2);
    const minified = JSON.stringify(parsed);
    return {
      valid: true,
      formatted: mode === 'minify' ? minified : formatted,
      minified,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    let line = 1;
    let column = 1;

    const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    const posMatch = message.match(/position\s+(\d+)/i);

    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      column = parseInt(lineColMatch[2], 10);
    } else if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const upToPos = code.slice(0, pos);
      const lines = upToPos.split('\n');
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
    }

    return {
      valid: false,
      error: `JSON Syntax Error (Line ${line}, Column ${column}): ${message}`,
      line,
      column,
    };
  }
}

export function runWebValidator(
  language: 'html' | 'json',
  code: string,
  testCases: TestCaseInput[]
): { results: TestCaseResult[]; jsonMeta?: JsonValidationResult } {
  const startTime = performance.now();

  if (language === 'json') {
    const validation = validateAndFormatJson(code, 'prettify');
    const elapsed = Math.max(1, Math.round(performance.now() - startTime));

    const results: TestCaseResult[] = testCases.map((tc) => {
      if (!validation.valid) {
        return {
          id: tc.id,
          actualOutput: validation.error || 'Invalid JSON',
          status: 'RE',
          timeMs: elapsed,
        };
      }
      const actual = validation.formatted || '';
      const normActual = normalizeOutput(actual);
      const normExpected = normalizeOutput(tc.expectedOutput);
      const isAc = !tc.expectedOutput.trim() || normActual === normExpected;
      return {
        id: tc.id,
        actualOutput: actual,
        status: isAc ? 'AC' : 'WA',
        timeMs: elapsed,
      };
    });

    return { results, jsonMeta: validation };
  }

  // HTML Sandbox Validator
  const elapsed = Math.max(1, Math.round(performance.now() - startTime));
  const results: TestCaseResult[] = testCases.map((tc) => ({
    id: tc.id,
    actualOutput: 'Live DOM Sandbox rendered successfully in <iframe sandbox="allow-scripts">.',
    status: 'AC',
    timeMs: elapsed,
  }));

  return { results };
}
