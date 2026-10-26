import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { Plus, X } from 'lucide-react';
import { SupportedLanguage, LANGUAGE_META } from './TopBar';
import { IdeThemeId } from './ThemeModal';
import { CustomSnippet } from './TemplateModal';

export interface CodeFileTab {
  id: string;
  name: string;
  language: SupportedLanguage;
  code: string;
  filePath?: string;
  isDirty?: boolean;
}

interface EditorPaneProps {
  tabs: CodeFileTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onRenameTab: (id: string, newName: string) => void;
  onReorderTabs?: (sourceId: string, targetId: string) => void;
  onChangeCode: (value: string) => void;
  onSaveShortcut: () => void;
  theme: IdeThemeId;
  statusMessage?: string | null;
  snippets: CustomSnippet[];
  autoSaveEnabled?: boolean;
  autoSaveStatus?: 'idle' | 'saving' | 'saved';
  lastAutoSaveTime?: string | null;
}

// Code::Blocks style core C/C++ & STL identifiers (flat, lightweight, only triggered after typing >= 3 chars)
const CODEBLOCKS_CPP_IDENTIFIERS = [
  'include', 'bits/stdc++.h', 'using', 'namespace', 'std', 'long', 'int', 'double', 'float',
  'char', 'bool', 'void', 'auto', 'const', 'static', 'struct', 'class', 'return', 'break',
  'continue', 'while', 'for', 'ifelse', 'switch', 'case', 'default', 'typedef', 'typename',
  'vector', 'pair', 'map', 'set', 'unordered_map', 'unordered_set', 'multiset', 'queue',
  'priority_queue', 'stack', 'deque', 'string', 'bitset', 'array', 'tuple',
  'push_back', 'emplace_back', 'pop_back', 'front', 'back', 'begin', 'end', 'rbegin', 'rend',
  'size', 'empty', 'clear', 'insert', 'erase', 'find', 'count', 'lower_bound', 'upper_bound',
  'sort', 'reverse', 'swap', 'min', 'max', 'abs', 'gcd', 'lcm', 'memset', 'memcpy',
  'cin', 'cout', 'cerr', 'endl', 'ios_base', 'sync_with_stdio', 'tie', 'nullptr', 'first', 'second',
];

let completionDisposables: Monaco.IDisposable[] = [];

function registerCustomThemes(monaco: typeof Monaco) {
  monaco.editor.defineTheme('one-dark-pro', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'string', foreground: '98c379' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
    ],
    colors: {
      'editor.background': '#00000000',
      'editor.foreground': '#abb2bf',
      'editorLineNumber.foreground': '#495162',
      'editorLineNumber.activeForeground': '#abb2bf',
      'editor.selectionBackground': '#3e445188',
      'editor.lineHighlightBackground': '#2c313c55',
    },
  });

  monaco.editor.defineTheme('dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
      { token: 'function', foreground: '50fa7b' },
    ],
    colors: {
      'editor.background': '#00000000',
      'editor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#f8f8f2',
      'editor.selectionBackground': '#44475a88',
      'editor.lineHighlightBackground': '#44475a44',
    },
  });

  monaco.editor.defineTheme('monokai-pro', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '727072', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff6188' },
      { token: 'number', foreground: 'ab9df2' },
      { token: 'string', foreground: 'ffd866' },
      { token: 'type', foreground: '78dce8', fontStyle: 'italic' },
      { token: 'function', foreground: 'a9dc76' },
    ],
    colors: {
      'editor.background': '#00000000',
      'editor.foreground': '#fcfcfa',
      'editorLineNumber.foreground': '#5b595c',
      'editorLineNumber.activeForeground': '#fcfcfa',
      'editor.selectionBackground': '#5b595c77',
      'editor.lineHighlightBackground': '#403e4155',
    },
  });

  monaco.editor.defineTheme('github-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'type', foreground: 'ffa657' },
      { token: 'function', foreground: 'd2a8ff' },
    ],
    colors: {
      'editor.background': '#00000000',
      'editor.foreground': '#c9d1d9',
      'editorLineNumber.foreground': '#6e7681',
      'editorLineNumber.activeForeground': '#c9d1d9',
      'editor.selectionBackground': '#1f6feb66',
      'editor.lineHighlightBackground': '#161b2266',
    },
  });

  monaco.editor.defineTheme('solarized-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '93a1a1', fontStyle: 'italic' },
      { token: 'keyword', foreground: '859900' },
      { token: 'number', foreground: 'd33682' },
      { token: 'string', foreground: '2aa198' },
      { token: 'type', foreground: 'b58900' },
      { token: 'function', foreground: '268bd2' },
    ],
    colors: {
      'editor.background': '#00000000',
      'editor.foreground': '#657b83',
      'editorLineNumber.foreground': '#93a1a1',
      'editorLineNumber.activeForeground': '#073642',
      'editor.selectionBackground': '#eee8d588',
      'editor.lineHighlightBackground': '#eee8d544',
    },
  });
}

function registerCodeBlocksAndUserSnippets(
  monaco: typeof Monaco,
  userSnippets: CustomSnippet[]
) {
  // Dispose previous providers
  for (const d of completionDisposables) {
    d.dispose();
  }
  completionDisposables = [];

  const languages: SupportedLanguage[] = ['cpp', 'rust', 'python', 'html', 'json', 'text'];

  for (const lang of languages) {
    const monacoLang = lang === 'text' ? 'plaintext' : lang;
    const disposable = monaco.languages.registerCompletionItemProvider(monacoLang, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: Monaco.languages.CompletionItem[] = [];

        // 1. User-created Custom Snippets for this language
        const matchingSnippets = userSnippets.filter(
          (s) => s.language === 'all' || s.language === lang
        );
        for (const snip of matchingSnippets) {
          suggestions.push({
            label: snip.prefix,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: snip.description,
            insertText: snip.body,
            range,
          });
        }

        // 2. Code::Blocks style lightweight identifier completion (triggers cleanly after >= 2 chars)
        if (lang === 'cpp' && word.word.length >= 2) {
          for (const kw of CODEBLOCKS_CPP_IDENTIFIERS) {
            if (kw.startsWith(word.word) && kw !== word.word) {
              suggestions.push({
                label: kw,
                kind: monaco.languages.CompletionItemKind.Text,
                insertText: kw,
                range,
              });
            }
          }
        }

        return { suggestions };
      },
    });

    completionDisposables.push(disposable);
  }
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  onReorderTabs,
  onChangeCode,
  onSaveShortcut,
  theme,
  statusMessage,
  snippets,
  autoSaveEnabled = true,
  autoSaveStatus = 'idle',
  lastAutoSaveTime,
}) => {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const saveCallbackRef = useRef(onSaveShortcut);
  saveCallbackRef.current = onSaveShortcut;
  const addTabCallbackRef = useRef(onAddTab);
  addTabCallbackRef.current = onAddTab;

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleEditorMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    registerCustomThemes(monaco);
    registerCodeBlocksAndUserSnippets(monaco, snippets);
    monaco.editor.setTheme(theme);

    // Bind Ctrl+S / Cmd+S and Ctrl+N / Cmd+N inside Monaco Editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCallbackRef.current();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => {
      addTabCallbackRef.current();
    });

    // Remove tooltip titles from find widget buttons to prevent hover flicker
    const domNode = editor.getDomNode();
    if (domNode) {
      const observer = new MutationObserver(() => {
        const findButtons = domNode.querySelectorAll('.find-widget .button, .find-widget input');
        findButtons.forEach((btn) => {
          if (btn.hasAttribute('title')) {
            btn.removeAttribute('title');
          }
        });
      });
      observer.observe(domNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
    }
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (monacoRef.current) {
      registerCodeBlocksAndUserSnippets(monacoRef.current, snippets);
    }
  }, [snippets]);

  const startRename = (tab: CodeFileTab) => {
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };

  const commitRename = () => {
    if (editingTabId && editingName.trim()) {
      onRenameTab(editingTabId, editingName.trim());
    }
    setEditingTabId(null);
  };

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden">
      {/* Multi-File Tabs Bar */}
      <div className="flex items-center border-b border-white/10 bg-slate-950/65 px-2 pt-1.5 gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab?.id;
          const isDragged = draggedTabId === tab.id;
          const badge = LANGUAGE_META[tab.language]?.badge || 'CODE';
          return (
            <div
              key={tab.id}
              draggable={editingTabId !== tab.id}
              onDragStart={(e) => {
                setDraggedTabId(tab.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', tab.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (draggedTabId && draggedTabId !== tab.id) {
                  onReorderTabs?.(draggedTabId, tab.id);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const srcId = draggedTabId || e.dataTransfer.getData('text/plain');
                if (srcId && srcId !== tab.id) {
                  onReorderTabs?.(srcId, tab.id);
                }
                setDraggedTabId(null);
              }}
              onDragEnd={() => setDraggedTabId(null)}
              onClick={() => onSelectTab(tab.id)}
              onDoubleClick={() => startRename(tab)}
              title={
                tab.filePath
                  ? `${tab.filePath} (Drag to reorder • Double-click to rename)`
                  : `${tab.name} (Drag to reorder • Double-click to rename)`
              }
              className={`group flex items-center gap-2 rounded-t-xl border-t border-x px-3 py-1.5 text-xs cursor-grab active:cursor-grabbing transition select-none flex-shrink-0 ${
                isDragged ? 'opacity-50 scale-[0.98] ' : ''
              }${
                isActive
                  ? 'border-indigo-500/50 bg-slate-900/90 text-white shadow-sm'
                  : 'border-transparent bg-slate-950/40 text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
              }`}
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  isActive
                    ? 'bg-indigo-500/25 text-indigo-300'
                    : 'bg-white/5 text-slate-400'
                }`}
              >
                {badge}
              </span>

              {editingTabId === tab.id ? (
                <input
                  type="text"
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-28 rounded bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-white border border-indigo-500 focus:outline-none"
                />
              ) : (
                <span className="font-mono text-xs max-w-[150px] truncate">
                  {tab.name}
                </span>
              )}

              {tab.isDirty && (
                <span
                  className="h-2 w-2 rounded-full bg-amber-400"
                  title="Unsaved changes (Ctrl+S)"
                />
              )}

              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      if (monacoRef.current) {
                        const model = monacoRef.current.editor.getModel(
                          monacoRef.current.Uri.parse(tab.id)
                        );
                        model?.dispose();
                      }
                    } catch {
                      // ignore
                    }
                    onCloseTab(tab.id);
                  }}
                  className="rounded p-0.5 text-slate-500 opacity-60 hover:bg-rose-500/25 hover:text-rose-300 group-hover:opacity-100 transition"
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* New File Tab Button */}
        <button
          type="button"
          onClick={onAddTab}
          className="ml-0.5 mb-1 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-indigo-600/30 hover:border-indigo-500/40 p-1 text-slate-300 hover:text-white transition flex-shrink-0"
          title="New File"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        {/* Minimal right-aligned status indicator */}
        <div className="ml-auto mb-1 pr-2 flex items-center gap-2 flex-shrink-0">
          {statusMessage ? (
            <span className="text-[11px] font-medium text-emerald-400">{statusMessage}</span>
          ) : (
            autoSaveEnabled && (
              <span
                className={`h-2 w-2 rounded-full transition ${
                  autoSaveStatus === 'saving' || activeTab?.isDirty
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-400/70'
                }`}
                title={
                  autoSaveStatus === 'saving' || activeTab?.isDirty
                    ? 'Saving...'
                    : lastAutoSaveTime
                    ? `Saved (${lastAutoSaveTime})`
                    : 'Auto-save ON'
                }
              />
            )
          )}
        </div>
      </div>

      {/* Monaco Container (Code::Blocks style lightweight completion) */}
      <div className="flex-1 min-h-0">
        <Editor
          path={activeTab?.id}
          height="100%"
          language={activeTab?.language === 'text' ? 'plaintext' : activeTab?.language || 'cpp'}
          value={activeTab?.code || ''}
          theme={theme}
          onMount={handleEditorMount}
          onChange={(val) => onChangeCode(val ?? '')}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: 'on',
            padding: { top: 14, bottom: 14 },
            // Code::Blocks-like completion: document words + custom snippets, no noisy parameter hints or hover popups
            wordBasedSuggestions: 'currentDocument',
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            quickSuggestionsDelay: 180,
            suggestOnTriggerCharacters: false,
            parameterHints: { enabled: false },
            hover: { enabled: false },
            inlineSuggest: { enabled: false },
            links: false,
            colorDecorators: false,
            codeLens: false,
            folding: false,
            occurrencesHighlight: 'off',
            selectionHighlight: false,
            renderValidationDecorations: 'off',
            snippetSuggestions: 'top',
            suggest: {
              showIcons: false,
              showStatusBar: false,
              preview: false,
              filterGraceful: false,
            },
            bracketPairColorization: { enabled: true },
            find: {
              addExtraSpaceOnTop: true,
              autoFindInSelection: 'never',
              seedSearchStringFromSelection: 'always',
              loop: true,
            },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
          }}
        />
      </div>
    </div>
  );
};
