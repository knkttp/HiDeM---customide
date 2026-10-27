import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  TestCaseInput,
  TestCaseResult,
  normalizeOutput,
  runProcessWithInput,
} from './cppRunner.ts';

let CACHED_RUSTC: string | null = null;

function resolveRustcBinary(): string {
  if (CACHED_RUSTC) return CACHED_RUSTC;
  const cargoRustc = path.join(os.homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'rustc.exe' : 'rustc');
  if (fsSync.existsSync(cargoRustc)) {
    CACHED_RUSTC = cargoRustc;
    return CACHED_RUSTC;
  }
  CACHED_RUSTC = 'rustc';
  return CACHED_RUSTC;
}

export async function runRust(
  code: string,
  testCases: TestCaseInput[],
  tempDir: string
): Promise<{ compileError?: string; results: TestCaseResult[] }> {
  const binCacheDir = path.join(tempDir, 'bin_cache');
  await fs.mkdir(binCacheDir, { recursive: true });

  const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 24);
  const isWin = process.platform === 'win32';
  const outFile = path.join(binCacheDir, isWin ? `rs_${hash}.exe` : `rs_${hash}.out`);
  const rustcCmd = resolveRustcBinary();

  if (!fsSync.existsSync(outFile)) {
    const srcFile = path.join(tempDir, `rs_${hash}.rs`);
    await fs.writeFile(srcFile, code, 'utf-8');

    const compileRes = await runProcessWithInput(
      rustcCmd,
      ['-O', '-C', 'debuginfo=0', srcFile, '-o', outFile],
      '',
      15000,
      tempDir
    );
    await fs.unlink(srcFile).catch(() => {});
    const pdbFile = outFile.replace(/\.exe$/, '.pdb');
    await fs.unlink(pdbFile).catch(() => {});

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
  }

  const results = await Promise.all(
    testCases.map(async (tc): Promise<TestCaseResult> => {
      const execRes = await runProcessWithInput(outFile, [], tc.input, 3000, tempDir);
      if (execRes.timedOut) {
        return {
          id: tc.id,
          actualOutput: 'Time Limit Exceeded (> 3000ms)\n' + execRes.stdout,
          stderr: execRes.stderr,
          status: 'TLE',
          timeMs: 3000,
        };
      }
      if (execRes.exitCode !== 0) {
        return {
          id: tc.id,
          actualOutput: execRes.stderr || execRes.stdout || `Runtime Error (Exit code ${execRes.exitCode})`,
          stderr: execRes.stderr,
          status: 'RE',
          timeMs: execRes.timeMs,
        };
      }
      const normActual = normalizeOutput(execRes.stdout);
      const normExpected = normalizeOutput(tc.expectedOutput);
      const isAc = normActual === normExpected;
      return {
        id: tc.id,
        actualOutput: execRes.stdout,
        stderr: execRes.stderr,
        status: isAc ? 'AC' : 'WA',
        timeMs: execRes.timeMs,
      };
    })
  );

  return { results };
}
