import React from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Terminal,
  Eye,
} from 'lucide-react';
import { SupportedLanguage } from './TopBar';

export type JudgeStatus = 'IDLE' | 'RUNNING' | 'AC' | 'WA' | 'TLE' | 'RE';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  status: JudgeStatus;
  timeMs?: number;
}

interface TestCasePaneProps {
  language: SupportedLanguage;
  code: string;
  testCases: TestCase[];
  onChangeTestCases: (next: TestCase[]) => void;
  compileError?: string | null;
}

export const TestCasePane: React.FC<TestCasePaneProps> = ({
  language,
  code,
  testCases,
  onChangeTestCases,
  compileError,
}) => {
  const handleAddTestCase = () => {
    const nextId = `tc-${Date.now()}`;
    onChangeTestCases([
      ...testCases,
      {
        id: nextId,
        input: '',
        expectedOutput: '',
        actualOutput: '',
        status: 'IDLE',
      },
    ]);
  };

  const handleRemoveTestCase = (id: string) => {
    if (testCases.length <= 1) return;
    onChangeTestCases(testCases.filter((tc) => tc.id !== id));
  };

  const handleUpdateField = (
    id: string,
    field: 'input' | 'expectedOutput',
    value: string
  ) => {
    onChangeTestCases(
      testCases.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc))
    );
  };

  const renderStatusBadge = (tc: TestCase) => {
    switch (tc.status) {
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            RUNNING
          </span>
        );
      case 'AC':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            AC (Accepted) {tc.timeMs !== undefined ? `• ${tc.timeMs}ms` : ''}
          </span>
        );
      case 'WA':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
            <XCircle className="h-3 w-3" />
            WA (Wrong Answer) {tc.timeMs !== undefined ? `• ${tc.timeMs}ms` : ''}
          </span>
        );
      case 'TLE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
            <Clock className="h-3 w-3" />
            TLE (&gt;3000ms)
          </span>
        );
      case 'RE':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 border border-purple-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-purple-300">
            <AlertTriangle className="h-3 w-3" />
            RE (Runtime / Syntax Error)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
            IDLE
          </span>
        );
    }
  };

  // Live DOM Sandbox for HTML mode
  if (language === 'html') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950/35">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/50 px-4 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Eye className="h-4 w-4 text-indigo-400" />
            Live DOM Sandbox (<code className="text-indigo-300">sandbox="allow-scripts"</code>)
          </div>
          <span className="rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            Real-time Render
          </span>
        </div>
        <div className="flex-1 bg-white">
          <iframe
            title="HTML Live Sandbox"
            sandbox="allow-scripts"
            srcDoc={code}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

  const acCount = testCases.filter((tc) => tc.status === 'AC').length;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950/30">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/50 px-4 py-2">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            TEST CASE ({acCount}/{testCases.length} AC)
          </span>
        </div>

        <button
          type="button"
          onClick={handleAddTestCase}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 px-3 py-1 text-xs font-medium text-white transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Test Case
        </button>
      </div>

      {/* Compile Error Banner if any */}
      {compileError && (
        <div className="mx-4 mt-3 rounded-xl border border-rose-500/40 bg-rose-950/70 p-3 text-xs font-mono text-rose-200 whitespace-pre-wrap max-h-36 overflow-y-auto">
          <div className="font-bold text-rose-400 mb-1">Compiler / Validator Error:</div>
          {compileError}
        </div>
      )}

      {/* Test Case Cards List (3 Columns per Test Case) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {testCases.map((tc, index) => (
          <div
            key={tc.id}
            className={`rounded-2xl border p-4 transition backdrop-blur-sm ${
              tc.status === 'AC'
                ? 'border-emerald-500/40 bg-emerald-950/15'
                : tc.status === 'WA' || tc.status === 'RE'
                ? 'border-rose-500/40 bg-rose-950/15'
                : tc.status === 'TLE'
                ? 'border-amber-500/40 bg-amber-950/15'
                : 'border-white/10 bg-slate-900/55'
            }`}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-200">
                  Test Case #{index + 1}
                </span>
                {renderStatusBadge(tc)}
              </div>

              {testCases.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveTestCase(tc.id)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition"
                  title="Delete Test Case"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* 3-Column Layout: Input | Expected Output | Actual Output */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Column 1: Input (stdin) */}
              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  1. Input (stdin)
                </label>
                <textarea
                  rows={4}
                  value={tc.input}
                  onChange={(e) => handleUpdateField(tc.id, 'input', e.target.value)}
                  placeholder="Enter standard input (stdin)..."
                  className="w-full rounded-xl border border-white/10 bg-slate-950/75 p-2.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none resize-y"
                />
              </div>

              {/* Column 2: Expected Output */}
              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  2. Expected Output
                </label>
                <textarea
                  rows={4}
                  value={tc.expectedOutput}
                  onChange={(e) =>
                    handleUpdateField(tc.id, 'expectedOutput', e.target.value)
                  }
                  placeholder="Enter expected output..."
                  className="w-full rounded-xl border border-white/10 bg-slate-950/75 p-2.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none resize-y"
                />
              </div>

              {/* Column 3: Actual Output */}
              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  3. Actual Output
                </label>
                <textarea
                  rows={4}
                  readOnly
                  value={tc.actualOutput}
                  placeholder="Actual execution output will appear here..."
                  className={`w-full rounded-xl border p-2.5 font-mono text-xs focus:outline-none resize-y ${
                    tc.status === 'AC'
                      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                      : tc.status === 'WA' || tc.status === 'RE'
                      ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                      : 'border-white/10 bg-slate-950/50 text-slate-200 placeholder-slate-600'
                  }`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
