import React, { useEffect, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { Plus, X, HardDrive, Edit3 } from 'lucide-react';
import { SupportedLanguage, LANGUAGE_META } from './TopBar';
import { IdeThemeId } from './ThemeModal';

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
  onChangeCode: (value: string) => void;
  onSaveShortcut: () => void;
  theme: IdeThemeId;
  statusMessage?: string | null;
}

let providersRegistered = false;

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

function registerIntelliSenseProviders(monaco: typeof Monaco) {
  if (providersRegistered) return;
  providersRegistered = true;

  if (monaco.languages.json?.jsonDefaults) {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: true,
    });
  }

  if (monaco.languages.html?.htmlDefaults) {
    monaco.languages.html.htmlDefaults.setOptions({
      suggest: { html5: true },
    });
  }

  monaco.languages.registerCompletionItemProvider('cpp', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const stlKeywords = [
        'vector',
        'priority_queue',
        'sort',
        'lower_bound',
        'upper_bound',
        'unordered_map',
        'unordered_set',
        'map',
        'set',
        'queue',
        'stack',
        'deque',
        'pair',
        'make_pair',
        'push_back',
        'emplace_back',
        'cin',
        'cout',
        'endl',
        'long long',
        'ios_base::sync_with_stdio(false);',
      ];

      const suggestions: Monaco.languages.CompletionItem[] = stlKeywords.map((kw) => ({
        label: kw,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: kw,
        detail: 'C++17 STL / Keyword',
        range,
      }));

      suggestions.push(
        {
          label: 'cptemplate',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Competitive Programming Full C++17 Template',
          insertText: [
            '#include <bits/stdc++.h>',
            'using namespace std;',
            'using ll = long long;',
            '',
            'void solve() {',
            '\t${1:// Write logic here}',
            '}',
            '',
            'int main() {',
            '\tios_base::sync_with_stdio(false);',
            '\tcin.tie(nullptr);',
            '\tsolve();',
            '\treturn 0;',
            '}',
          ].join('\n'),
          range,
        },
        {
          label: 'fori',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'For loop 0..n',
          insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t${3}\n}',
          range,
        },
        {
          label: 'fastio',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Fast I/O C++',
          insertText: 'ios_base::sync_with_stdio(false);\ncin.tie(nullptr);',
          range,
        }
      );

      return { suggestions };
    },
  });

  monaco.languages.registerCompletionItemProvider('rust', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const rustItems = [
        'println!',
        'vec!',
        'String::new()',
        'std::io::stdin()',
        'read_line',
        'unwrap()',
        'collect::<Vec<_>>()',
        'HashMap',
        'BTreeSet',
        'BinaryHeap',
      ];

      const suggestions: Monaco.languages.CompletionItem[] = rustItems.map((item) => ({
        label: item,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: item,
        detail: 'Rust Stdlib',
        range,
      }));

      suggestions.push(
        {
          label: 'cptemplate',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Rust Fast Stdin Template',
          insertText: [
            'use std::io::{self, Read};',
            '',
            'fn main() {',
            '\tlet mut input = String::new();',
            '\tio::stdin().read_to_string(&mut input).unwrap();',
            '\tlet mut tokens = input.split_whitespace();',
            '\t${1}',
            '}',
          ].join('\n'),
          range,
        },
        {
          label: 'fori',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Rust range loop',
          insertText: 'for ${1:i} in 0..${2:n} {\n\t${3}\n}',
          range,
        }
      );

      return { suggestions };
    },
  });

  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const pyKeywords = [
        'sys.stdin.read',
        'input',
        'print',
        'enumerate',
        'zip',
        'sorted',
        'collections.deque',
        'heapq.heappush',
        'heapq.heappop',
        'bisect.bisect_left',
        'math.gcd',
      ];

      const suggestions: Monaco.languages.CompletionItem[] = pyKeywords.map((kw) => ({
        label: kw,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: kw,
        detail: 'Python 3 Built-in / Stdlib',
        range,
      }));

      suggestions.push(
        {
          label: 'cptemplate',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Python 3 Fast I/O Template',
          insertText: [
            'import sys',
            '',
            'def solve():',
            '\tdata = sys.stdin.read().split()',
            '\tif not data:',
            '\t\treturn',
            '\t${1:# Write logic here}',
            '',
            'if __name__ == "__main__":',
            '\tsolve()',
          ].join('\n'),
          range,
        },
        {
          label: 'fori',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Python for i in range(n)',
          insertText: 'for ${1:i} in range(${2:n}):\n\t${3:pass}',
          range,
        },
        {
          label: 'fastio',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'sys.stdin.readline fast input',
          insertText: 'import sys\ninput = sys.stdin.readline',
          range,
        }
      );

      return { suggestions };
    },
  });
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  onChangeCode,
  onSaveShortcut,
  theme,
  statusMessage,
}) => {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const saveCallbackRef = useRef(onSaveShortcut);
  saveCallbackRef.current = onSaveShortcut;

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleEditorMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    registerCustomThemes(monaco);
    registerIntelliSenseProviders(monaco);
    monaco.editor.setTheme(theme);

    // Bind Ctrl+S / Cmd+S inside Monaco Editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCallbackRef.current();
    });
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme);
    }
  }, [theme]);

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
      {/* Multi-File Tabs Bar (VSCode style) */}
      <div className="flex items-center border-b border-white/10 bg-slate-950/65 px-2 pt-1.5 gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab?.id;
          const badge = LANGUAGE_META[tab.language]?.badge || 'CODE';
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              onDoubleClick={() => startRename(tab)}
              title={
                tab.filePath
                  ? `${tab.filePath} (Double-click to rename tab)`
                  : `${tab.name} (Unsaved — Double-click to rename tab)`
              }
              className={`group flex items-center gap-2 rounded-t-xl border-t border-x px-3 py-1.5 text-xs cursor-pointer transition select-none flex-shrink-0 ${
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
                  title="Unsaved changes (Press Ctrl+S to save)"
                />
              )}

              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
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
          className="ml-1 mb-1 flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-indigo-600/30 hover:border-indigo-500/40 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white transition flex-shrink-0"
          title="Create a new file tab using the current language template"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New File</span>
        </button>
      </div>

      {/* File Path & Status Subheader */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/45 px-4 py-1 text-[11px] text-slate-400">
        <div className="flex items-center gap-2 min-w-0">
          <HardDrive className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
          <span className="font-mono text-slate-300 truncate">
            {activeTab?.filePath
              ? `${activeTab.filePath} (Linked — Press Ctrl+S to save, Ctrl+O to open)`
              : `${activeTab?.name || 'untitled'} (In-Memory Buffer — Press Ctrl+S to save, Ctrl+O to open)`}
          </span>
          <button
            type="button"
            onClick={() => activeTab && startRename(activeTab)}
            className="text-slate-500 hover:text-indigo-300 transition"
            title="Rename tab"
          >
            <Edit3 className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {statusMessage ? (
            <span className="font-medium text-emerald-400">{statusMessage}</span>
          ) : (
            <span className="hidden sm:inline text-slate-400">
              Snippets: <code className="text-indigo-300">cptemplate</code>,{' '}
              <code className="text-indigo-300">fori</code>,{' '}
              <code className="text-indigo-300">fastio</code>
            </span>
          )}
        </div>
      </div>

      {/* Monaco Container */}
      <div className="flex-1 min-h-0">
        <Editor
          path={activeTab?.id}
          height="100%"
          language={activeTab?.language || 'cpp'}
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
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            parameterHints: { enabled: true },
            bracketPairColorization: { enabled: true },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
          }}
        />
      </div>
    </div>
  );
};
