import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

export interface TestCaseInput {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface TestCaseResult {
  id: string;
  actualOutput: string;
  stderr?: string;
  status: 'IDLE' | 'RUNNING' | 'AC' | 'WA' | 'TLE' | 'RE';
  timeMs: number;
}

export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

export function getEnhancedEnv(): NodeJS.ProcessEnv {
  const extraPaths: string[] = [];
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  // Rust cargo bin
  const cargoBin = path.join(home, '.cargo', 'bin');
  if (fsSync.existsSync(cargoBin)) extraPaths.push(cargoBin);

  // WinLibs mingw64 bin installed via winget
  const wingetPkgs = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fsSync.existsSync(wingetPkgs)) {
    try {
      for (const dir of fsSync.readdirSync(wingetPkgs)) {
        if (dir.toLowerCase().includes('winlibs')) {
          const candidate = path.join(wingetPkgs, dir, 'mingw64', 'bin');
          if (fsSync.existsSync(candidate)) extraPaths.push(candidate);
        }
      }
    } catch {
      // ignore
    }
  }

  const winGetLinks = path.join(localAppData, 'Microsoft', 'WinGet', 'Links');
  if (fsSync.existsSync(winGetLinks)) extraPaths.push(winGetLinks);

  const currentPath = process.env.PATH || process.env.Path || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  return {
    ...process.env,
    PATH: [...extraPaths, currentPath].join(sep),
  };
}

export function resolveGppBinary(): string {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const wingetPkgs = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fsSync.existsSync(wingetPkgs)) {
    try {
      for (const dir of fsSync.readdirSync(wingetPkgs)) {
        if (dir.toLowerCase().includes('winlibs')) {
          const gppExe = path.join(wingetPkgs, dir, 'mingw64', 'bin', 'g++.exe');
          if (fsSync.existsSync(gppExe)) return gppExe;
        }
      }
    } catch {
      // ignore
    }
  }
  return 'g++';
}

export function runProcessWithInput(
  command: string,
  args: string[],
  input: string,
  timeoutMs = 3000,
  cwd?: string
): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; timeMs: number }> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: getEnhancedEnv(),
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore kill error
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const timeMs = Math.round(performance.now() - startTime);
        resolve({
          stdout,
          stderr: stderr ? `${stderr}\n${err.message}` : err.message,
          exitCode: -1,
          timedOut: false,
          timeMs,
        });
      }
    });

    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const timeMs = Math.round(performance.now() - startTime);
        resolve({
          stdout,
          stderr,
          exitCode: code,
          timedOut,
          timeMs,
        });
      }
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

export async function runCpp(
  code: string,
  testCases: TestCaseInput[],
  tempDir: string
): Promise<{ compileError?: string; results: TestCaseResult[] }> {
  await fs.mkdir(tempDir, { recursive: true });
  const sessionId = `cpp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const srcFile = path.join(tempDir, `${sessionId}_main.cpp`);
  const isWin = process.platform === 'win32';
  const outFile = path.join(tempDir, isWin ? `${sessionId}_main.exe` : `${sessionId}_main.out`);

  await fs.writeFile(srcFile, code, 'utf-8');
  const gppCmd = resolveGppBinary();

  try {
    // Compile once: g++ -O2 -std=c++17 main.cpp -o main.out
    const compileRes = await runProcessWithInput(
      gppCmd,
      ['-O2', '-std=c++17', srcFile, '-o', outFile],
      '',
      15000,
      tempDir
    );

    if (compileRes.exitCode !== 0 || compileRes.timedOut) {
      const errText = compileRes.stderr || 'Compilation failed (g++ not found or syntax error).';
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

    // Run each test case sequentially with 3000ms TLE limit
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
  }
}
