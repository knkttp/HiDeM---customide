import React from 'react';
import {
  Play,
  Settings,
  Code2,
  Sparkles,
  Minimize2,
  AlignLeft,
  Loader2,
  FolderOpen,
  Save,
  FileDown,
  FileCode2,
  Minus,
  Square,
  X,
} from 'lucide-react';
import { IdeThemeId, IDE_THEMES } from './ThemeModal';

export type SupportedLanguage = 'cpp' | 'rust' | 'python' | 'html' | 'json';

export const LANGUAGE_META: Record<
  SupportedLanguage,
  { label: string; badge: string; ext: string; cmdHint: string }
> = {
  cpp: {
    label: 'C++17',
    badge: 'C++',
    ext: '.cpp',
    cmdHint: 'g++ -O2 -std=c++17 main.cpp -o main.out && ./main.out',
  },
  rust: {
    label: 'Rust',
    badge: 'RS',
    ext: '.rs',
    cmdHint: 'rustc -O main.rs -o main_rs.out && ./main_rs.out',
  },
  python: {
    label: 'Python 3',
    badge: 'PY',
    ext: '.py',
    cmdHint: 'python3 -u main.py',
  },
  html: {
    label: 'HTML5',
    badge: 'HTML',
    ext: '.html',
    cmdHint: 'Live DOM Sandbox <iframe sandbox="allow-scripts">',
  },
  json: {
    label: 'JSON',
    badge: 'JSON',
    ext: '.json',
    cmdHint: 'JSON.parse(code) + JSON.stringify(obj, null, 2)',
  },
};

interface TopBarProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onRunAll: () => void;
  isRunning: boolean;
  onOpenSettings: () => void;
  currentTheme: IdeThemeId;
  onJsonPrettify?: () => void;
  onJsonMinify?: () => void;
  onOpenTemplateModal: () => void;
  onOpenFilesFromExplorer: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  language,
  onLanguageChange,
  onRunAll,
  isRunning,
  onOpenSettings,
  currentTheme,
  onJsonPrettify,
  onJsonMinify,
  onOpenTemplateModal,
  onOpenFilesFromExplorer,
  onSaveFile,
  onSaveFileAs,
}) => {
  const themeObj = IDE_THEMES.find((t) => t.id === currentTheme);
  const desktopApi = typeof window !== 'undefined' ? window.hidemDesktop : undefined;

  return (
    <header className="app-drag-region flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/75 pl-4 pr-2 py-2 backdrop-blur-md select-none">
      {/* Left: Brand & Language Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
            <Code2 className="h-4 w-4 text-white" />
          </div>
          <div className="hidden xl:block">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold tracking-tight text-white">
                HiDeM
              </span>
              <span className="rounded-md bg-indigo-500/20 border border-indigo-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                Desktop IDE
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              {LANGUAGE_META[language].cmdHint}
            </p>
          </div>
        </div>

        {/* Language Pills */}
        <div className="app-no-drag flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/75 p-1">
          {(Object.keys(LANGUAGE_META) as SupportedLanguage[]).map((langKey) => {
            const active = language === langKey;
            return (
              <button
                key={langKey}
                type="button"
                onClick={() => onLanguageChange(langKey)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {LANGUAGE_META[langKey].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: In-App File Actions, Templates, JSON Tools, Run All, Theme Settings, Native Window Controls */}
      <div className="app-no-drag flex items-center gap-1.5">
        {/* In-App File Operations (Ctrl+O / Ctrl+S) */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/70 p-1">
          <button
            type="button"
            onClick={onOpenFilesFromExplorer}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition"
            title="Open one or multiple files (Ctrl+O)"
          >
            <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
            <span>Open</span>
            <kbd className="hidden sm:inline rounded bg-white/10 px-1 py-0.5 text-[10px] font-mono text-slate-400">
              Ctrl+O
            </kbd>
          </button>

          <button
            type="button"
            onClick={onSaveFile}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition"
            title="Save active file (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5 text-sky-400" />
            <span>Save</span>
            <kbd className="hidden sm:inline rounded bg-white/10 px-1 py-0.5 text-[10px] font-mono text-slate-400">
              Ctrl+S
            </kbd>
          </button>

          <button
            type="button"
            onClick={onSaveFileAs}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Save as a new file (Ctrl+Shift+S)"
          >
            <FileDown className="h-3.5 w-3.5 text-indigo-300" />
            <span className="hidden md:inline">Save As...</span>
          </button>
        </div>

        {/* Custom Code Templates Manager */}
        <button
          type="button"
          onClick={onOpenTemplateModal}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
          title="Edit or insert starter Code Templates"
        >
          <FileCode2 className="h-3.5 w-3.5 text-indigo-400" />
          <span>Templates</span>
        </button>

        {language === 'json' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onJsonPrettify}
              className="flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition"
              title="Format JSON with 2-space indentation"
            >
              <AlignLeft className="h-3.5 w-3.5" />
              Prettify
            </button>
            <button
              type="button"
              onClick={onJsonMinify}
              className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition"
              title="Minify JSON into a single line"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Minify
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onRunAll}
          disabled={isRunning}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              Run All
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
          title="Configure Wallpaper, Backdrop Blur & Code Theme"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span className="hidden 2xl:inline">{themeObj?.name || 'Theme'}</span>
          <Settings className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {/* Native Frameless Desktop Window Controls (Minimize / Maximize / Close) */}
        {desktopApi?.isElectron && (
          <div className="flex items-center ml-2 pl-2 border-l border-white/10">
            <button
              type="button"
              onClick={() => desktopApi.minimizeWindow()}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Minimize"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => desktopApi.toggleMaximizeWindow()}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Maximize / Restore"
            >
              <Square className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => desktopApi.closeWindow()}
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-600 hover:text-white transition"
              title="Close HiDeM"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
