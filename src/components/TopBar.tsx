import React from 'react';
import {
  Play,
  Settings,
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
import { IdeThemeId } from './ThemeModal';

export type SupportedLanguage = 'cpp' | 'rust' | 'python' | 'html' | 'json' | 'text';

export const LANGUAGE_META: Record<
  SupportedLanguage,
  { label: string; badge: string; ext: string }
> = {
  cpp: {
    label: 'C++',
    badge: 'C++',
    ext: '.cpp',
  },
  rust: {
    label: 'Rust',
    badge: 'RS',
    ext: '.rs',
  },
  python: {
    label: 'Python',
    badge: 'PY',
    ext: '.py',
  },
  html: {
    label: 'HTML',
    badge: 'HTML',
    ext: '.html',
  },
  json: {
    label: 'JSON',
    badge: 'JSON',
    ext: '.json',
  },
  text: {
    label: 'Text',
    badge: 'TXT',
    ext: '.txt',
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
  autoSaveEnabled: boolean;
  onToggleAutoSave: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  language,
  onRunAll,
  isRunning,
  onOpenSettings,
  onJsonPrettify,
  onJsonMinify,
  onOpenTemplateModal,
  onOpenFilesFromExplorer,
  onSaveFile,
  onSaveFileAs,
  autoSaveEnabled,
  onToggleAutoSave,
}) => {
  const desktopApi = typeof window !== 'undefined' ? window.hidemDesktop : undefined;

  return (
    <header className="app-drag-region flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950/75 pl-4 pr-2 py-1.5 backdrop-blur-md select-none">
      {/* Left: Brand Title */}
      <div className="flex items-center">
        <span className="text-xs font-extrabold tracking-wider text-slate-200">
          HiDeM
        </span>
      </div>

      {/* Right: Minimal Icon Controls */}
      <div className="app-no-drag flex items-center gap-1">
        {/* Compact File Group */}
        <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-slate-900/70 p-0.5">
          <button
            type="button"
            onClick={onOpenFilesFromExplorer}
            className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Open (Ctrl+O)"
          >
            <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
          </button>

          <button
            type="button"
            onClick={onSaveFile}
            className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Save (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5 text-sky-400" />
          </button>

          <button
            type="button"
            onClick={onSaveFileAs}
            className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition"
            title="Save As (Ctrl+Shift+S)"
          >
            <FileDown className="h-3.5 w-3.5 text-indigo-300" />
          </button>

          <div className="h-3.5 w-px bg-white/10 mx-0.5" />

          <button
            type="button"
            onClick={onToggleAutoSave}
            className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition ${
              autoSaveEnabled
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={autoSaveEnabled ? 'Auto Save: ON' : 'Auto Save: OFF'}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full transition ${
                autoSaveEnabled
                  ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.9)]'
                  : 'bg-slate-600'
              }`}
            />
            <span>Auto</span>
          </button>
        </div>

        {/* Templates & Snippets (Icon-only) */}
        <button
          type="button"
          onClick={onOpenTemplateModal}
          className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 p-1.5 text-slate-300 hover:text-white transition"
          title="Templates & Snippets"
        >
          <FileCode2 className="h-3.5 w-3.5 text-indigo-400" />
        </button>

        {language === 'json' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onJsonPrettify}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 hover:bg-emerald-500/25 p-1.5 text-emerald-300 transition"
              title="Prettify JSON"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onJsonMinify}
              className="rounded-lg border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 p-1.5 text-amber-300 transition"
              title="Minify JSON"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onRunAll}
          disabled={isRunning}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition"
          title="Run Code"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
          <span>Run</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 p-1.5 text-slate-300 hover:text-white transition"
          title="Theme & Wallpaper"
        >
          <Settings className="h-3.5 w-3.5 text-slate-300" />
        </button>

        {/* Native Frameless Desktop Window Controls */}
        {desktopApi?.isElectron && (
          <div className="flex items-center ml-1 pl-1 border-l border-white/10">
            <button
              type="button"
              onClick={() => desktopApi.minimizeWindow()}
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Minimize"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => desktopApi.toggleMaximizeWindow()}
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              title="Maximize"
            >
              <Square className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => desktopApi.closeWindow()}
              className="rounded-md p-1.5 text-slate-400 hover:bg-rose-600 hover:text-white transition"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
