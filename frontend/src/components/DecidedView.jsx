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
  Download,
  Terminal,
  FileText,
  Key,
  ShieldAlert,
} from 'lucide-react';

export default function DecidedView({
  onViewAuditTrail,
  onOpenPublishHandoff,
  onBackToQueue,
}) {
  const [toastMessage, setToastMessage] = useState('');
  const [showFullAudit, setShowFullAudit] = useState(true);
  const [showHandoffDetails, setShowHandoffDetails] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const clearanceHash = 'SHA256-1c7503439701cc71537adf271e5937b8';
  const hmacSig = '1c7503439701cc71537adf271e5937b8f498d6cf21928698ca772b4126fa4ec8';
  const ed25519Sig = '04a696543148102d15fe052f0b422d91...';
  const canonicalPayload = '73e14f36ad24763434d3ee46861a92612d64976ae40aa4e47a0a0440483ed24d|DRAFT_024|v3.2|Jordan Lee|2026-10-25T05:00:00Z';
  const legalNotice = 'Brand-compliance cleared. Not a substitute for formal legal review.';

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const copyAttestation = () => {
    navigator.clipboard.writeText(clearanceHash);
    setCopiedHash(true);
    showToast('Cryptographic attestation hash copied to clipboard.');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const copyCliCommand = () => {
    navigator.clipboard.writeText('python brandguard_cli.py verify signed_DRAFT_024_banner.png');
    setCopiedCli(true);
    showToast('CLI verification command copied.');
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#0F5132] text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-emerald-400/30 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb with Clickable Return */}
      <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onBackToQueue}
          className="hover:underline text-emerald-800 flex items-center gap-1 cursor-pointer"
        >
          <span>REVIEW QUEUE</span>
        </button>
        <span className="text-zinc-400 font-normal">·</span>
        <span>EX-2041</span>
        <span className="text-zinc-400 font-normal">·</span>
        <span className="text-emerald-950 font-bold">SIGNED HANDOFF</span>
      </div>

      {/* Header and Top Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Approved for this draft. Ready for its audience.
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Signed cryptographic handoff sealed with HMAC-SHA256 and Ed25519 embedded in PNG &amp; ISO XMP metadata.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowFullAudit(!showFullAudit)}
            className={`border border-[#E5E7EB] text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer ${
              showFullAudit ? 'bg-zinc-100 text-zinc-900' : 'bg-white hover:bg-zinc-50 text-zinc-800'
            }`}
          >
            <span>{showFullAudit ? 'Hide audit trail' : 'View audit trail'}</span>
            {showFullAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={copyCliCommand}
            className="border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            <span>{copiedCli ? 'Copied CLI Command!' : 'Verify in CLI'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              showToast('Downloading cryptographically sealed asset with XMP...');
            }}
            className="bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Signed Asset</span>
          </button>
        </div>
      </div>

      {/* Top Green Approval Banner */}
      <div className="bg-[#EAF5EE] border border-emerald-200 p-4 rounded-xl flex items-start gap-3 mb-6 shadow-xs">
        <div className="w-6 h-6 rounded-full bg-[#0F5132] text-white flex items-center justify-center shrink-0 mt-0.5">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
        <div className="space-y-0.5">
          <h2 className="text-xs font-bold text-emerald-950 flex items-center gap-2">
            <span>Tone Exception Approved · Brand-Compliance Cleared</span>
            <span className="bg-emerald-200/70 text-emerald-900 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded">
              SEALED
            </span>
          </h2>
          <p className="text-xs text-emerald-900/90 leading-relaxed">
            Brand Marketing's justification was accepted by Brand Governance Lead Jordan Lee on Oct 25, 2026. Cryptographically attested with HMAC-SHA256 &amp; Ed25519.
          </p>
        </div>
      </div>

      {/* Two-Column Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: The Decision & Boundaries (~55%, col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: The Decision */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-amber-100 text-amber-900 text-[11px] font-mono px-2 py-0.5 rounded font-bold">
                Warning · Voice
              </span>
              <span className="font-mono text-xs font-bold text-zinc-700">
                VOICE_004
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                · Challenger Headline
              </span>
            </div>

            <div className="text-[11px] font-mono font-bold tracking-wider text-zinc-400 uppercase mb-2">
              THE DECISION &amp; APPROVED COPY
            </div>

            <div className="text-xl sm:text-2xl font-bold text-zinc-900 mb-2 font-sans">
              “Don’t get wrecked by banks!”
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mb-5">
              The challenger voice is permitted for the LinkedIn post draft only. Requested wording stays intact; fee claims remain bound to FACT_012 truth ledger.
            </p>

            {/* Manager Attribution Box */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                JL
              </div>
              <div className="text-xs">
                <div className="font-bold text-zinc-900">
                  Jordan Lee · Brand Governance Lead
                </div>
                <div className="text-zinc-600 italic mt-0.5">
                  “Reviewed. The challenger voice fits this audience and the scope is narrow. No factual claims breached.”
                </div>
              </div>
            </div>
          </div>

          {/* Sub-cards Row: Exception Boundaries & Decision History */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sub-card 1: Exception boundaries */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                Exception boundaries
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                  <span className="text-zinc-500">Draft ID</span>
                  <span className="font-mono text-zinc-900 font-bold">DRAFT_024</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                  <span className="text-zinc-500">Channel</span>
                  <span className="text-zinc-900 font-semibold">LinkedIn post</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                  <span className="text-zinc-500">Expires</span>
                  <span className="text-zinc-900 font-semibold">Oct 31, 2026</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Scope</span>
                  <span className="text-zinc-900 font-semibold">This draft only</span>
                </div>
              </div>
            </div>

            {/* Sub-card 2: Decision history */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                Decision history
              </h3>

              <div className="relative pl-4 space-y-3.5 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
                <div className="relative">
                  <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-white"></span>
                  <div className="text-xs font-bold text-zinc-900">
                    Approved by Jordan Lee
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400">
                    Oct 25 · 05:00 UTC
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-zinc-300 ring-4 ring-white"></span>
                  <div className="text-xs font-semibold text-zinc-700">
                    Exception requested
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400">
                    Oct 25 · 04:30 UTC
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute -left-[19px] top-1 w-2 h-2 rounded-full bg-zinc-300 ring-4 ring-white"></span>
                  <div className="text-xs font-semibold text-zinc-700">
                    Linter flagged VOICE_004
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400">
                    Oct 25 · 04:28 UTC
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* INLINE AUDIT TRAIL ACCORDION */}
          {showFullAudit && (
            <div className="bg-[#F8FAF9] border border-[#E5E7EB] rounded-xl p-5 text-xs text-zinc-700 space-y-3 shadow-xs">
              <div className="font-bold text-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-800" />
                  <span>Cryptographic Attestation &amp; Signature Record</span>
                </div>
                <span className="font-mono text-[11px] text-zinc-500">Block #92840</span>
              </div>
              <div className="bg-white border border-[#E5E7EB] p-3.5 rounded-lg font-mono text-[11px] space-y-1.5 text-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Attestation Status:</span>
                  <span className="font-bold text-emerald-800">BRAND_COMPLIANCE_CLEARED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Clearance Hash:</span>
                  <span className="font-bold text-zinc-900">{clearanceHash}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">HMAC-SHA256:</span>
                  <span className="text-zinc-700 truncate max-w-xs">{hmacSig}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Ed25519 Sig:</span>
                  <span className="text-zinc-700 truncate max-w-xs">{ed25519Sig}</span>
                </div>
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-zinc-500">Signed Payload:</span>
                  <span className="text-[10px] text-zinc-600 truncate max-w-md">{canonicalPayload}</span>
                </div>
              </div>

              {/* CLI Command Helper Box */}
              <div className="bg-zinc-900 text-zinc-200 p-3 rounded-lg font-mono text-[11px] flex items-center justify-between">
                <div className="truncate">
                  <span className="text-emerald-400">$</span> python brandguard_cli.py verify signed_DRAFT_024_banner.png
                </div>
                <button
                  type="button"
                  onClick={copyCliCommand}
                  className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                  title="Copy command"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Publish-Ready Handoff (~45%, col-span-5) */}
        <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900">
              Publish-Ready Handoff
            </h2>
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-3 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
              <Check className="w-3 h-3 stroke-[3]" />
              <span>Attested</span>
            </span>
          </div>

          {/* Giant Score */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl sm:text-5xl font-extrabold text-zinc-900 font-sans tracking-tight">
                96
              </span>
              <span className="text-zinc-400 text-xl font-normal">/100</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1 font-medium">
              Compliance readiness · 0 blockers · 1 approved exception (+4 deduction)
            </div>
          </div>

          {/* Rendered Banner Preview Card (Midnight Forest Emerald) */}
          <div className="bg-[#0A3423] text-white rounded-xl p-6 relative overflow-hidden shadow-md">
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
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#00D4B6] uppercase">
                  NOVAPAY
                </span>
                <span className="text-[9px] font-mono font-bold bg-white/10 text-emerald-200 px-2 py-0.5 rounded border border-white/20">
                  XMP SEAL EMBEDDED
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white tracking-tight leading-snug">
                Your business.
                <br />
                Without borders.
              </h3>

              <p className="text-xs text-emerald-100/90 mt-3 leading-relaxed max-w-xs font-medium">
                Transfers settle in 24 hrs with a 0.5% FX fee.
              </p>

              <div className="mt-5 flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-300">
                  {clearanceHash.slice(0, 24)}...
                </span>
              </div>
            </div>
          </div>

          {/* Inline Handoff & Dispatch Panel */}
          {showHandoffDetails && (
            <div className="p-4 bg-[#F8FAF9] border border-emerald-200 rounded-xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900">CMS Clearance Webhook Dispatch</span>
                <button
                  type="button"
                  onClick={copyAttestation}
                  className="text-[11px] text-[#0F5132] hover:underline flex items-center gap-1 font-mono font-semibold cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedHash ? 'Copied!' : 'Copy Stamp'}</span>
                </button>
              </div>
              <p className="text-zinc-600 text-[11px] leading-relaxed">
                Cryptographic clearance token bound to LinkedIn draft <code className="font-mono text-zinc-900 font-bold">DRAFT_024</code>.
              </p>
              <button
                type="button"
                onClick={() => showToast('Dispatched to LinkedIn CMS webhook with embedded clearance stamp.')}
                className="w-full py-2 bg-[#0F5132] hover:bg-[#0B4226] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                Dispatch Cleared Asset to CMS
              </button>
            </div>
          )}

          {/* Legal Notice Callout */}
          <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-lg text-[11px] text-zinc-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-zinc-800">Mandatory Governance Notice:</strong> {legalNotice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
