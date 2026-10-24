import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  GitBranch,
  Check,
  X,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  Edit3,
} from 'lucide-react';

export default function RuleDetailView({ apiBase = 'http://127.0.0.1:8000', onNavigate }) {
  const [ruleData, setRuleData] = useState({
    rule_id: 'FACT_012',
    rule_code: 'FACT_012',
    title: 'International settlement & fees',
    subtitle: 'FACT_012 · Rule v4 · Part of ruleset v3.2',
    breadcrumb: 'RULE REGISTRY > FACTUAL > FACT_012',
    tags: [
      { label: 'Enabled', type: 'enabled' },
      { label: 'Blocker', type: 'blocker' },
      { label: 'Factual', type: 'factual' },
    ],
    description:
      'International transfer claims must reflect the standard settlement time and FX fee. Do not imply zero-fee or instant delivery unless a specific product scope allows it.',
    applies_to: 'All channels',
    enforcement: 'Block publish',
    owner: 'Maya Chen, Product Ops',
    claims_allowed: '24-hour transfers with 0.5% FX fee',
    claims_disallowed: 'Instant, zero-fee international transfers',
    test_examples: [
      { quote: '“Move money abroad in 24 hrs, 0.5% FX fee”', status: 'Pass' },
      { quote: '“Instant, zero-fee transfers worldwide”', status: 'Flag' },
      { quote: '“Send money across borders with NovaPay”', status: 'Pass' },
    ],
    source_evidence: {
      quote: '“Fact 012: Transfers take 24h with 0.5% fee.”',
      ledger_entry: 'LEDGER-0412',
      source: 'NovaPay Product Facts',
      valid_from: 'Nov 20, 2025',
      last_verified: 'Mar 14, 2026',
      verified: true,
    },
    change_history: [
      {
        version: 'v4',
        date: 'Mar 14, 2026',
        current: true,
        note: 'Added 0.5% FX fee to the allowed claim',
      },
      {
        version: 'v3',
        date: 'Jan 8, 2026',
        current: false,
        note: 'Source updated to the 24h standard',
      },
      {
        version: 'v1',
        date: 'Nov 20, 2025',
        current: false,
        note: 'Rule created',
      },
    ],
    versioning_note: 'Changes are versioned. Existing audits keep the version they ran against.',
  });

  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testInput, setTestInput] = useState('Instant, zero-fee international transfers');
  const [testResult, setTestResult] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(ruleData.description);
  const [toastMessage, setToastMessage] = useState('');

  // Fetch live from backend if available
  useEffect(() => {
    fetch(`${apiBase}/api/rules/FACT_012/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.rule_id) {
          setRuleData(data);
          setEditDesc(data.description);
        }
      })
      .catch(() => {});
  }, [apiBase]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleRunTest = (text) => {
    const lower = text.toLowerCase();
    const disallowed = lower.includes('zero-fee') || lower.includes('zero fee') || lower.includes('instant');
    if (disallowed) {
      setTestResult({
        status: 'Flag',
        reason: 'Violates FACT_012: Implies zero-fee or instant international delivery without product scope.',
      });
    } else {
      setTestResult({
        status: 'Pass',
        reason: 'Compliant: Discloses standard 24h settlement and transparent 0.5% FX fee.',
      });
    }
  };

  const handleSaveRule = () => {
    setRuleData((prev) => ({ ...prev, description: editDesc }));
    setIsEditing(false);
    showToast('Rule definition updated successfully.');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#0F5132] text-white px-4 py-2.5 rounded-md shadow-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb */}
      <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
        <span>RULE REGISTRY</span>
        <span className="text-zinc-400 font-normal">&gt;</span>
        <span>FACTUAL</span>
        <span className="text-zinc-400 font-normal">&gt;</span>
        <span className="text-emerald-950 font-bold">FACT_012</span>
      </div>

      {/* Header and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            {ruleData.title}
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-mono">
            {ruleData.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setTestPanelOpen(!testPanelOpen);
              if (!testPanelOpen) handleRunTest(testInput);
            }}
            className={`border border-[#E5E7EB] text-xs font-medium px-3.5 py-2 rounded-md flex items-center gap-2 transition-colors shadow-xs ${
              testPanelOpen ? 'bg-zinc-100 text-zinc-900' : 'bg-white hover:bg-zinc-50 text-zinc-800'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-zinc-600" />
            <span>{testPanelOpen ? 'Hide tester' : 'Test rule'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-medium px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Cancel edit' : 'Edit rule'}</span>
          </button>
        </div>
      </div>

      {/* INLINE TESTER: Smoothly unfolds without opening any detached popup window */}
      {testPanelOpen && (
        <div className="mb-6 bg-[#F8FAF9] border border-emerald-200 rounded-lg p-5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-zinc-900 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#0F5132]" />
              Interactive Rule Evaluation
            </span>
            <button
              type="button"
              onClick={() => setTestPanelOpen(false)}
              className="text-zinc-400 hover:text-zinc-700 text-xs font-medium"
            >
              Close
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              value={testInput}
              onChange={(e) => {
                setTestInput(e.target.value);
                handleRunTest(e.target.value);
              }}
              className="flex-1 w-full text-xs px-3.5 py-2 bg-white border border-[#E5E7EB] rounded-md text-zinc-900 focus:ring-1 focus:ring-emerald-700 outline-hidden"
              placeholder="Type or paste any marketing claim to test against FACT_012..."
            />
            <button
              type="button"
              onClick={() => handleRunTest(testInput)}
              className="w-full sm:w-auto px-4 py-2 bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-medium rounded-md shrink-0"
            >
              Evaluate
            </button>
          </div>

          {testResult && (
            <div className="mt-3 flex items-center gap-2.5 text-xs">
              <span
                className={`font-mono px-2 py-0.5 rounded text-[11px] font-bold ${
                  testResult.status === 'Pass'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {testResult.status}
              </span>
              <span className="text-zinc-700">{testResult.reason}</span>
            </div>
          )}
        </div>
      )}

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: 8 of 12 columns (~66%) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Definition & Enforcement */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Definition &amp; enforcement
              </h2>
              {isEditing && (
                <span className="text-[11px] text-emerald-800 font-medium">
                  Direct In-Place Editing
                </span>
              )}
            </div>

            {/* Badges Row */}
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
                Enabled
              </span>
              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
                Blocker
              </span>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
                Factual
              </span>
            </div>

            {/* Rule Definition Description or Inline Editor */}
            {isEditing ? (
              <div className="space-y-3 mb-6">
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3 border border-emerald-600 rounded-md text-zinc-800 leading-relaxed focus:ring-1 focus:ring-emerald-700 outline-hidden"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRule}
                    className="px-4 py-1.5 text-xs bg-[#0F5132] hover:bg-[#0B4226] text-white font-medium rounded-md"
                  >
                    Save definition
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-zinc-600 text-xs sm:text-sm leading-relaxed mb-6">
                {ruleData.description}
              </p>
            )}

            {/* Divider */}
            <div className="border-t border-[#E5E7EB] pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium mb-1">
                    Applies to
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-zinc-800">
                    {ruleData.applies_to}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium mb-1">
                    Enforcement
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-zinc-800">
                    {ruleData.enforcement}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium mb-1">
                    Owner
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-zinc-800">
                    {ruleData.owner}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Claims Comparison Grid (Split Box) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Allowed Claims */}
            <div className="bg-[#F0FDF4] border border-emerald-200/90 rounded-lg p-5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase">
                <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                <span>CLAIMS ALLOWED</span>
              </div>
              <p className="text-zinc-900 font-bold text-lg sm:text-xl mt-3 leading-snug">
                {ruleData.claims_allowed}
              </p>
            </div>

            {/* Right: Disallowed Claims */}
            <div className="bg-[#FFF1F2] border border-rose-200/90 rounded-lg p-5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold tracking-wider text-rose-700 uppercase">
                <X className="w-3.5 h-3.5 text-rose-700 stroke-[2.5]" />
                <span>CLAIMS DISALLOWED</span>
              </div>
              <p className="text-zinc-900 font-bold text-lg sm:text-xl mt-3 leading-snug">
                {ruleData.claims_disallowed}
              </p>
            </div>
          </div>

          {/* Card 3: Test Examples */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">
                Test examples
              </h2>
              <span className="text-xs font-mono text-zinc-400">
                3 cases · 1 flagged
              </span>
            </div>

            <div className="divide-y divide-[#E5E7EB]">
              {ruleData.test_examples.map((item, idx) => {
                const isPass = item.status === 'Pass';
                return (
                  <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <span className="text-xs sm:text-sm text-zinc-800 font-normal">
                      {item.quote}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium shrink-0 ${
                        isPass
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 4 of 12 columns (~34%) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Source evidence */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Source evidence
              </h2>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
                Verified
              </span>
            </div>

            {/* Left green bar quote */}
            <div className="border-l-4 border-[#0F5132] pl-3 py-1 my-4">
              <p className="text-zinc-900 font-bold text-sm sm:text-base leading-snug">
                {ruleData.source_evidence.quote}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-400">Ledger entry</span>
                <span className="font-mono text-zinc-700 font-medium">
                  {ruleData.source_evidence.ledger_entry}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-400">Source</span>
                <span className="text-zinc-700 font-medium">
                  {ruleData.source_evidence.source}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-400">Valid from</span>
                <span className="text-zinc-700 font-medium">
                  {ruleData.source_evidence.valid_from}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Last verified</span>
                <span className="text-zinc-700 font-medium">
                  {ruleData.source_evidence.last_verified}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Change History Timeline */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">
              Change history
            </h2>

            <div className="relative pl-4 space-y-6 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
              {ruleData.change_history.map((hist, idx) => (
                <div key={idx} className="relative">
                  <span
                    className={`absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                      hist.current ? 'bg-emerald-600' : 'bg-zinc-300'
                    }`}
                  ></span>
                  <div className="text-xs font-mono text-zinc-500">
                    {hist.date} · {hist.version}
                  </div>
                  <div className="text-xs text-zinc-700 mt-0.5 leading-relaxed">
                    {hist.note}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Versioning Info Box */}
          <div className="bg-[#EAF5EE] text-emerald-950 border border-emerald-200 text-xs p-3.5 rounded-lg flex items-center gap-2.5">
            <GitBranch className="w-4 h-4 text-emerald-800 shrink-0" />
            <span className="leading-relaxed">
              {ruleData.versioning_note}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
