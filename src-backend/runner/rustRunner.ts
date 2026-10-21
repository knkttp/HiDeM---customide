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

function resolveRustcBinary(): string {
  const cargoRustc = path.join(os.homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'rustc.exe' : 'rustc');
  if (fsSync.existsSync(cargoRustc)) return cargoRustc;
  return 'rustc';
}

export async function runRust(
  code: string,
  testCases: TestCaseInput[],
  tempDir: string
): Promise<{ compileError?: string; results: TestCaseResult[] }> {
  await fs.mkdir(tempDir, { recursive: true });
  const sessionId = `rs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const srcFile = path.join(tempDir, `${sessionId}_main.rs`);
  const isWin = process.platform === 'win32';
  const outFile = path.join(tempDir, isWin ? `${sessionId}_main_rs.exe` : `${sessionId}_main_rs.out`);

  await fs.writeFile(srcFile, code, 'utf-8');
  const rustcCmd = resolveRustcBinary();

  try {
    // Compile once: rustc -O main.rs -o main_rs.out
    const compileRes = await runProcessWithInput(
      rustcCmd,
      ['-O', srcFile, '-o', outFile],
      '',
      15000,
      tempDir
    );

    if (compileRes.exitCode !== 0 || compileRes.timedOut) {
      const errText = compileRes.stderr || 'Compilation failed (rustc not found or syntax error).';
      return {
        compileError: errText,
        results: testCases.map((tc) => ({
          id: tc.id,
          actualOutput: errText,
          stderr: errText,
          status: 'RE',
          timeMs: compileRes.timeMs,
        })),
      };
    }

    const results: TestCaseResult[] = [];
    for (const tc of testCases) {
      const execRes = await runProcessWithInput(outFile, [], tc.input, 3000, tempDir);
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
    await fs.unlink(outFile).catch(() => {});
    const pdbFile = outFile.replace(/\.exe$/, '.pdb');
    await fs.unlink(pdbFile).catch(() => {});
  }
}
