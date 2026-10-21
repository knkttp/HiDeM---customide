const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let backendProcess = null;
const PORT = 5000;

function detectLanguageFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.rs') return 'rust';
  if (ext === '.py') return 'python';
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.json') return 'json';
  return 'cpp';
}

function checkServerReady() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(300, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureBackendRunning() {
  const alreadyUp = await checkServerReady();
  if (alreadyUp) return;

  const serverScript = path.join(__dirname, '..', 'dist-backend', 'server.cjs');
  backendProcess = spawn(process.execPath, [serverScript], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(PORT) },
    stdio: 'ignore',
    windowsHide: true,
  });

  for (let i = 0; i < 50; i++) {
    if (await checkServerReady()) break;
    await new Promise((r) => setTimeout(r, 80));
  }
}

async function createWindow() {
  await ensureBackendRunning();

  const iconPath = path.join(__dirname, '..', 'launcher', 'app.ico');

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    frame: false, // Pure frameless VSCode-style desktop window (no browser title bar)
    backgroundColor: '#090d16',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    title: 'HiDeM — Multi-Language IDE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  await mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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

// Instant Direct File Write (Ctrl+S when filePath is already known)
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch {
      // ignore
    }
  }
  app.quit();
});
