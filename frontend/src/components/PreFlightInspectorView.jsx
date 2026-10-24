import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UploadCloud,
  RefreshCw,
  ArrowRight,
  SlidersHorizontal,
  Check,
} from 'lucide-react';

export default function PreFlightInspectorView({
  onRequestException,
  onNavigateToRule,
  apiBase = 'http://127.0.0.1:8000',
}) {
  const [draftTitle, setDraftTitle] = useState('DRAFT_024 · Global ambition. Local simplicity.');
  const [channel, setChannel] = useState('LINKEDIN_POST');
  const [draftText, setDraftText] = useState(
    "Don't get wrecked by banks! Your business. Without borders. Transfers settle in 24 hrs with a 0.5% FX fee."
  );
  const [isAuditing, setIsAuditing] = useState(false);
  const [score, setScore] = useState(92);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      showToast('Pre-flight scan finished. 1 advisory warning detected.');
    }, 600);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#0F5132] text-white px-4 py-2.5 rounded-md shadow-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb */}
      <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
        <span>PRE-FLIGHT INSPECTOR</span>
        <span className="text-zinc-400 font-normal">·</span>
        <span>DRAFT_024</span>
      </div>

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Draft Linter &amp; Pre-Flight Clearance
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Automated deterministic &amp; LLM audit against living brand rules and fact ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRequestException}
            className="border border-[#0F5132] text-[#0F5132] hover:bg-[#EAF5EE] text-xs font-medium px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span>Request exception</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            disabled={isAuditing}
            onClick={handleRunAudit}
            className="bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-medium px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
          >
            {isAuditing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-scan draft</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Two Column Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Draft Input & Editor (col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-zinc-900 block">
                Draft Content (LinkedIn Post)
              </label>
              <span className="font-mono text-xs text-zinc-400">
                Context: LinkedIn post · Marketing
              </span>
            </div>

            <textarea
              rows={5}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="w-full text-xs sm:text-sm p-4 border border-[#E5E7EB] rounded-lg text-zinc-800 leading-relaxed font-sans focus:ring-1 focus:ring-emerald-700 outline-hidden"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E7EB] text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                <span>Active Ruleset v3.2</span>
              </div>
              <div className="font-mono text-[11px]">
                Word count: {draftText.split(/\s+/).filter(Boolean).length} words
              </div>
            </div>
          </div>

          {/* Active Audit Findings for this Draft */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">
              Pre-Flight Findings &amp; Citations
            </h2>

            <div className="space-y-4">
              {/* Finding 1: VOICE_004 (Warning · Voice) */}
              <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-800 text-[11px] font-mono px-2 py-0.5 rounded font-medium">
                      Warning · Voice
                    </span>
                    <span className="font-mono text-xs font-semibold text-zinc-800">
                      VOICE_004
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onRequestException}
                    className="bg-[#0F5132] hover:bg-[#0B4226] text-white text-[11px] font-medium px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    <span>Request exception</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-sm font-bold text-zinc-900 mb-1">
                  “Don’t get wrecked by banks!”
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed mb-3">
                  Aggressive comparison tone is outside the default voice range. Prohibits juvenile slang attacking legacy competitors in public brand communications.
                </p>

                <div className="text-[11px] font-mono text-zinc-500 bg-white/70 p-2 rounded border border-amber-200/50">
                  Recommendation: Soften to institutional phrasing or submit a time-limited campaign exception.
                </div>
              </div>

              {/* Finding 2: FACT_012 (Pass) */}
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-mono px-2 py-0.5 rounded font-medium">
                      Pass · Factual
                    </span>
                    <span className="font-mono text-xs font-semibold text-zinc-800">
                      FACT_012
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateToRule && onNavigateToRule('FACT_012')}
                    className="text-xs font-medium text-[#0F5132] hover:underline"
                  >
                    View rule spec →
                  </button>
                </div>

                <div className="text-sm font-bold text-zinc-900 mb-1">
                  “Transfers settle in 24 hrs with a 0.5% FX fee.”
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed">
                  Compliant with living Fact Ledger entry LEDGER-0412. Discloses both the 24-hour standard timeframe and 0.5% FX fee schedule.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Score & Summary (col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Readiness Score Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Pre-Flight Compliance Score
              </h2>
              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
                Advisory Needed
              </span>
            </div>

            <div className="flex items-baseline gap-1 my-3">
              <span className="text-5xl font-extrabold text-zinc-900 tracking-tight">
                {score}
              </span>
              <span className="text-zinc-400 text-xl font-normal">/100</span>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed mb-4">
              0 hard blockers detected. Publication is unblocked, but 1 voice advisory requires either copy revision or manager sign-off.
            </p>

            <button
              type="button"
              onClick={onRequestException}
              className="w-full bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-semibold py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <span>Open Creator Exception Request (EX-2041)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Guidance Box */}
          <div className="bg-[#EAF5EE] border border-emerald-200 p-4 rounded-lg text-xs text-emerald-950 space-y-2">
            <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Guardrails Policy Notice</span>
            </div>
            <p className="leading-relaxed">
              Factual rules cannot be bypassed. Only tone and voice stylistic rules are eligible for scoped manager exceptions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
