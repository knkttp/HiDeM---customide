import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

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

let CACHED_ENV: NodeJS.ProcessEnv | null = null;
let CACHED_GPP: string | null = null;
let PCH_READY = false;

export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

export function getEnhancedEnv(): NodeJS.ProcessEnv {
  if (CACHED_ENV) return CACHED_ENV;
  const extraPaths: string[] = [];
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  const cargoBin = path.join(home, '.cargo', 'bin');
  if (fsSync.existsSync(cargoBin)) extraPaths.push(cargoBin);

  const wingetPkgs = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fsSync.existsSync(wingetPkgs)) {
    try {
      for (const dir of fsSync.readdirSync(wingetPkgs)) {
        if (dir.toLowerCase().includes('winlibs')) {
          const candidate = path.join(wingetPkgs, dir, 'mingw64', 'bin');
          if (fsSync.existsSync(candidate)) {
            extraPaths.push(candidate);
            const gppExe = path.join(candidate, 'g++.exe');
            if (!CACHED_GPP && fsSync.existsSync(gppExe)) CACHED_GPP = gppExe;
          }
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
  CACHED_ENV = {
    ...process.env,
    PATH: [...extraPaths, currentPath].join(sep),
  };
  return CACHED_ENV;
}

export function resolveGppBinary(): string {
  if (CACHED_GPP) return CACHED_GPP;
  getEnhancedEnv();
  if (!CACHED_GPP) CACHED_GPP = 'g++';
  return CACHED_GPP;
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

async function ensurePch(tempDir: string, gppCmd: string): Promise<string | null> {
  const pchDir = path.join(tempDir, 'pch');
  const bitsDir = path.join(pchDir, 'bits');
  const pchHeader = path.join(bitsDir, 'stdc++.h');
  const pchGch = path.join(bitsDir, 'stdc++.h.gch');

  if (PCH_READY || fsSync.existsSync(pchGch)) {
    PCH_READY = true;
    return pchDir;
  }

  try {
    await fs.mkdir(bitsDir, { recursive: true });
    await fs.writeFile(pchHeader, '#pragma once\n#include_next <bits/stdc++.h>\n', 'utf-8');
    runProcessWithInput(
      gppCmd,
      ['-O2', '-std=c++17', '-x', 'c++-header', pchHeader, '-o', pchGch],
      '',
      20000,
      tempDir
    ).then((res) => {
      if (res.exitCode === 0 && fsSync.existsSync(pchGch)) {
        PCH_READY = true;
      }
    });
  } catch {
    // ignore
  }
  return null;
}

export async function runCpp(
  code: string,
  testCases: TestCaseInput[],
  tempDir: string
): Promise<{ compileError?: string; results: TestCaseResult[] }> {
  const binCacheDir = path.join(tempDir, 'bin_cache');
  await fs.mkdir(binCacheDir, { recursive: true });

  const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 24);
  const isWin = process.platform === 'win32';
  const outFile = path.join(binCacheDir, isWin ? `cpp_${hash}.exe` : `cpp_${hash}.out`);
  const gppCmd = resolveGppBinary();

  if (!fsSync.existsSync(outFile)) {
    const srcFile = path.join(tempDir, `cpp_${hash}.cpp`);
    await fs.writeFile(srcFile, code, 'utf-8');
    const pchDir = await ensurePch(tempDir, gppCmd);

    const compileArgs: string[] = [];
    if (pchDir) compileArgs.push(`-I${pchDir}`);
    compileArgs.push('-O2', '-std=c++17', '-pipe', srcFile, '-o', outFile);

    const compileRes = await runProcessWithInput(gppCmd, compileArgs, '', 15000, tempDir);
    await fs.unlink(srcFile).catch(() => {});

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
