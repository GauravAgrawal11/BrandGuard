import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  ExternalLink,
  Info,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function DecidedView({
  onViewAuditTrail,
  onOpenPublishHandoff,
  onBackToQueue,
}) {
  const [toastMessage, setToastMessage] = useState('');
  const [showFullAudit, setShowFullAudit] = useState(false);
  const [showHandoffDetails, setShowHandoffDetails] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const copyAttestation = () => {
    navigator.clipboard.writeText('SHA256-4c7b8e1a90d9821efb01a74288c39e032918bc38f9');
    setCopiedHash(true);
    showToast('Cryptographic attestation hash copied to clipboard.');
    setTimeout(() => setCopiedHash(false), 2000);
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

      {/* Top Breadcrumb with Clickable Return */}
      <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onBackToQueue}
          className="hover:underline text-emerald-800 flex items-center gap-1"
        >
          <span>REQUEST</span>
        </button>
        <span className="text-zinc-400 font-normal">·</span>
        <span>EX-2041</span>
        <span className="text-zinc-400 font-normal">·</span>
        <span className="text-emerald-950 font-bold">DECIDED</span>
      </div>

      {/* Header and Top Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Approved for this draft. Ready for its audience.
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowFullAudit(!showFullAudit)}
            className={`border border-[#E5E7EB] text-xs font-medium px-3.5 py-2 rounded-md transition-colors shadow-xs flex items-center gap-1.5 ${
              showFullAudit ? 'bg-zinc-100 text-zinc-900' : 'bg-white hover:bg-zinc-50 text-zinc-800'
            }`}
          >
            <span>{showFullAudit ? 'Hide audit trail' : 'View audit trail'}</span>
            {showFullAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowHandoffDetails(!showHandoffDetails);
              showToast(showHandoffDetails ? 'Closed handoff drawer' : 'Publish handoff details revealed.');
            }}
            className="bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-medium px-4 py-2 rounded-md flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span>{showHandoffDetails ? 'Hide handoff' : 'Open publish handoff →'}</span>
          </button>
        </div>
      </div>

      {/* Top Green Approval Banner */}
      <div className="bg-[#EAF5EE] border border-emerald-200 p-4 rounded-lg flex items-start gap-3 mb-6">
        <div className="w-6 h-6 rounded-full bg-[#0F5132] text-white flex items-center justify-center shrink-0 mt-0.5">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
        <div>
          <h2 className="text-xs font-semibold text-emerald-950">
            Tone exception approved · Required review complete
          </h2>
          <p className="text-xs text-emerald-900/90 mt-0.5 leading-relaxed">
            Brand Marketing's justification was accepted by Jordan Lee on Jun 12, 2026 at 09:41 UTC. The exception applies to this draft only.
          </p>
        </div>
      </div>

      {/* Two-Column Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: The Decision & Boundaries (~55%, col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: The Decision */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            {/* Semantic Tags */}
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-amber-100 text-amber-800 text-[11px] font-mono px-2 py-0.5 rounded font-medium">
                Warning · Voice
              </span>
              <span className="font-mono text-[11px] text-zinc-600">
                VOICE_004
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                · Line 3
              </span>
            </div>

            <div className="text-[11px] font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-2">
              THE DECISION
            </div>

            <div className="text-xl sm:text-2xl font-bold text-zinc-900 mb-2">
              “Don’t get wrecked by banks!”
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mb-5">
              The challenger voice is permitted for the LinkedIn draft only. Requested wording stays intact; fee claims remain bound to FACT_012.
            </p>

            {/* Manager Attribution Box */}
            <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-800 shrink-0">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                  alt="Jordan Lee"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-zinc-900">
                  Jordan Lee · Brand Manager
                </div>
                <div className="text-zinc-600 italic mt-0.5">
                  “Reviewed. The challenger voice fits this audience and the scope is narrow.”
                </div>
              </div>
            </div>
          </div>

          {/* Sub-cards Row: Exception Boundaries & Decision History */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sub-card 1: Exception boundaries */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">
                Exception boundaries
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                  <span className="text-zinc-400">Draft</span>
                  <span className="font-mono text-zinc-800 font-medium">DRAFT_024</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                  <span className="text-zinc-400">Channel</span>
                  <span className="text-zinc-800 font-medium">LinkedIn post</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                  <span className="text-zinc-400">Expires</span>
                  <span className="text-zinc-800 font-medium">Oct 31, 2026</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Scope</span>
                  <span className="text-zinc-800 font-medium">This draft only</span>
                </div>
              </div>
            </div>

            {/* Sub-card 2: Decision history */}
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">
                Decision history
              </h3>

              <div className="relative pl-4 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
                <div className="relative">
                  <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-white"></span>
                  <div className="text-xs font-semibold text-zinc-900">
                    Approved by Jordan Lee
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    Jun 12 · 09:41
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-zinc-300 ring-4 ring-white"></span>
                  <div className="text-xs font-medium text-zinc-700">
                    Exception requested
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    Jun 11 · 16:20
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-zinc-300 ring-4 ring-white"></span>
                  <div className="text-xs font-medium text-zinc-700">
                    Scan flagged VOICE_004
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    Jun 11 · 16:12
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* INLINE AUDIT TRAIL ACCORDION: Expands smoothly without opening a separate popup */}
          {showFullAudit && (
            <div className="bg-[#F8FAF9] border border-[#E5E7EB] rounded-lg p-5 text-xs text-zinc-700 space-y-3">
              <div className="font-semibold text-zinc-900 flex items-center justify-between">
                <span>Cryptographic Ledger Trail</span>
                <span className="font-mono text-[11px] text-zinc-400">Block #84920</span>
              </div>
              <div className="bg-white border border-[#E5E7EB] p-3 rounded-md font-mono text-[11px] space-y-1">
                <div>Clearance: COMPLIANT_WITH_EXCEPTION</div>
                <div>Hash: SHA256-4c7b8e1a90d9821efb01a74288c39e032918bc38f9</div>
                <div>Signed by: Jordan Lee (Brand Manager)</div>
                <div>Timestamp: Jun 12, 2026 09:41 UTC</div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Publish-Ready Handoff (~45%, col-span-5) */}
        <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Publish-ready handoff
            </h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium flex items-center gap-1">
              <Check className="w-3 h-3 stroke-[2.5]" />
              <span>Ready</span>
            </span>
          </div>

          {/* Giant Score */}
          <div className="mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl sm:text-5xl font-extrabold text-zinc-900 font-sans tracking-tight">
                96
              </span>
              <span className="text-zinc-400 text-xl font-normal">/100</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Compliance readiness · 0 blockers · 1 approved exception
            </div>
          </div>

          {/* Rendered Banner Preview Card (Midnight Forest Emerald) */}
          <div className="bg-[#0A3423] text-white rounded-xl p-6 relative overflow-hidden shadow-md mt-5">
            {/* Subtle decorative curved arc */}
            <svg
              className="absolute -right-12 -bottom-16 w-56 h-56 text-[#124330] pointer-events-none"
              viewBox="0 0 200 200"
              fill="none"
            >
              <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="24" opacity="0.4" />
              <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="12" opacity="0.3" />
            </svg>

            {/* Banner Content */}
            <div className="relative z-10">
              <span className="text-[10px] font-mono font-semibold tracking-widest text-emerald-400 uppercase block mb-3">
                NOVAPAY
              </span>

              <h3 className="text-2xl font-bold text-white tracking-tight leading-snug">
                Your business.
                <br />
                Without borders.
              </h3>

              <p className="text-xs text-emerald-100/90 mt-3 leading-relaxed max-w-xs">
                Transfers settle in 24 hrs with a 0.5% FX fee.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => showToast('Simulating live preview: NovaPay landing page flow.')}
                  className="bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs px-4 py-2 rounded-md shadow-sm transition-colors inline-block"
                >
                  Open an account
                </button>
              </div>
            </div>
          </div>

          {/* Inline Handoff & Dispatch Panel: Revealed in-place without popup windows */}
          {showHandoffDetails && (
            <div className="mt-4 p-4 bg-[#F8FAF9] border border-emerald-200 rounded-lg text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900">CMS Webhook Dispatch</span>
                <button
                  type="button"
                  onClick={copyAttestation}
                  className="text-[11px] text-[#0F5132] hover:underline flex items-center gap-1 font-mono"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedHash ? 'Copied!' : 'Copy Stamp'}</span>
                </button>
              </div>
              <p className="text-zinc-600 text-[11px] leading-relaxed">
                Clearance token linked to LinkedIn post draft ID: <code className="font-mono text-zinc-800">DRAFT_024</code>.
              </p>
              <button
                type="button"
                onClick={() => showToast('Dispatched to LinkedIn CMS webhook.')}
                className="w-full py-1.5 bg-[#0F5132] hover:bg-[#0B4226] text-white rounded text-xs font-medium"
              >
                Dispatch Asset
              </button>
            </div>
          )}

          {/* Info Footer */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-5 pt-4 border-t border-[#E5E7EB]">
            <Info className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="leading-relaxed">
              Once published, the approval record stays linked to this posting for audit.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
