const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

// ============================================================================
// 1. HIGH-PERFORMANCE GPU & V8 JIT FLAGS (60-144 FPS Smooth UI + Fast JIT)
// ============================================================================
app.commandLine.appendSwitch(
  'js-flags',
  '--max-old-space-size=384 --always-sparkplug --maglev'
);

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch(
  'disable-features',
  'Translate,TranslateUI,AutofillServerCommunication,Spellcheck,MediaRouter,OptimizationHints,WebOTP,WebPayments,WebUSB,WebBluetooth,WebXR'
);
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-extensions-with-background-pages');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('metrics-recording-only');
app.commandLine.appendSwitch('no-first-run');
app.commandLine.appendSwitch('no-pings');
app.commandLine.appendSwitch('no-default-browser-check');

let mainWindow = null;

const TEMP_DIR = path.join(os.tmpdir(), 'custom-ide-temp');
const BIN_CACHE_DIR = path.join(TEMP_DIR, 'bin_cache');
const PCH_DIR = path.join(TEMP_DIR, 'pch');
const PYCACHE_DIR = path.join(TEMP_DIR, 'pycache');

// ============================================================================
// 2. CACHED COMPILER PATHS, ENV & PRECOMPILED HEADERS (PCH)
// ============================================================================
let CACHED_ENV = null;
let CACHED_GPP = null;
let CACHED_RUSTC = null;
let CACHED_PYTHON = null;
let PCH_READY = false;

function initToolchainPaths() {
  if (CACHED_ENV) return;

  const extraPaths = [];
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  const cargoBin = path.join(home, '.cargo', 'bin');
  if (fs.existsSync(cargoBin)) {
    extraPaths.push(cargoBin);
    const rustcCandidate = path.join(cargoBin, process.platform === 'win32' ? 'rustc.exe' : 'rustc');
    if (fs.existsSync(rustcCandidate)) CACHED_RUSTC = rustcCandidate;
  }

  const wingetPkgs = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetPkgs)) {
    try {
      for (const dir of fs.readdirSync(wingetPkgs)) {
        if (dir.toLowerCase().includes('winlibs')) {
          const candidateBin = path.join(wingetPkgs, dir, 'mingw64', 'bin');
          if (fs.existsSync(candidateBin)) {
            extraPaths.push(candidateBin);
            const gppExe = path.join(candidateBin, 'g++.exe');
            if (!CACHED_GPP && fs.existsSync(gppExe)) CACHED_GPP = gppExe;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const winGetLinks = path.join(localAppData, 'Microsoft', 'WinGet', 'Links');
  if (fs.existsSync(winGetLinks)) extraPaths.push(winGetLinks);

  const programsPyDir = path.join(localAppData, 'Programs', 'Python');
  if (fs.existsSync(programsPyDir)) {
    try {
      for (const dir of fs.readdirSync(programsPyDir)) {
        const pyCandidate = path.join(programsPyDir, dir, 'python.exe');
        if (fs.existsSync(pyCandidate)) {
          CACHED_PYTHON = pyCandidate;
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  if (!CACHED_GPP) CACHED_GPP = 'g++';
  if (!CACHED_RUSTC) CACHED_RUSTC = 'rustc';
  if (!CACHED_PYTHON) CACHED_PYTHON = 'python';

  const currentPath = process.env.PATH || process.env.Path || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  CACHED_ENV = {
    ...process.env,
    PATH: [...extraPaths, currentPath].join(sep),
    PYTHONPYCACHEPREFIX: PYCACHE_DIR,
  };
}

function runProcessWithInput(command, args, input, timeoutMs = 3000, cwd = TEMP_DIR) {
  initToolchainPaths();
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
      env: CACHED_ENV,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
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
        resolve({
          stdout,
          stderr: stderr ? `${stderr}\n${err.message}` : err.message,
          exitCode: -1,
          timedOut: false,
          timeMs: Math.round(performance.now() - startTime),
        });
      }
    });

    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code,
          timedOut,
          timeMs: Math.round(performance.now() - startTime),
        });
      }
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

// Background Warm-up: Precompile C++ bits/stdc++.h.gch + Pre-cache Python stdlib .pyc
async function warmUpToolchainsAndLibraries() {
  try {
    initToolchainPaths();
    await fsp.mkdir(BIN_CACHE_DIR, { recursive: true });
    await fsp.mkdir(PYCACHE_DIR, { recursive: true });

    const bitsDir = path.join(PCH_DIR, 'bits');
    const pchHeader = path.join(bitsDir, 'stdc++.h');
    const pchGch = path.join(bitsDir, 'stdc++.h.gch');

    if (fs.existsSync(pchGch)) {
      PCH_READY = true;
    } else {
      await fsp.mkdir(bitsDir, { recursive: true });
      await fsp.writeFile(pchHeader, '#pragma once\n#include_next <bits/stdc++.h>\n', 'utf-8');
      runProcessWithInput(
        CACHED_GPP,
        ['-O2', '-std=c++17', '-x', 'c++-header', pchHeader, '-o', pchGch],
        '',
        20000,
        TEMP_DIR
      ).then((res) => {
        if (res.exitCode === 0 && fs.existsSync(pchGch)) {
          PCH_READY = true;
        }
      });
    }

    // Warm up Python stdlib bytecode cache
    runProcessWithInput(
      CACHED_PYTHON,
      ['-O', '-c', 'import sys, math, collections, heapq, itertools, bisect, functools, re, json'],
      '',
      5000,
      TEMP_DIR
    ).catch(() => {});
  } catch {
    // ignore warmup errors
  }
}

async function pruneBinaryCache() {
  try {
    const entries = await fsp.readdir(BIN_CACHE_DIR);
    if (entries.length <= 24) return;
    const stats = await Promise.all(
      entries.map(async (name) => {
        const full = path.join(BIN_CACHE_DIR, name);
        const st = await fsp.stat(full).catch(() => null);
        return st ? { full, mtimeMs: st.mtimeMs } : null;
      })
    );
    const valid = stats.filter(Boolean).sort((a, b) => a.mtimeMs - b.mtimeMs);
    const toRemove = valid.slice(0, Math.max(0, valid.length - 20));
    for (const item of toRemove) {
      await fsp.unlink(item.full).catch(() => {});
    }
  } catch {
    // ignore
  }
}

function normalizeOutput(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

async function executeBinaryAgainstTests(outFile, testCases) {
  return Promise.all(
    testCases.map(async (tc) => {
      const execRes = await runProcessWithInput(outFile, [], tc.input, 3000, TEMP_DIR);
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
      const isAc = normalizeOutput(execRes.stdout) === normalizeOutput(tc.expectedOutput);
      return {
        id: tc.id,
        actualOutput: execRes.stdout,
        stderr: execRes.stderr,
        status: isAc ? 'AC' : 'WA',
        timeMs: execRes.timeMs,
      };
    })
  );
}

async function executeCppFast(code, testCases) {
  initToolchainPaths();
  await fsp.mkdir(BIN_CACHE_DIR, { recursive: true });

  const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 24);
  const ext = process.platform === 'win32' ? '.exe' : '.out';
  const cachedBin = path.join(BIN_CACHE_DIR, `cpp_${hash}${ext}`);

  if (!fs.existsSync(cachedBin)) {
    const srcFile = path.join(TEMP_DIR, `cpp_${hash}.cpp`);
    await fsp.writeFile(srcFile, code, 'utf-8');

    const compileArgs = [];
    if (PCH_READY) {
      compileArgs.push(`-I${PCH_DIR}`);
    }
    compileArgs.push('-O2', '-std=c++17', '-pipe', srcFile, '-o', cachedBin);

    const compileRes = await runProcessWithInput(CACHED_GPP, compileArgs, '', 15000, TEMP_DIR);
    await fsp.unlink(srcFile).catch(() => {});

    if (compileRes.exitCode !== 0 || compileRes.timedOut) {
      const errText = compileRes.stderr || 'Compilation failed (g++ error).';
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

    pruneBinaryCache();
  }

  const results = await executeBinaryAgainstTests(cachedBin, testCases);
  return { results };
}

async function executeRustFast(code, testCases) {
  initToolchainPaths();
  await fsp.mkdir(BIN_CACHE_DIR, { recursive: true });

  const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 24);
  const ext = process.platform === 'win32' ? '.exe' : '.out';
  const cachedBin = path.join(BIN_CACHE_DIR, `rs_${hash}${ext}`);

  if (!fs.existsSync(cachedBin)) {
    const srcFile = path.join(TEMP_DIR, `rs_${hash}.rs`);
    await fsp.writeFile(srcFile, code, 'utf-8');

    const compileRes = await runProcessWithInput(
      CACHED_RUSTC,
      ['-O', '-C', 'debuginfo=0', srcFile, '-o', cachedBin],
      '',
      15000,
      TEMP_DIR
    );
    await fsp.unlink(srcFile).catch(() => {});
    const pdbFile = cachedBin.replace(/\.exe$/, '.pdb');
    await fsp.unlink(pdbFile).catch(() => {});

    if (compileRes.exitCode !== 0 || compileRes.timedOut) {
      const errText = compileRes.stderr || 'Compilation failed (rustc error).';
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

    pruneBinaryCache();
  }

  const results = await executeBinaryAgainstTests(cachedBin, testCases);
  return { results };
}

async function executePythonFast(code, testCases) {
  initToolchainPaths();
  await fsp.mkdir(TEMP_DIR, { recursive: true });

  const hash = crypto.createHash('sha256').update(code).digest('hex').slice(0, 24);
  const srcFile = path.join(TEMP_DIR, `py_${hash}.py`);
  if (!fs.existsSync(srcFile)) {
    await fsp.writeFile(srcFile, code, 'utf-8');
  }

  const results = await Promise.all(
    testCases.map(async (tc) => {
      const execRes = await runProcessWithInput(
        CACHED_PYTHON,
        ['-O', '-u', srcFile],
        tc.input,
        3000,
        TEMP_DIR
      );
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
      const isAc = normalizeOutput(execRes.stdout) === normalizeOutput(tc.expectedOutput);
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

function triggerIdleGc() {
  // No-op during active sessions to prevent paging out hot V8 JIT & DOM memory
}

function detectLanguageFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.rs') return 'rust';
  if (ext === '.py') return 'python';
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.json') return 'json';
  if (ext === '.txt' || ext === '.in' || ext === '.out' || ext === '.md') return 'text';
  return 'cpp';
}

const PORT = 5000;
const DIST_DIR = path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Lightweight in-process static server on localhost:5000 (0 extra child process, preserves http://localhost:5000 localStorage origin!)
function startInProcessStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"status":"ok","port":5000}');
        return;
      }

      let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
      if (!filePath.startsWith(DIST_DIR)) {
        res.writeHead(403);
        res.end();
        return;
      }

      try {
        const stat = await fsp.stat(filePath);
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
        const data = await fsp.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        try {
          const fallback = await fsp.readFile(path.join(DIST_DIR, 'index.html'));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fallback);
        } catch {
          res.writeHead(404);
          res.end('Not Found');
        }
      }
    });

    server.on('error', () => resolve());
    server.listen(PORT, '127.0.0.1', () => resolve());
  });
}

async function createWindow() {
  await startInProcessStaticServer();

  const iconPath = path.join(__dirname, '..', 'launcher', 'app.ico');

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    backgroundColor: '#090d16',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    title: 'HiDeM — Multi-Language IDE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  await mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on('minimize', () => {
    triggerIdleGc();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Warm up compilers, bits/stdc++.h.gch and Python bytecode cache asynchronously
  warmUpToolchainsAndLibraries();
  triggerIdleGc();
}

// Direct In-Process Code Execution IPC (Zero Express/HTTP Process Overhead)
ipcMain.handle('code:execute', async (_event, payload) => {
  const { language, code, testCases } = payload || {};
  const safeTestCases =
    Array.isArray(testCases) && testCases.length > 0
      ? testCases
      : [{ id: 'default-1', input: '', expectedOutput: '' }];

  try {
    if (language === 'cpp') return await executeCppFast(code, safeTestCases);
    if (language === 'rust') return await executeRustFast(code, safeTestCases);
    if (language === 'python') return await executePythonFast(code, safeTestCases);
    return { results: [] };
  } finally {
    triggerIdleGc();
  }
});

// Window Controls IPC
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// Parented In-App Open File Dialog (Ctrl+O)
ipcMain.handle('dialog:open-files', async () => {
  if (!mainWindow) return { canceled: true, files: [] };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Source Files — HiDeM',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'All Supported Code',
        extensions: ['cpp', 'cc', 'cxx', 'h', 'hpp', 'rs', 'py', 'html', 'htm', 'json', 'txt'],
      },
      { name: 'C++ Files', extensions: ['cpp', 'cc', 'cxx', 'h', 'hpp'] },
      { name: 'Rust Files', extensions: ['rs'] },
      { name: 'Python Files', extensions: ['py'] },
      { name: 'HTML Files', extensions: ['html', 'htm'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true, files: [] };
  }

  const files = await Promise.all(
    result.filePaths.map(async (filePath) => {
      const content = await fsp.readFile(filePath, 'utf-8');
      return {
        name: path.basename(filePath),
        filePath,
        language: detectLanguageFromExt(filePath),
        content,
      };
    })
  );

  return { canceled: false, files };
});

// Parented In-App Save File Dialog (Ctrl+S / Save As)
ipcMain.handle('dialog:save-file', async (_event, payload) => {
  if (!mainWindow) return { canceled: true };
  const { suggestedName, content, language } = payload || {};

  const filtersByLang = {
    cpp: [{ name: 'C++ Source File', extensions: ['cpp', 'cc', 'hpp', 'h'] }],
    rust: [{ name: 'Rust Source File', extensions: ['rs'] }],
    python: [{ name: 'Python Script', extensions: ['py'] }],
    html: [{ name: 'HTML Document', extensions: ['html', 'htm'] }],
    json: [{ name: 'JSON File', extensions: ['json'] }],
    text: [{ name: 'Text File', extensions: ['txt', 'in', 'out', 'md'] }],
  };

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Source File — HiDeM',
    defaultPath: suggestedName || 'main.cpp',
    filters: [
      ...(filtersByLang[language] || []),
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fsp.writeFile(result.filePath, content ?? '', 'utf-8');
  return {
    canceled: false,
    filePath: result.filePath,
    name: path.basename(result.filePath),
    language: detectLanguageFromExt(result.filePath),
  };
});

// Instant Direct File Write (Ctrl+S or Auto-Save when filePath is already known)
ipcMain.handle('fs:save-direct', async (_event, payload) => {
  const { filePath, content } = payload || {};
  if (!filePath) throw new Error('Missing filePath');
  await fsp.writeFile(filePath, content ?? '', 'utf-8');
  return {
    saved: true,
    filePath,
    name: path.basename(filePath),
  };
});

// Auto-Save Backup for untitled/workspace tabs into ./workspace/
ipcMain.handle('fs:backup-workspace', async (_event, payload) => {
  const { name, content } = payload || {};
  if (!name) return { saved: false };
  const safeName = path.basename(name).replace(/[<>:"/\\|?*]/g, '_');
  const workspaceDir = path.join(__dirname, '..', 'workspace');
  await fsp.mkdir(workspaceDir, { recursive: true });
  const targetPath = path.join(workspaceDir, safeName);
  await fsp.writeFile(targetPath, content ?? '', 'utf-8');
  return {
    saved: true,
    filePath: targetPath,
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
