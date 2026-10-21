import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode2,
  Save,
  RotateCcw,
  CopyCheck,
  ArrowDownToLine,
  Plus,
  Trash2,
  Braces,
} from 'lucide-react';
import { SupportedLanguage, LANGUAGE_META } from './TopBar';

export interface CustomSnippet {
  id: string;
  prefix: string;
  description: string;
  language: SupportedLanguage | 'all';
  body: string;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLanguage: SupportedLanguage;
  currentEditorCode: string;
  customTemplates: Record<SupportedLanguage, string>;
  factoryTemplates: Record<SupportedLanguage, string>;
  onSaveTemplates: (next: Record<SupportedLanguage, string>) => void;
  onApplyTemplateToActiveTab: (lang: SupportedLanguage, code: string) => void;
  snippets: CustomSnippet[];
  onSaveSnippets: (next: CustomSnippet[]) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  activeLanguage,
  currentEditorCode,
  customTemplates,
  factoryTemplates,
  onSaveTemplates,
  onApplyTemplateToActiveTab,
  snippets,
  onSaveSnippets,
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'snippets'>('templates');
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(activeLanguage);
  const [draftTemplates, setDraftTemplates] = useState<Record<SupportedLanguage, string>>(customTemplates);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // New Snippet Form State
  const [newPrefix, setNewPrefix] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLang, setNewLang] = useState<SupportedLanguage | 'all'>(activeLanguage);
  const [newBody, setNewBody] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedLang(activeLanguage);
      setNewLang(activeLanguage);
      setDraftTemplates(customTemplates);
      setSavedNotice(null);
    }
  }, [isOpen, activeLanguage, customTemplates]);

  if (!isOpen) return null;

  const flashNotice = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleSaveCurrentDraft = () => {
    onSaveTemplates(draftTemplates);
    flashNotice(`Saved default template for ${LANGUAGE_META[selectedLang].label}!`);
  };

  const handleUseEditorAsTemplate = () => {
    const next = { ...draftTemplates, [selectedLang]: currentEditorCode };
    setDraftTemplates(next);
    onSaveTemplates(next);
    flashNotice('Captured active editor code as default template!');
  };

  const handleResetFactory = () => {
    const next = { ...draftTemplates, [selectedLang]: factoryTemplates[selectedLang] };
    setDraftTemplates(next);
    onSaveTemplates(next);
    flashNotice('Restored factory default template!');
  };

  const handleApplyToTab = () => {
    onSaveTemplates(draftTemplates);
    onApplyTemplateToActiveTab(selectedLang, draftTemplates[selectedLang]);
    onClose();
  };

  const handleAddSnippet = () => {
    const cleanPrefix = newPrefix.trim();
    if (!cleanPrefix || !newBody.trim()) {
      flashNotice('Please enter both a Trigger Prefix and Snippet Code!');
      return;
    }

    const nextSnippet: CustomSnippet = {
      id: `snip-${Date.now()}`,
      prefix: cleanPrefix,
      description: newDesc.trim() || cleanPrefix,
      language: newLang,
      body: newBody,
    };

    onSaveSnippets([...snippets, nextSnippet]);
    setNewPrefix('');
    setNewDesc('');
    setNewBody('');
    flashNotice(`Added snippet "${cleanPrefix}"!`);
  };

  const handleDeleteSnippet = (id: string) => {
    onSaveSnippets(snippets.filter((s) => s.id !== id));
    flashNotice('Deleted snippet.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-slate-900/95 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <FileCode2 className="w-5 h-5 text-indigo-400" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'templates'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Starter Templates
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('snippets')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'snippets'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Braces className="w-3.5 h-3.5" />
                Custom Snippets ({snippets.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {savedNotice && (
              <span className="text-xs font-medium text-emerald-400">
                ✓ {savedNotice}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {activeTab === 'templates' ? (
          <>
            {/* Language Selector Tabs */}
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-6 py-2.5">
              <div className="flex items-center gap-1.5">
                {(Object.keys(LANGUAGE_META) as SupportedLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLang(lang)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      selectedLang === lang
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {LANGUAGE_META[lang].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Editor Textarea */}
            <div className="flex-1 p-6 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Template Content ({LANGUAGE_META[selectedLang].label})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUseEditorAsTemplate}
                    className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 hover:bg-indigo-500/25 px-2.5 py-1 text-xs font-medium text-indigo-300 transition"
                    title="Copy code from the currently open editor tab into this template"
                  >
                    <CopyCheck className="w-3.5 h-3.5" />
                    Use Active Tab Code
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFactory}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs text-slate-300 transition"
                    title="Restore built-in factory template"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore Default
                  </button>
                </div>
              </div>

              <textarea
                rows={14}
                value={draftTemplates[selectedLang] ?? ''}
                onChange={(e) =>
                  setDraftTemplates((prev) => ({
                    ...prev,
                    [selectedLang]: e.target.value,
                  }))
                }
                spellCheck={false}
                className="w-full rounded-xl border border-white/15 bg-slate-950/90 p-4 font-mono text-xs leading-relaxed text-slate-100 focus:border-indigo-500 focus:outline-none resize-y"
                placeholder="Enter starter template code for this language..."
              />
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-slate-950/70 px-6 py-3.5">
              <button
                type="button"
                onClick={handleApplyToTab}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-4 py-2 text-xs font-semibold text-emerald-300 transition"
              >
                <ArrowDownToLine className="w-4 h-4" />
                Save & Insert into Active Tab
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-medium text-slate-300 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentDraft}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition"
                >
                  <Save className="w-4 h-4" />
                  Save Template
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Custom Snippets Tab */
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* Create New Snippet Box */}
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Create New Custom Snippet
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Trigger Prefix (e.g. <code className="text-indigo-300">fori</code>)
                  </label>
                  <input
                    type="text"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value)}
                    placeholder="Trigger word..."
                    className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Language Scope
                  </label>
                  <select
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value as SupportedLanguage | 'all')}
                    className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="all">All Languages</option>
                    <option value="cpp">C++17</option>
                    <option value="rust">Rust</option>
                    <option value="python">Python 3</option>
                    <option value="html">HTML5</option>
                    <option value="json">JSON</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Short description..."
                    className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400">
                    Snippet Code Body (Supports <code className="text-indigo-300">$1</code>, <code className="text-indigo-300">$2</code> tabstops)
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewBody(currentEditorCode)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    Copy from Active Editor
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  spellCheck={false}
                  placeholder="Enter the code that will be inserted when typing the trigger prefix..."
                  className="w-full rounded-lg border border-white/15 bg-slate-900 p-3 font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-y"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddSnippet}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Snippet
                </button>
              </div>
            </div>

            {/* Saved Custom Snippets List */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Your Saved Snippets ({snippets.length})
              </div>

              {snippets.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-xs text-slate-400">
                  No custom snippets yet. Add your own snippet above to expand it in the editor!
                </div>
              ) : (
                snippets.map((snip) => (
                  <div
                    key={snip.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3.5"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300">
                          {snip.prefix}
                        </span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                          {snip.language === 'all' ? 'All' : LANGUAGE_META[snip.language].label}
                        </span>
                        <span className="text-xs text-slate-400 truncate">
                          {snip.description}
                        </span>
                      </div>
                      <pre className="rounded-lg bg-slate-900/90 p-2 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-24">
                        {snip.body}
                      </pre>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSnippet(snip.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
                      title="Delete Snippet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
