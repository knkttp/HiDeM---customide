import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode2,
  Save,
  RotateCcw,
  CopyCheck,
  ArrowDownToLine,
} from 'lucide-react';
import { SupportedLanguage, LANGUAGE_META } from './TopBar';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLanguage: SupportedLanguage;
  currentEditorCode: string;
  customTemplates: Record<SupportedLanguage, string>;
  factoryTemplates: Record<SupportedLanguage, string>;
  onSaveTemplates: (next: Record<SupportedLanguage, string>) => void;
  onApplyTemplateToActiveTab: (lang: SupportedLanguage, code: string) => void;
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
}) => {
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(activeLanguage);
  const [draftTemplates, setDraftTemplates] = useState<Record<SupportedLanguage, string>>(customTemplates);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedLang(activeLanguage);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-slate-900/95 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileCode2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Code Templates Manager (Custom Starter Code)
              </h2>
              <p className="text-xs text-slate-400">
                Customize the default code used when creating new files for each language
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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

          {savedNotice && (
            <span className="text-xs font-medium text-emerald-400 animate-pulse">
              ✓ {savedNotice}
            </span>
          )}
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
      </div>
    </div>
  );
};
