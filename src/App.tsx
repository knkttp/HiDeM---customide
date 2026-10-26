import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TopBar, SupportedLanguage, LANGUAGE_META } from './components/TopBar';
import { EditorPane, CodeFileTab } from './components/EditorPane';
import { TestCasePane, TestCase } from './components/TestCasePane';
import { ThemeModal, ThemeConfig, PRESET_WALLPAPERS } from './components/ThemeModal';
import { TemplateModal, CustomSnippet } from './components/TemplateModal';

// Type declarations for Electron Desktop Bridge & Chromium File System Access API
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface FileSystemWritableFileStream {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

interface NativeFileSystemFileHandle {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableFileStream>;
}

interface HidemDesktopBridge {
  isElectron: boolean;
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  closeWindow: () => void;
  openFilesDialog: () => Promise<{
    canceled: boolean;
    files: { name: string; filePath: string; language: SupportedLanguage; content: string }[];
  }>;
  saveFileDialog: (payload: {
    suggestedName: string;
    content: string;
    language: SupportedLanguage;
  }) => Promise<{
    canceled: boolean;
    filePath?: string;
    name?: string;
    language?: SupportedLanguage;
  }>;
  saveFileDirect: (payload: {
    filePath: string;
    content: string;
  }) => Promise<{ saved: boolean; filePath: string; name: string }>;
  backupWorkspaceFile?: (payload: {
    name: string;
    content: string;
  }) => Promise<{ saved: boolean; filePath?: string }>;
  executeCode?: (payload: {
    language: SupportedLanguage;
    code: string;
    testCases: { id: string; input: string; expectedOutput: string }[];
  }) => Promise<{
    compileError?: string;
    results: { id: string; actualOutput: string; status: TestCase['status']; timeMs?: number }[];
  }>;
}

declare global {
  interface Window {
    hidemDesktop?: HidemDesktopBridge;
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<NativeFileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<NativeFileSystemFileHandle>;
  }
}

const STORAGE_KEYS = {
  THEME_CONFIG: 'custom_ide_theme_config_v1',
  CUSTOM_TEMPLATES: 'custom_ide_custom_templates_v2',
  CUSTOM_SNIPPETS: 'custom_ide_custom_snippets_v1',
  TABS: 'custom_ide_open_tabs_v2',
  ACTIVE_TAB_ID: 'custom_ide_active_tab_id_v2',
  TEST_CASES: 'custom_ide_test_cases_v1',
  AUTO_SAVE: 'custom_ide_auto_save_v1',
};

export const FACTORY_CODE_TEMPLATES: Record<SupportedLanguage, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    long long a, b;
    if (cin >> a >> b) {
        cout << (a + b) << "\\n";
    }
    return 0;
}
`,
  rust: `use std::io::{self, Read};

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let mut iter = input.split_whitespace();
    if let (Some(a_str), Some(b_str)) = (iter.next(), iter.next()) {
        let a: i64 = a_str.parse().unwrap_or(0);
        let b: i64 = b_str.parse().unwrap_or(0);
        println!("{}", a + b);
    }
}
`,
  python: `import sys

def solve():
    tokens = sys.stdin.read().split()
    if len(tokens) >= 2:
        a, b = int(tokens[0]), int(tokens[1])
        print(a + b)

if __name__ == "__main__":
    solve()
`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a, #1e1b4b);
      color: #f8fafc;
      font-family: system-ui, sans-serif;
    }
    .card {
      padding: 2rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    button {
      margin-top: 1rem;
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 0.5rem;
      background: #6366f1;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ HiDeM Live DOM Sandbox</h2>
    <p id="counter">Clicks: 0</p>
    <button onclick="inc()">Increment Counter</button>
  </div>
  <script>
    let count = 0;
    function inc() {
      count++;
      document.getElementById('counter').textContent = 'Clicks: ' + count;
    }
  </script>
</body>
</html>
`,
  json: `{
  "ide": "HiDeM V1.0",
  "languages": ["C++17", "Rust", "Python 3", "HTML5", "JSON"],
  "features": {
    "intelliSense": true,
    "wallpaperBlur": true,
    "autoJudge": true,
    "multiFileTabs": true,
    "nativeFramelessDesktop": true
  }
}`,
  text: '',
};

const DEFAULT_TEST_CASES: TestCase[] = [
  {
    id: 'tc-1',
    input: '15 27',
    expectedOutput: '42',
    actualOutput: '',
    status: 'IDLE',
  },
  {
    id: 'tc-2',
    input: '1000000000 2000000000',
    expectedOutput: '3000000000',
    actualOutput: '',
    status: 'IDLE',
  },
];

const FILE_PICKER_TYPES_BY_LANG: Record<SupportedLanguage, FilePickerAcceptType[]> = {
  cpp: [
    {
      description: 'C++ Source Files',
      accept: { 'text/plain': ['.cpp', '.cc', '.cxx', '.h', '.hpp'] },
    },
  ],
  rust: [
    {
      description: 'Rust Source Files',
      accept: { 'text/plain': ['.rs'] },
    },
  ],
  python: [
    {
      description: 'Python Script Files',
      accept: { 'text/x-python': ['.py'] },
    },
  ],
  html: [
    {
      description: 'HTML Documents',
      accept: { 'text/html': ['.html', '.htm'] },
    },
  ],
  json: [
    {
      description: 'JSON Files',
      accept: { 'application/json': ['.json'] },
    },
  ],
  text: [
    {
      description: 'Plain Text Files',
      accept: { 'text/plain': ['.txt', '.in', '.out', '.md'] },
    },
  ],
};

function detectLangByFilename(name: string, fallback: SupportedLanguage): SupportedLanguage {
  const lower = name.toLowerCase();
  if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx') || lower.endsWith('.h') || lower.endsWith('.hpp')) return 'cpp';
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.txt') || lower.endsWith('.in') || lower.endsWith('.out') || lower.endsWith('.md')) return 'text';
  return fallback;
}

export const App: React.FC = () => {
  const fileHandlesRef = useRef<Map<string, NativeFileSystemFileHandle>>(new Map());

  // 1. Custom Code Templates (Editable by User)
  const [customTemplates, setCustomTemplates] = useState<Record<SupportedLanguage, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_TEMPLATES);
      if (saved) {
        return { ...FACTORY_CODE_TEMPLATES, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return FACTORY_CODE_TEMPLATES;
  });

  // 1b. User-Created Custom Snippets
  const [snippets, setSnippets] = useState<CustomSnippet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_SNIPPETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // 2. Multi-File Tabs State
  const [tabs, setTabs] = useState<CodeFileTab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TABS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'tab-cpp-1',
        name: 'main.cpp',
        language: 'cpp',
        code: FACTORY_CODE_TEMPLATES.cpp,
        isDirty: false,
      },
      {
        id: 'tab-py-1',
        name: 'solve.py',
        language: 'python',
        code: FACTORY_CODE_TEMPLATES.python,
        isDirty: false,
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB_ID) || 'tab-cpp-1';
  });

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const language: SupportedLanguage = activeTab?.language || 'cpp';
  const currentCode = activeTab?.code || '';

  // 3. Test Cases State
  const [testCases, setTestCases] = useState<TestCase[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TEST_CASES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_TEST_CASES;
  });

  // 4. Theme & Wallpaper Blur State
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      wallpaperUrl: PRESET_WALLPAPERS[0].url,
      blurPx: 12,
      opacity: 0.72,
      theme: 'one-dark-pro',
    };
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileCustomName, setNewFileCustomName] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 5. Auto-Save State (Default: ON)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE);
      if (saved !== null) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return true;
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(null);

  const flashStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 2000);
  }, []);

  // Sync CSS Variables for 3-layer Wallpaper & Backdrop Blur
  useEffect(() => {
    const root = document.documentElement;
    const safeUrl = themeConfig.wallpaperUrl.trim();
    root.style.setProperty('--bg-image', safeUrl ? `url("${safeUrl}")` : 'none');
    root.style.setProperty('--bg-blur', `${themeConfig.blurPx}px`);
    root.style.setProperty('--blur-px', `${themeConfig.blurPx}px`);
    root.style.setProperty('--bg-opacity', String(themeConfig.opacity));
    try {
      localStorage.setItem(STORAGE_KEYS.THEME_CONFIG, JSON.stringify(themeConfig));
    } catch {
      // ignore quota error
    }
  }, [themeConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_TEMPLATES, JSON.stringify(customTemplates));
  }, [customTemplates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SNIPPETS, JSON.stringify(snippets));
  }, [snippets]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs));
    }, 400);
    return () => clearTimeout(timer);
  }, [tabs]);

  useEffect(() => {
    if (activeTab?.id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB_ID, activeTab.id);
    }
  }, [activeTab?.id]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TEST_CASES, JSON.stringify(testCases));
  }, [testCases]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, JSON.stringify(autoSaveEnabled));
  }, [autoSaveEnabled]);

  // Core Auto-Save Flush Function
  const flushAutoSave = useCallback(async (currentTabs: CodeFileTab[]) => {
    const dirtyTabs = currentTabs.filter((t) => t.isDirty);
    if (dirtyTabs.length === 0) return;

    setAutoSaveStatus('saving');

    for (const tab of dirtyTabs) {
      try {
        if (window.hidemDesktop?.isElectron && tab.filePath) {
          await window.hidemDesktop.saveFileDirect({
            filePath: tab.filePath,
            content: tab.code,
          });
        } else {
          const existingHandle = fileHandlesRef.current.get(tab.id);
          if (existingHandle) {
            const writable = await existingHandle.createWritable();
            await writable.write(tab.code);
            await writable.close();
          } else if (window.hidemDesktop?.backupWorkspaceFile) {
            await window.hidemDesktop.backupWorkspaceFile({
              name: tab.name,
              content: tab.code,
            });
          }
        }
      } catch {
        // ignore background auto-save write errors
      }
    }

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setTabs((prev) =>
      prev.map((t) => (t.isDirty ? { ...t, isDirty: false } : t))
    );
    setLastAutoSaveTime(nowStr);
    setAutoSaveStatus('saved');
  }, []);

  // Debounced Auto-Save after 700ms of typing inactivity
  useEffect(() => {
    if (!autoSaveEnabled) return;
    const hasDirty = tabs.some((t) => t.isDirty);
    if (!hasDirty) return;

    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      flushAutoSave(tabs);
    }, 700);

    return () => clearTimeout(timer);
  }, [tabs, autoSaveEnabled, flushAutoSave]);

  // Flush Auto-Save immediately when window loses focus
  useEffect(() => {
    if (!autoSaveEnabled) return;
    const onWindowBlur = () => {
      if (tabs.some((t) => t.isDirty)) {
        flushAutoSave(tabs);
      }
    };
    window.addEventListener('blur', onWindowBlur);
    return () => window.removeEventListener('blur', onWindowBlur);
  }, [tabs, autoSaveEnabled, flushAutoSave]);

  const handleToggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => !prev);
  }, []);

  // Tab Operations
  const handleCodeChange = (nextCode: string) => {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, code: nextCode, isDirty: true } : t
      )
    );
  };

  const handleLanguageChange = (nextLang: SupportedLanguage) => {
    setCompileError(null);
    const existingTab = tabs.find((t) => t.language === nextLang);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }
    const ext = LANGUAGE_META[nextLang].ext;
    const newId = `tab-${nextLang}-${Date.now()}`;
    const newTab: CodeFileTab = {
      id: newId,
      name: `main${ext}`,
      language: nextLang,
      code: customTemplates[nextLang] ?? FACTORY_CODE_TEMPLATES[nextLang],
      isDirty: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCreateTabWithLang = useCallback(
    (selectedLang: SupportedLanguage, customName?: string) => {
      const ext = LANGUAGE_META[selectedLang].ext;
      const sameLangCount = tabs.filter((t) => t.language === selectedLang).length + 1;
      const newId = `tab-${selectedLang}-${Date.now()}`;
      const trimmed = (customName ?? newFileCustomName).trim();
      let finalName = trimmed || `file_${sameLangCount}${ext}`;
      if (trimmed && !trimmed.includes('.')) {
        finalName = `${trimmed}${ext}`;
      }
      const detectedLang = trimmed ? detectLangByFilename(finalName, selectedLang) : selectedLang;

      const newTab: CodeFileTab = {
        id: newId,
        name: finalName,
        language: detectedLang,
        code: customTemplates[detectedLang] ?? FACTORY_CODE_TEMPLATES[detectedLang] ?? '',
        isDirty: false,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      setIsNewFileModalOpen(false);
      setNewFileCustomName('');
    },
    [tabs, newFileCustomName, customTemplates]
  );

  const handleAddTab = useCallback(() => {
    setNewFileCustomName('');
    setIsNewFileModalOpen(true);
  }, []);

  const handleCloseTab = (id: string) => {
    if (tabs.length <= 1) return;
    fileHandlesRef.current.delete(id);
    const idx = tabs.findIndex((t) => t.id === id);
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTab?.id === id) {
      const fallback = nextTabs[Math.max(0, idx - 1)] || nextTabs[0];
      setActiveTabId(fallback.id);
    }
  };

  const handleRenameTab = (id: string, newName: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const detectedLang = detectLangByFilename(newName, t.language);
        return { ...t, name: newName, language: detectedLang };
      })
    );
  };

  const handleReorderTabs = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setTabs((prev) => {
      const sourceIdx = prev.findIndex((t) => t.id === sourceId);
      const targetIdx = prev.findIndex((t) => t.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  // In-App Modal Open File Picker (Ctrl + O)
  const handleOpenFilesFromExplorer = useCallback(async () => {
    try {
      // 1. Electron Native Parented Modal Dialog (Preferred in Desktop App)
      if (window.hidemDesktop?.isElectron) {
        const res = await window.hidemDesktop.openFilesDialog();
        if (res.canceled || !res.files.length) return;

        let lastId = activeTabId;
        setTabs((prev) => {
          const updated = [...prev];
          for (const f of res.files) {
            const existingIdx = updated.findIndex((t) => t.filePath === f.filePath);
            if (existingIdx !== -1) {
              updated[existingIdx] = {
                ...updated[existingIdx],
                code: f.content,
                isDirty: false,
              };
              lastId = updated[existingIdx].id;
            } else {
              const newId = `tab-disk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              updated.push({
                id: newId,
                name: f.name,
                language: f.language,
                code: f.content,
                filePath: f.filePath,
                isDirty: false,
              });
              lastId = newId;
            }
          }
          return updated;
        });

        setActiveTabId(lastId);
        flashStatus(`Opened ${res.files.length} file(s)!`);
        return;
      }

      // 2. Fallback: Chromium File System Access API
      if (typeof window.showOpenFilePicker === 'function') {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'All Supported Code Files',
              accept: {
                'text/plain': ['.cpp', '.cc', '.cxx', '.h', '.hpp', '.rs', '.py', '.html', '.htm', '.json', '.txt'],
              },
            },
          ],
        });

        if (!handles || handles.length === 0) return;

        const loadedFiles: {
          handle: NativeFileSystemFileHandle;
          name: string;
          content: string;
          lang: SupportedLanguage;
        }[] = [];

        for (const handle of handles) {
          const file = await handle.getFile();
          const content = await file.text();
          const lang = detectLangByFilename(file.name, language);
          loadedFiles.push({ handle, name: file.name, content, lang });
        }

        let lastId = activeTabId;
        setTabs((prev) => {
          const updated = [...prev];
          for (const item of loadedFiles) {
            const newId = `tab-fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            fileHandlesRef.current.set(newId, item.handle);
            updated.push({
              id: newId,
              name: item.name,
              language: item.lang,
              code: item.content,
              filePath: item.name,
              isDirty: false,
            });
            lastId = newId;
          }
          return updated;
        });

        setActiveTabId(lastId);
        flashStatus(`Opened ${loadedFiles.length} file(s)!`);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      setCompileError(`File Open Error: ${msg}`);
    }
  }, [activeTabId, language, flashStatus]);

  // In-App Modal Save As Picker (Ctrl + Shift + S)
  const handleSaveFileAs = useCallback(async () => {
    if (!activeTab) return;
    try {
      // 1. Electron Native Parented Save Dialog
      if (window.hidemDesktop?.isElectron) {
        const res = await window.hidemDesktop.saveFileDialog({
          suggestedName: activeTab.filePath || activeTab.name,
          content: activeTab.code,
          language: activeTab.language,
        });
        if (res.canceled || !res.filePath) return;

        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  name: res.name || t.name,
                  filePath: res.filePath,
                  language: res.language || t.language,
                  isDirty: false,
                }
              : t
          )
        );
        flashStatus(`✓ Saved: ${res.filePath}`);
        return;
      }

      // 2. Fallback: Chromium File System Access API
      if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({
          suggestedName: activeTab.name,
          types: FILE_PICKER_TYPES_BY_LANG[activeTab.language],
        });

        const writable = await handle.createWritable();
        await writable.write(activeTab.code);
        await writable.close();

        fileHandlesRef.current.set(activeTab.id, handle);
        const newLang = detectLangByFilename(handle.name, activeTab.language);

        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  name: handle.name,
                  filePath: handle.name,
                  language: newLang,
                  isDirty: false,
                }
              : t
          )
        );
        flashStatus(`✓ Saved: ${handle.name}`);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      setCompileError(`File Save Error: ${msg}`);
    }
  }, [activeTab, flashStatus]);

  // Instant Save (Ctrl + S)
  const handleSaveFile = useCallback(async () => {
    if (!activeTab) return;

    // 1. Electron Direct Disk Write if filePath is already known
    if (window.hidemDesktop?.isElectron && activeTab.filePath) {
      try {
        await window.hidemDesktop.saveFileDirect({
          filePath: activeTab.filePath,
          content: activeTab.code,
        });
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
        );
        flashStatus(`✓ Saved: ${activeTab.filePath}`);
        return;
      } catch {
        // Fallback to Save As dialog if path is no longer valid
      }
    }

    // 2. Chromium FileSystemFileHandle Direct Write
    const existingHandle = fileHandlesRef.current.get(activeTab.id);
    if (existingHandle) {
      try {
        const writable = await existingHandle.createWritable();
        await writable.write(activeTab.code);
        await writable.close();

        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
        );
        flashStatus(`✓ Saved: ${existingHandle.name}`);
        return;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    await handleSaveFileAs();
  }, [activeTab, handleSaveFileAs, flashStatus]);

  // Global Capture-Phase Keyboard Shortcuts: Ctrl+O (Open), Ctrl+S (Save), Ctrl+Shift+S (Save As)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        e.stopPropagation();
        handleAddTab();
      } else if (key === 'o') {
        e.preventDefault();
        e.stopPropagation();
        handleOpenFilesFromExplorer();
      } else if (key === 's') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handleSaveFileAs();
        } else {
          handleSaveFile();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [handleAddTab, handleOpenFilesFromExplorer, handleSaveFile, handleSaveFileAs]);

  // Apply Template to Current Tab
  const handleApplyTemplateToActiveTab = (lang: SupportedLanguage, templateCode: string) => {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? { ...t, language: lang, code: templateCode, isDirty: true }
          : t
      )
    );
    flashStatus(`Inserted ${LANGUAGE_META[lang].label} template into ${activeTab.name}`);
  };

  // JSON Prettify / Minify
  const handleJsonTransform = (mode: 'prettify' | 'minify') => {
    try {
      const parsed = JSON.parse(currentCode);
      const formatted =
        mode === 'prettify'
          ? JSON.stringify(parsed, null, 2)
          : JSON.stringify(parsed);
      handleCodeChange(formatted);
      setCompileError(null);
      setTestCases((prev) =>
        prev.map((tc) => ({
          ...tc,
          actualOutput: formatted,
          status: 'AC',
          timeMs: 1,
        }))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      let line = 1;
      let col = 1;
      const posMatch = msg.match(/position\s+(\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const lines = currentCode.slice(0, pos).split('\n');
        line = lines.length;
        col = lines[lines.length - 1].length + 1;
      }
      const detailedError = `JSON Syntax Error (Line ${line}, Column ${col}): ${msg}`;
      setCompileError(detailedError);
      setTestCases((prev) =>
        prev.map((tc) => ({
          ...tc,
          actualOutput: detailedError,
          status: 'RE',
          timeMs: 1,
        }))
      );
    }
  };

  const handleRunAll = async () => {
    if (autoSaveEnabled && tabs.some((t) => t.isDirty)) {
      await flushAutoSave(tabs);
    }

    if (language === 'html' || language === 'text') return;

    if (language === 'json') {
      handleJsonTransform('prettify');
      return;
    }

    setIsRunning(true);
    setCompileError(null);
    setTestCases((prev) => prev.map((tc) => ({ ...tc, status: 'RUNNING' })));

    try {
      const payload = {
        language,
        code: currentCode,
        testCases: testCases.map((tc) => ({
          id: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
        })),
      };

      const data = window.hidemDesktop?.executeCode
        ? await window.hidemDesktop.executeCode(payload)
        : await (async () => {
            const response = await fetch('/api/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error || 'Compiler server error');
            return json;
          })();

      if (data.compileError) {
        setCompileError(data.compileError);
      }

      if (Array.isArray(data.results)) {
        setTestCases((prev) =>
          prev.map((tc) => {
            const found = data.results.find((r: { id: string }) => r.id === tc.id);
            if (!found) return tc;
            return {
              ...tc,
              actualOutput: found.actualOutput ?? '',
              status: found.status ?? 'IDLE',
              timeMs: found.timeMs,
            };
          })
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setCompileError(`Cannot connect to Backend (/api/execute): ${errMsg}`);
      setTestCases((prev) =>
        prev.map((tc) => ({
          ...tc,
          actualOutput: errMsg,
          status: 'RE',
        }))
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunSingleTestCase = async (targetId: string) => {
    if (autoSaveEnabled && tabs.some((t) => t.isDirty)) {
      await flushAutoSave(tabs);
    }

    if (language === 'html' || language === 'text') return;

    if (language === 'json') {
      handleJsonTransform('prettify');
      return;
    }

    const targetTc = testCases.find((tc) => tc.id === targetId);
    if (!targetTc) return;

    setCompileError(null);
    setTestCases((prev) =>
      prev.map((tc) => (tc.id === targetId ? { ...tc, status: 'RUNNING' } : tc))
    );

    try {
      const payload = {
        language,
        code: currentCode,
        testCases: [
          {
            id: targetTc.id,
            input: targetTc.input,
            expectedOutput: targetTc.expectedOutput,
          },
        ],
      };

      const data = window.hidemDesktop?.executeCode
        ? await window.hidemDesktop.executeCode(payload)
        : await (async () => {
            const response = await fetch('/api/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error || 'Compiler server error');
            return json;
          })();

      if (data.compileError) {
        setCompileError(data.compileError);
      }

      if (Array.isArray(data.results)) {
        const found = data.results.find((r: { id: string }) => r.id === targetId);
        if (found) {
          setTestCases((prev) =>
            prev.map((tc) =>
              tc.id === targetId
                ? {
                    ...tc,
                    actualOutput: found.actualOutput ?? '',
                    status: found.status ?? 'IDLE',
                    timeMs: found.timeMs,
                  }
                : tc
            )
          );
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setCompileError(`Cannot connect to Backend (/api/execute): ${errMsg}`);
      setTestCases((prev) =>
        prev.map((tc) =>
          tc.id === targetId
            ? {
                ...tc,
                actualOutput: errMsg,
                status: 'RE',
              }
            : tc
        )
      );
    }
  };

  const handleExecuteSingleCode = useCallback(
    async (targetLang: SupportedLanguage, targetCode: string, input: string) => {
      try {
        const payload = {
          language: targetLang,
          code: targetCode,
          testCases: [{ id: 'cmp-1', input, expectedOutput: '' }],
        };
        const data = window.hidemDesktop?.executeCode
          ? await window.hidemDesktop.executeCode(payload)
          : await (async () => {
              const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const json = await response.json();
              if (!response.ok) throw new Error(json.error || 'Compiler server error');
              return json;
            })();

        const first = data.results?.[0];
        return {
          actualOutput: first?.actualOutput ?? data.compileError ?? '',
          status: (first?.status ?? (data.compileError ? 'RE' : 'IDLE')) as TestCase['status'],
          timeMs: first?.timeMs,
          compileError: data.compileError,
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          actualOutput: errMsg,
          status: 'RE' as const,
          compileError: errMsg,
        };
      }
    },
    []
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden select-text border border-white/10">
      {/* Layer 1 (z-index: 0): Wallpaper Image */}
      <div className="ide-wallpaper-layer" />

      {/* Layer 2 (z-index: 1): Backdrop Filter Blur + Opacity */}
      <div className="ide-backdrop-layer" />

      {/* Layer 3 (z-index: 2): Main IDE Interface */}
      <div className="ide-content-layer">
        <TopBar
          language={language}
          onLanguageChange={handleLanguageChange}
          onRunAll={handleRunAll}
          isRunning={isRunning}
          onOpenSettings={() => setIsSettingsOpen(true)}
          currentTheme={themeConfig.theme}
          onJsonPrettify={() => handleJsonTransform('prettify')}
          onJsonMinify={() => handleJsonTransform('minify')}
          onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
          onOpenFilesFromExplorer={handleOpenFilesFromExplorer}
          onSaveFile={handleSaveFile}
          onSaveFileAs={handleSaveFileAs}
          autoSaveEnabled={autoSaveEnabled}
          onToggleAutoSave={handleToggleAutoSave}
        />

        {/* Split Workspace: Left Multi-Tab Monaco Editor | Right Multi-TestCase Judge / HTML Live Sandbox */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          <section className="lg:col-span-7 h-full min-h-0 border-b lg:border-b-0 lg:border-r border-white/10">
            <EditorPane
              tabs={tabs}
              activeTabId={activeTab?.id || ''}
              onSelectTab={(id) => {
                if (autoSaveEnabled && tabs.some((t) => t.isDirty)) {
                  flushAutoSave(tabs);
                }
                setActiveTabId(id);
                setCompileError(null);
              }}
              onAddTab={handleAddTab}
              onCloseTab={handleCloseTab}
              onRenameTab={handleRenameTab}
              onReorderTabs={handleReorderTabs}
              onChangeCode={handleCodeChange}
              onSaveShortcut={handleSaveFile}
              theme={themeConfig.theme}
              statusMessage={statusMessage}
              snippets={snippets}
              autoSaveEnabled={autoSaveEnabled}
              autoSaveStatus={autoSaveStatus}
              lastAutoSaveTime={lastAutoSaveTime}
            />
          </section>

          <section className="lg:col-span-5 h-full min-h-0">
            <TestCasePane
              language={language}
              code={currentCode}
              tabs={tabs}
              activeTabId={activeTab?.id || ''}
              testCases={testCases}
              onChangeTestCases={setTestCases}
              onRunSingleTestCase={handleRunSingleTestCase}
              onExecuteSingleCode={handleExecuteSingleCode}
              compileError={compileError}
            />
          </section>
        </main>
      </div>

      {/* New File Picker Modal (Ctrl + N) */}
      {isNewFileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsNewFileModalOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsNewFileModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/95 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                New File (Ctrl+N)
              </span>
              <button
                type="button"
                onClick={() => setIsNewFileModalOpen(false)}
                className="rounded-lg px-2 py-0.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                Esc
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={newFileCustomName}
              onChange={(e) => setNewFileCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTabWithLang(language, newFileCustomName);
                } else if (e.key === 'Escape') {
                  setIsNewFileModalOpen(false);
                }
              }}
              placeholder="Tên file tùy chọn (VD: bai1, input.txt)... hoặc chọn loại bên dưới"
              className="mb-3 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />

            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(LANGUAGE_META) as SupportedLanguage[]).map((langKey) => {
                const meta = LANGUAGE_META[langKey];
                const isCurrent = langKey === language;
                return (
                  <button
                    key={langKey}
                    type="button"
                    onClick={() => handleCreateTabWithLang(langKey, newFileCustomName)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-3 transition ${
                      isCurrent
                        ? 'border-indigo-500/60 bg-indigo-600/20 text-white hover:bg-indigo-600/35'
                        : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-indigo-400/50 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="rounded bg-indigo-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-300">
                      {meta.ext}
                    </span>
                    <span className="text-xs font-semibold">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wallpaper Blur & Theme Modal */}
      <ThemeModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={themeConfig}
        onChange={setThemeConfig}
      />

      {/* Editable Custom Code Templates & User Snippets Modal */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        activeLanguage={language}
        currentEditorCode={currentCode}
        customTemplates={customTemplates}
        factoryTemplates={FACTORY_CODE_TEMPLATES}
        onSaveTemplates={setCustomTemplates}
        onApplyTemplateToActiveTab={handleApplyTemplateToActiveTab}
        snippets={snippets}
        onSaveSnippets={setSnippets}
      />
    </div>
  );
};

export default App;
