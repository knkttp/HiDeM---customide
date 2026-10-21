import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { runCpp, TestCaseInput } from './runner/cppRunner.ts';
import { runRust } from './runner/rustRunner.ts';
import { runPython } from './runner/pythonRunner.ts';
import { runWebValidator } from './runner/webValidator.ts';

const currentDir =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const PROJECT_ROOT = path.resolve(currentDir, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const TEMP_DIR = path.join(os.tmpdir(), 'custom-ide-temp');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

function runPowerShellJson(psScript: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true }
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `PowerShell exited with code ${code}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function detectLanguageFromExt(filePath: string): 'cpp' | 'rust' | 'python' | 'html' | 'json' {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.rs') return 'rust';
  if (ext === '.py') return 'python';
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.json') return 'json';
  return 'cpp';
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Native Windows Explorer Open File Dialog (Supports Multi-Select)
app.post('/api/fs/open-dialog', async (_req, res) => {
  try {
    const psScript = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      Add-Type -AssemblyName System.Windows.Forms
      $dlg = New-Object System.Windows.Forms.OpenFileDialog
      $dlg.Title = "Open Source Files (Multi-Select Supported)"
      $dlg.Filter = "All Supported Code (*.cpp;*.cc;*.cxx;*.h;*.hpp;*.rs;*.py;*.html;*.htm;*.json;*.txt)|*.cpp;*.cc;*.cxx;*.h;*.hpp;*.rs;*.py;*.html;*.htm;*.json;*.txt|C++ Files (*.cpp;*.h;*.hpp)|*.cpp;*.cc;*.cxx;*.h;*.hpp|Rust Files (*.rs)|*.rs|Python Files (*.py)|*.py|HTML Files (*.html;*.htm)|*.html;*.htm|JSON Files (*.json)|*.json|All Files (*.*)|*.*"
      $dlg.Multiselect = $true
      $owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }
      $result = $dlg.ShowDialog($owner)
      $owner.Dispose()
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        $dlg.FileNames | ConvertTo-Json -Compress
      } else {
        Write-Output "[]"
      }
    `;

    const raw = await runPowerShellJson(psScript);
    if (!raw || raw === '[]') {
      res.json({ canceled: true, files: [] });
      return;
    }

    const parsed = JSON.parse(raw);
    const paths: string[] = Array.isArray(parsed) ? parsed : [parsed];

    const files = await Promise.all(
      paths.map(async (filePath) => {
        const content = await fsp.readFile(filePath, 'utf-8');
        return {
          name: path.basename(filePath),
          filePath,
          language: detectLanguageFromExt(filePath),
          content,
        };
      })
    );

    res.json({ canceled: false, files });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Native Windows Explorer Save File Dialog
app.post('/api/fs/save-dialog', async (req, res) => {
  try {
    const { suggestedName, content, language } = req.body as {
      suggestedName?: string;
      content: string;
      language?: string;
    };

    const extMap: Record<string, string> = {
      cpp: 'C++ Source (*.cpp)|*.cpp|Header (*.hpp;*.h)|*.hpp;*.h|All Files (*.*)|*.*',
      rust: 'Rust Source (*.rs)|*.rs|All Files (*.*)|*.*',
      python: 'Python Script (*.py)|*.py|All Files (*.*)|*.*',
      html: 'HTML Document (*.html)|*.html|All Files (*.*)|*.*',
      json: 'JSON File (*.json)|*.json|All Files (*.*)|*.*',
    };

    const filter = extMap[language || 'cpp'] || 'All Files (*.*)|*.*';
    const safeName = (suggestedName || 'main.cpp').replace(/"/g, '');

    const psScript = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      Add-Type -AssemblyName System.Windows.Forms
      $dlg = New-Object System.Windows.Forms.SaveFileDialog
      $dlg.Title = "Save Source File As"
      $dlg.Filter = "${filter}"
      $dlg.FileName = "${safeName}"
      $dlg.OverwritePrompt = $true
      $owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }
      $result = $dlg.ShowDialog($owner)
      $owner.Dispose()
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $dlg.FileName
      } else {
        Write-Output ""
      }
    `;

    const chosenPath = await runPowerShellJson(psScript);
    if (!chosenPath) {
      res.json({ canceled: true });
      return;
    }

    await fsp.writeFile(chosenPath, content ?? '', 'utf-8');
    res.json({
      canceled: false,
      filePath: chosenPath,
      name: path.basename(chosenPath),
      language: detectLanguageFromExt(chosenPath),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Direct Save to an already-known Windows disk path (Ctrl+S)
app.post('/api/fs/save-direct', async (req, res) => {
  try {
    const { filePath, content } = req.body as {
      filePath: string;
      content: string;
    };
    if (!filePath) {
      res.status(400).json({ error: 'Missing filePath parameter.' });
      return;
    }
    await fsp.writeFile(filePath, content ?? '', 'utf-8');
    res.json({
      saved: true,
      filePath,
      name: path.basename(filePath),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.post('/api/execute', async (req, res) => {
  try {
    const { language, code, testCases } = req.body as {
      language: 'cpp' | 'rust' | 'python' | 'html' | 'json';
      code: string;
      testCases: TestCaseInput[];
    };

    if (!language || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing language or code parameter.' });
      return;
    }

    const safeTestCases: TestCaseInput[] =
      Array.isArray(testCases) && testCases.length > 0
        ? testCases
        : [{ id: 'default-1', input: '', expectedOutput: '' }];

    if (language === 'cpp') {
      const result = await runCpp(code, safeTestCases, TEMP_DIR);
      res.json(result);
      return;
    }

    if (language === 'rust') {
      const result = await runRust(code, safeTestCases, TEMP_DIR);
      res.json(result);
      return;
    }

    if (language === 'python') {
      const result = await runPython(code, safeTestCases, TEMP_DIR);
      res.json(result);
      return;
    }

    if (language === 'html' || language === 'json') {
      const result = runWebValidator(language, code, safeTestCases);
      res.json(result);
      return;
    }

    res.status(400).json({ error: `Unsupported language: ${language}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Serve static frontend build for standalone Desktop .exe mode
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[Multi-Language IDE] Desktop & Compiler Server listening on http://localhost:${PORT}`);
});
