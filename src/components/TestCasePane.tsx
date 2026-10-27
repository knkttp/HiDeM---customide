import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Terminal,
  Eye,
  GitCompare,
} from 'lucide-react';
import { SupportedLanguage } from './TopBar';
import { CodeFileTab } from './EditorPane';

export type JudgeStatus = 'IDLE' | 'RUNNING' | 'AC' | 'WA' | 'TLE' | 'RE';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  status: JudgeStatus;
  timeMs?: number;
}

export interface SingleExecResult {
  actualOutput: string;
  status: JudgeStatus;
  timeMs?: number;
  compileError?: string;
}

interface TestCasePaneProps {
  language: SupportedLanguage;
  code: string;
  tabs?: CodeFileTab[];
  activeTabId?: string;
  testCases: TestCase[];
  onChangeTestCases: (next: TestCase[]) => void;
  onRunSingleTestCase?: (id: string) => void;
  onExecuteSingleCode?: (
    lang: SupportedLanguage,
    code: string,
    input: string
  ) => Promise<SingleExecResult>;
  compileError?: string | null;
}

function normalizeOut(text: string): string {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

export const TestCasePane: React.FC<TestCasePaneProps> = ({
  language,
  code,
  tabs = [],
  activeTabId = '',
  testCases,
  onChangeTestCases,
  onRunSingleTestCase,
  onExecuteSingleCode,
  compileError,
}) => {
  const [paneMode, setPaneMode] = useState<'tests' | 'compare'>('tests');

  // Compare / Stress Test State
  const runnableTabs = tabs.filter(
    (t) => t.language === 'cpp' || t.language === 'rust' || t.language === 'python'
  );
  const [tabAId, setTabAId] = useState<string>('');
  const [tabBId, setTabBId] = useState<string>('');
  const [inputMode, setInputMode] = useState<'manual' | 'generator'>('manual');
  const [genTabId, setGenTabId] = useState<string>('');
  const [iterations, setIterations] = useState<number>(20);
  const [compareInput, setCompareInput] = useState<string>(testCases[0]?.input || '');
  const [outputA, setOutputA] = useState<string>('');
  const [outputB, setOutputB] = useState<string>('');
  const [timeA, setTimeA] = useState<number | undefined>(undefined);
  const [timeB, setTimeB] = useState<number | undefined>(undefined);
  const [compareStatus, setCompareStatus] = useState<'IDLE' | 'RUNNING' | 'MATCH' | 'DIFF' | 'ERROR'>('IDLE');
  const [currentIter, setCurrentIter] = useState<number>(0);
  const [compareError, setCompareError] = useState<string | null>(null);
  const stopRef = useRef<boolean>(false);

  // Keep selected Tab A / Tab B / Gen Tab valid when tabs change
  useEffect(() => {
    if (runnableTabs.length === 0) return;
    if (!tabAId || !runnableTabs.some((t) => t.id === tabAId)) {
      const currentActive = runnableTabs.find((t) => t.id === activeTabId);
      setTabAId((currentActive || runnableTabs[0]).id);
    }
    if (!tabBId || !runnableTabs.some((t) => t.id === tabBId)) {
      const second = runnableTabs.find((t) => t.id !== (tabAId || activeTabId)) || runnableTabs[0];
      setTabBId(second.id);
    }
    if (!genTabId || !runnableTabs.some((t) => t.id === genTabId)) {
      const third =
        runnableTabs.find((t) => t.name.toLowerCase().includes('gen') || t.name.toLowerCase().includes('sinh')) ||
        runnableTabs[runnableTabs.length - 1];
      setGenTabId(third.id);
    }
  }, [runnableTabs, activeTabId, tabAId, tabBId, genTabId]);

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

  const handleRunCompare = async () => {
    if (!onExecuteSingleCode) return;
    const tabA = runnableTabs.find((t) => t.id === tabAId);
    const tabB = runnableTabs.find((t) => t.id === tabBId);
    if (!tabA || !tabB) {
      setCompareError('Cần mở ít nhất 1 tab code (C++, Rust hoặc Python) để so sánh.');
      setCompareStatus('ERROR');
      return;
    }

    stopRef.current = false;
    setCompareStatus('RUNNING');
    setCompareError(null);
    setCurrentIter(0);

    const totalRuns = inputMode === 'generator' ? Math.max(1, Math.min(500, iterations)) : 1;
    const genTab = runnableTabs.find((t) => t.id === genTabId);

    if (inputMode === 'generator' && !genTab) {
      setCompareError('Vui lòng chọn tab code sinh test (Generator).');
      setCompareStatus('ERROR');
      return;
    }

    for (let i = 1; i <= totalRuns; i++) {
      if (stopRef.current) break;
      setCurrentIter(i);

      let testInput = compareInput;

      if (inputMode === 'generator' && genTab) {
        const seedInput = `${i} ${Math.floor(Math.random() * 1000000000)}\n`;
        const genRes = await onExecuteSingleCode(genTab.language, genTab.code, seedInput);
        if (genRes.compileError || genRes.status === 'RE' || genRes.status === 'TLE') {
          setCompareError(`Lỗi Generator (${genTab.name}):\n${genRes.compileError || genRes.actualOutput}`);
          setCompareStatus('ERROR');
          return;
        }
        testInput = genRes.actualOutput;
        setCompareInput(testInput);
      }

      if (stopRef.current) break;

      const [resA, resB] = await Promise.all([
        onExecuteSingleCode(tabA.language, tabA.code, testInput),
        onExecuteSingleCode(tabB.language, tabB.code, testInput),
      ]);

      setOutputA(resA.actualOutput);
      setOutputB(resB.actualOutput);
      setTimeA(resA.timeMs);
      setTimeB(resB.timeMs);

      if (resA.compileError || resB.compileError) {
        setCompareError(resA.compileError || resB.compileError || 'Compile Error');
        setCompareStatus('ERROR');
        return;
      }

      const failedRun =
        resA.status === 'RE' ||
        resA.status === 'TLE' ||
        resB.status === 'RE' ||
        resB.status === 'TLE';

      const isSame = !failedRun && normalizeOut(resA.actualOutput) === normalizeOut(resB.actualOutput);

      if (!isSame) {
        setCompareStatus('DIFF');
        return;
      }

      setCompareStatus('MATCH');
    }
  };

  const handleSaveCompareToTests = () => {
    const nextId = `tc-${Date.now()}`;
    onChangeTestCases([
      ...testCases,
      {
        id: nextId,
        input: compareInput,
        expectedOutput: outputB,
        actualOutput: outputA,
        status: compareStatus === 'MATCH' ? 'AC' : compareStatus === 'DIFF' ? 'WA' : 'IDLE',
      },
    ]);
    setPaneMode('tests');
  };

  const renderStatusBadge = (tc: TestCase) => {
    switch (tc.status) {
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-400/40 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        );
      case 'AC':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            AC {tc.timeMs !== undefined ? `${tc.timeMs}ms` : ''}
          </span>
        );
      case 'WA':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-400/40 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            <XCircle className="h-3 w-3" />
            WA {tc.timeMs !== undefined ? `${tc.timeMs}ms` : ''}
          </span>
        );
      case 'TLE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <Clock className="h-3 w-3" />
            TLE
          </span>
        );
      case 'RE':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 border border-purple-400/40 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
            <AlertTriangle className="h-3 w-3" />
            RE
          </span>
        );
      default:
        return null;
    }
  };

  // Live DOM Sandbox for HTML mode
  if (language === 'html') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950/35">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/50 px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Eye className="h-3.5 w-3.5 text-indigo-400" />
            <span>Preview</span>
          </div>
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
  const tabAObj = runnableTabs.find((t) => t.id === tabAId);
  const tabBObj = runnableTabs.find((t) => t.id === tabBId);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950/30">
      {/* Compact Header Bar with Mode Switcher (Tests | Compare) */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/50 px-3 py-1.5">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/80 p-0.5">
          <button
            type="button"
            onClick={() => setPaneMode('tests')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              paneMode === 'tests'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Tests ({acCount}/{testCases.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setPaneMode('compare')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              paneMode === 'compare'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            <span>Compare</span>
          </button>
        </div>

        {paneMode === 'tests' ? (
          <button
            type="button"
            onClick={handleAddTestCase}
            className="flex items-center justify-center rounded-lg bg-indigo-600/80 hover:bg-indigo-500 p-1 text-white transition"
            title="Add Test Case"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            {compareStatus === 'RUNNING' ? (
              <button
                type="button"
                onClick={() => {
                  stopRef.current = true;
                  setCompareStatus('IDLE');
                }}
                className="flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white transition"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRunCompare}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white transition"
                title="Run Comparison"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Compare</span>
              </button>
            )}
          </div>
        )}
      </div>

      {paneMode === 'compare' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {/* Code A vs Code B Selectors */}
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2.5 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                  Code 1
                </label>
                <select
                  value={tabAId}
                  onChange={(e) => setTabAId(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  {runnableTabs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                  Code 2
                </label>
                <select
                  value={tabBId}
                  onChange={(e) => setTabBId(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                >
                  {runnableTabs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Input Source Mode: Manual vs Generator Code */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950 p-0.5">
                <button
                  type="button"
                  onClick={() => setInputMode('manual')}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                    inputMode === 'manual'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Manual Input
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('generator')}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                    inputMode === 'generator'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Generator Code
                </button>
              </div>

              {inputMode === 'generator' && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={genTabId}
                    onChange={(e) => setGenTabId(e.target.value)}
                    title="Tab code sinh test"
                    className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 font-mono text-xs text-amber-300 focus:border-indigo-500 focus:outline-none"
                  >
                    {runnableTabs.map((t) => (
                      <option key={t.id} value={t.id}>
                        Gen: {t.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={iterations}
                    onChange={(e) => setIterations(Number(e.target.value))}
                    title="Số test chạy thử"
                    className="rounded-lg border border-white/10 bg-slate-950 px-1.5 py-1 font-mono text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={1}>1x</option>
                    <option value={10}>10x</option>
                    <option value={20}>20x</option>
                    <option value={50}>50x</option>
                    <option value={100}>100x</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {compareError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/70 p-2.5 text-xs font-mono text-rose-200 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {compareError}
            </div>
          )}

          {/* Input + Side-by-Side Output Card */}
          <div
            className={`rounded-xl border p-2.5 transition ${
              compareStatus === 'MATCH'
                ? 'border-emerald-500/40 bg-emerald-950/15'
                : compareStatus === 'DIFF'
                ? 'border-rose-500/40 bg-rose-950/15'
                : 'border-white/10 bg-slate-900/55'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {compareStatus === 'RUNNING' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-400/40 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    #{currentIter}
                  </span>
                )}
                {compareStatus === 'MATCH' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    MATCH {inputMode === 'generator' ? `(${currentIter}/${iterations})` : ''}
                  </span>
                )}
                {compareStatus === 'DIFF' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-400/40 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                    <XCircle className="h-3 w-3" />
                    DIFF {inputMode === 'generator' ? `at #${currentIter}` : ''}
                  </span>
                )}
              </div>

              {(compareStatus === 'MATCH' || compareStatus === 'DIFF') && (
                <button
                  type="button"
                  onClick={handleSaveCompareToTests}
                  className="rounded-md border border-white/10 bg-white/5 hover:bg-white/15 px-2 py-0.5 text-[10px] font-medium text-slate-200 transition"
                  title="Lưu bộ test này sang danh sách Tests"
                >
                  + Tests
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-col">
                <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Input {inputMode === 'generator' ? '(Generated)' : ''}
                </label>
                <textarea
                  rows={3}
                  value={compareInput}
                  readOnly={inputMode === 'generator'}
                  onChange={(e) => setCompareInput(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/75 p-2 font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-y"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <label className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                    <span className="truncate">{tabAObj?.name || 'Output 1'}</span>
                    {timeA !== undefined && <span className="text-slate-400">{timeA}ms</span>}
                  </label>
                  <textarea
                    rows={4}
                    readOnly
                    value={outputA}
                    className={`w-full rounded-lg border p-2 font-mono text-xs focus:outline-none resize-y ${
                      compareStatus === 'MATCH'
                        ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                        : compareStatus === 'DIFF'
                        ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                        : 'border-white/10 bg-slate-950/50 text-slate-200'
                    }`}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                    <span className="truncate">{tabBObj?.name || 'Output 2'}</span>
                    {timeB !== undefined && <span className="text-slate-400">{timeB}ms</span>}
                  </label>
                  <textarea
                    rows={4}
                    readOnly
                    value={outputB}
                    className={`w-full rounded-lg border p-2 font-mono text-xs focus:outline-none resize-y ${
                      compareStatus === 'MATCH'
                        ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                        : compareStatus === 'DIFF'
                        ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                        : 'border-white/10 bg-slate-950/50 text-slate-200'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Compile Error Banner if any */}
          {compileError && (
            <div className="mx-3 mt-2 rounded-xl border border-rose-500/40 bg-rose-950/70 p-2.5 text-xs font-mono text-rose-200 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {compileError}
            </div>
          )}

          {/* Test Case Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {testCases.map((tc, index) => (
              <div
                key={tc.id}
                className={`rounded-xl border p-2.5 transition backdrop-blur-sm ${
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
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">
                      #{index + 1}
                    </span>
                    {renderStatusBadge(tc)}
                  </div>

                  <div className="flex items-center gap-1">
                    {onRunSingleTestCase && (
                      <button
                        type="button"
                        onClick={() => onRunSingleTestCase(tc.id)}
                        disabled={tc.status === 'RUNNING'}
                        className="rounded-md p-1 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 disabled:opacity-40 transition"
                        title={`Run #${index + 1}`}
                      >
                        {tc.status === 'RUNNING' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                      </button>
                    )}

                    {testCases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTestCase(tc.id)}
                        className="rounded-md p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300 transition"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 3-Column Layout: Input | Expected | Output */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Input
                    </label>
                    <textarea
                      rows={3}
                      value={tc.input}
                      onChange={(e) => handleUpdateField(tc.id, 'input', e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-slate-950/75 p-2 font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-y"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Expected
                    </label>
                    <textarea
                      rows={3}
                      value={tc.expectedOutput}
                      onChange={(e) =>
                        handleUpdateField(tc.id, 'expectedOutput', e.target.value)
                      }
                      className="w-full rounded-lg border border-white/10 bg-slate-950/75 p-2 font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none resize-y"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Output
                    </label>
                    <textarea
                      rows={3}
                      readOnly
                      value={tc.actualOutput}
                      className={`w-full rounded-lg border p-2 font-mono text-xs focus:outline-none resize-y ${
                        tc.status === 'AC'
                          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                          : tc.status === 'WA' || tc.status === 'RE'
                          ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                          : 'border-white/10 bg-slate-950/50 text-slate-200'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
