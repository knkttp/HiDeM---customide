import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import {
  TestCaseInput,
  TestCaseResult,
  normalizeOutput,
  runProcessWithInput,
} from './cppRunner.ts';

async function resolvePythonCommand(): Promise<string> {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const programsPyDir = path.join(localAppData, 'Programs', 'Python');
  if (fsSync.existsSync(programsPyDir)) {
    try {
      for (const dir of fsSync.readdirSync(programsPyDir)) {
        const candidate = path.join(programsPyDir, dir, 'python.exe');
        if (fsSync.existsSync(candidate)) return candidate;
      }
    } catch {
      // ignore
    }
  }

  const checkPy = await runProcessWithInput('python', ['--version'], '', 2000);
  if (checkPy.exitCode === 0 && (checkPy.stdout + checkPy.stderr).toLowerCase().includes('python')) {
    return 'python';
  }
  return 'python3';
}

export async function runPython(
  code: string,
  testCases: TestCaseInput[],
  tempDir: string
): Promise<{ compileError?: string; results: TestCaseResult[] }> {
  await fs.mkdir(tempDir, { recursive: true });
  const sessionId = `py_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const srcFile = path.join(tempDir, `${sessionId}_main.py`);

  await fs.writeFile(srcFile, code, 'utf-8');
  const pyCmd = await resolvePythonCommand();

  try {
    const results: TestCaseResult[] = [];
    for (const tc of testCases) {
      // python3 -u main.py
      const execRes = await runProcessWithInput(pyCmd, ['-u', srcFile], tc.input, 3000, tempDir);
      if (execRes.timedOut) {
        results.push({
          id: tc.id,
          actualOutput: 'Time Limit Exceeded (> 3000ms)\n' + execRes.stdout,
          stderr: execRes.stderr,
          status: 'TLE',
          timeMs: 3000,
        });
      } else if (execRes.exitCode !== 0) {
        results.push({
          id: tc.id,
          actualOutput: execRes.stderr || execRes.stdout || `Runtime Error (Exit code ${execRes.exitCode})`,
          stderr: execRes.stderr,
          status: 'RE',
          timeMs: execRes.timeMs,
        });
      } else {
        const normActual = normalizeOutput(execRes.stdout);
        const normExpected = normalizeOutput(tc.expectedOutput);
        const isAc = normActual === normExpected;
        results.push({
          id: tc.id,
          actualOutput: execRes.stdout,
          stderr: execRes.stderr,
          status: isAc ? 'AC' : 'WA',
          timeMs: execRes.timeMs,
        });
      }
    }

    return { results };
  } finally {
    await fs.unlink(srcFile).catch(() => {});
  }
}
