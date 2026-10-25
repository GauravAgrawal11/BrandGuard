import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Info,
  FileText,
  CheckCircle2,
  Paperclip,
  Upload,
  X,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

export default function ExceptionRequestView({
  apiBase = API_BASE,
  draftContext = null,
  onBackToInspection,
  onSubmitSuccess,
}) {
  const { user, token } = useAuth();

  // Selected rule & candidate copy details
  const [ruleCode, setRuleCode] = useState(draftContext?.ruleCode || 'VOICE_004');
  const [ruleTitle, setRuleTitle] = useState(
    draftContext?.ruleTitle || 'Aggressive Comparison Voice'
  );
  const [draftId, setDraftId] = useState(draftContext?.submissionId || draftContext?.draftId || 'DRAFT_024');
  const [draftTitle, setDraftTitle] = useState(
    draftContext?.draftTitle || 'Global ambition. Local simplicity.'
  );
  const [quoteText, setQuoteText] = useState(
    draftContext?.quoteText || "Don't get wrecked by banks!"
  );
  const [ruleDescription, setRuleDescription] = useState(
    draftContext?.explanation ||
      'Aggressive comparison tone is outside the default voice range for institutional audience.'
  );

  // Form Fields
  const [justification, setJustification] = useState(
    "This is an intentional challenger voice for NovaPay's 'Global ambition' campaign. It addresses traditional banking friction, not individuals or protected groups, and makes no fee or speed claim."
  );
  const [campaignRef, setCampaignRef] = useState('Global ambition · Q3 2026 launch');
  const [scope, setScope] = useState('This draft only');
  const [channel, setChannel] = useState(
    draftContext?.channel ? draftContext.channel.replace('_', ' ').toLowerCase() : 'LinkedIn post'
  );
  const [expiresOn, setExpiresOn] = useState('2026-10-31');
  const [reviewerName, setReviewerName] = useState('Jordan Lee');
  const [reviewerTitle, setReviewerTitle] = useState('Brand Governance Lead');

  // Evidence files state
  const [attachedFiles, setAttachedFiles] = useState([
    { name: 'Q3_challenger_campaign_creative_deck.pdf', size: '1.2 MB', time: 'Uploaded today' },
  ]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [serverError, setServerError] = useState('');

  // Check if current rule is blocked server-side (Fact & Accessibility guardrail)
  const isFactRule =
    ruleCode.toUpperCase().startsWith('FACT_') ||
    ruleCode.toUpperCase().includes('FACTUAL') ||
    ruleCode.toUpperCase().includes('RATE') ||
    ruleCode.toUpperCase().includes('APY');

  const isAccessibilityRule =
    ruleCode.toUpperCase().startsWith('VIS_') ||
    ruleCode.toUpperCase().includes('WCAG') ||
    ruleCode.toUpperCase().includes('ACCESSIBILITY') ||
    ruleCode.toUpperCase().includes('CONTRAST') ||
    ruleCode.toUpperCase().includes('COLOR');

  const isBlockedRule = isFactRule || isAccessibilityRule;

  // Preset tone rules for quick testing/switching
  const tonePresets = [
    {
      code: 'VOICE_004',
      title: 'Aggressive Challenger Voice',
      quote: "Don't get wrecked by banks!",
      desc: 'Aggressive comparison tone outside default institutional voice envelope.',
      isBlocked: false,
    },
    {
      code: 'VOICE_002',
      title: 'Colloquial Idiomatic Tone',
      quote: 'Move money, not mountains.',
      desc: 'Informal colloquial idiom outside formal banking style guide.',
      isBlocked: false,
    },
    {
      code: 'VOICE_CONFIDENCE',
      title: 'Overpromising Bold Claim Tone',
      quote: 'Experience payment freedom like never before.',
      desc: 'Superlative marketing voice exceeding default confidence baseline.',
      isBlocked: false,
    },
    {
      code: 'FACT_012',
      title: 'APY / Interest Rate Guarantee (FACTUAL)',
      quote: 'Guaranteed 4.8% APY on treasury deposits without risk.',
      desc: 'Factual financial performance claim governed by regulatory disclosure mandate.',
      isBlocked: true,
    },
    {
      code: 'VIS_WCAG_2.1',
      title: 'Contrast Ratio Compliance (ACCESSIBILITY)',
      quote: 'CTA Button Contrast: 3.2:1 (Requires 4.5:1 WCAG AA)',
      desc: 'Mandatory accessibility contrast threshold for legibility and inclusion.',
      isBlocked: true,
    },
  ];

  const handleSelectPreset = (preset) => {
    setRuleCode(preset.code);
    setRuleTitle(preset.title);
    setQuoteText(preset.quote);
    setRuleDescription(preset.desc);
    setServerError('');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleAddEvidence = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.png,.jpg';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        setAttachedFiles((prev) => [
          ...prev,
          { name: file.name, size: `${sizeMb > 0 ? sizeMb : 0.4} MB`, time: 'Just now' },
        ]);
        showToast(`Attached evidence: ${file.name}`);
      }
    };
    input.click();
  };

  const handleRemoveFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setServerError('');

    // Client-side block verification
    if (isBlockedRule) {
      setServerError(
        isFactRule
          ? 'Factual accuracy claims (FACT_*) cannot be overridden under any circumstances. Exception requests are strictly limited to stylistic voice and tone rules.'
          : 'WCAG accessibility standards (VIS_*) cannot be bypassed or overridden. Visual identity and accessibility exceptions are blocked.'
      );
      return;
    }

    if (!justification.trim()) {
      setServerError('Please provide an editorial justification explaining why this exception is appropriate.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        draft_id: draftId,
        title: draftTitle,
        rule_code: ruleCode,
        rule_description: ruleDescription,
        quote_text: quoteText,
        justification: justification,
        campaign_reference: campaignRef,
        scope: scope,
        channel: channel,
        expires_on: expiresOn,
        reviewer_name: reviewerName,
        reviewer_title: reviewerTitle,
        hard_blockers_count: 0,
        supporting_file_name: attachedFiles[0]?.name || 'Q3_challenger_campaign_creative_deck.pdf',
        supporting_file_size: attachedFiles[0]?.size || '1.2 MB',
      };

      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBase}/api/exceptions/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(`Exception request ${data.id || 'EX-2041'} submitted to Manager Review Queue.`);
        setTimeout(() => {
          if (onSubmitSuccess) onSubmitSuccess(data);
        }, 1200);
      } else {
        // Server-side guardrail rejection
        setServerError(
          data.error || 'Server rejected this exception request. Tone rules only are permitted.'
        );
      }
    } catch (err) {
      setServerError('Connection error: could not submit exception request to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#0F5132] text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 border border-emerald-400/30 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Back Link */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase flex items-center gap-1.5">
          <span>{draftId}</span>
          <span className="text-zinc-400 font-normal">·</span>
          <span>EXCEPTION REQUEST FORM</span>
          <span className="text-zinc-400 font-normal">·</span>
          <span className="text-zinc-600">TONE RULES ONLY</span>
        </div>

        <button
          type="button"
          onClick={onBackToInspection}
          className="text-xs text-zinc-600 hover:text-zinc-950 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Pre-Flight Inspector</span>
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
          Make the case. Keep the guardrails.
        </h1>
        <p className="text-xs text-zinc-500 mt-1 max-w-3xl leading-relaxed">
          Request a time-limited, channel-scoped exception for stylistic voice rules. Factual truth claims and WCAG accessibility standards are strictly blocked from override.
        </p>
      </div>

      {/* Rule Preset Selector Bar (Quick Selection & Blocker Testing) */}
      <div className="mb-6 bg-zinc-50 border border-zinc-200 rounded-xl p-3.5">
        <div className="text-[11px] font-mono font-semibold tracking-wider text-zinc-500 uppercase mb-2 flex items-center justify-between">
          <span>SELECT RULE CITATION FOR EXCEPTION:</span>
          <span className="text-emerald-700 font-normal">Tone: Permitted · Fact/Visual: Blocked</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tonePresets.map((preset) => {
            const isSelected = ruleCode === preset.code;
            return (
              <button
                key={preset.code}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`text-xs px-3 py-1.5 rounded-lg font-mono font-semibold transition-all flex items-center gap-1.5 border cursor-pointer ${
                  isSelected
                    ? preset.isBlocked
                      ? 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-400/30'
                      : 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                    : preset.isBlocked
                    ? 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50/50'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {preset.isBlocked ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{preset.code}</span>
                <span className="text-[10px] font-sans font-normal opacity-75">
                  ({preset.isBlocked ? 'Blocked' : 'Tone'})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Server/Client Error Banner */}
      {serverError && (
        <div className="mb-6 bg-rose-50 border border-rose-300 rounded-xl p-4 text-xs text-rose-900 flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold uppercase tracking-wider text-[11px] text-rose-700">
              Security Guardrail Violation
            </div>
            <div className="leading-relaxed font-medium">{serverError}</div>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Form Body (8 of 12 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Campaign Justification Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-900">
                1. Campaign &amp; Violation Context
              </h2>
              <span
                className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                  isBlockedRule
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {isBlockedRule ? 'BLOCKED · NON-OVERRIDABLE' : 'PERMITTED · TONE EXCEPTION'}
              </span>
            </div>

            {/* Warning Banner (Amber for Tone, Crimson for Blocked) */}
            <div
              className={`rounded-xl p-4 mb-5 border ${
                isBlockedRule
                  ? 'bg-rose-50/70 border-rose-300'
                  : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                      isBlockedRule
                        ? 'bg-rose-200 text-rose-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {isBlockedRule ? 'Hard Blocker' : 'Warning · Voice'}
                  </span>
                  <span className="font-mono text-xs font-bold text-zinc-800">
                    {ruleCode}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-medium">{ruleTitle}</span>
              </div>

              <div className="text-base sm:text-lg font-bold text-zinc-900 mb-1 font-sans">
                “{quoteText}”
              </div>

              <div className="text-xs text-zinc-600 leading-relaxed">
                {ruleDescription}
              </div>
            </div>

            {/* Blocked Guardrail Callout (if Fact or Accessibility selected) */}
            {isBlockedRule && (
              <div className="bg-rose-100/70 border-2 border-rose-400 rounded-xl p-4 mb-5 text-xs text-rose-950 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-[12px] text-rose-900">
                    {isFactRule
                      ? 'FACTUAL CLAIM EXCEPTION STRICTLY PROHIBITED'
                      : 'ACCESSIBILITY STANDARD EXCEPTION STRICTLY PROHIBITED'}
                  </div>
                  <p className="leading-relaxed">
                    {isFactRule
                      ? 'Factual truth claims (such as APY guarantees, speed commitments, and regulatory fee disclosures) cannot be overridden by an editorial exception under any circumstances. Content must be edited in the Pre-Flight Inspector to comply.'
                      : 'WCAG 2.1 AA accessibility standards (contrast ratios, color blindness safety) are absolute compliance requirements and cannot be bypassed.'}
                  </p>
                </div>
              </div>
            )}

            {/* Form Input 1: Triggered Copy Excerpt */}
            <div className="space-y-1.5 mb-5">
              <label className="text-xs font-semibold text-zinc-800 block">
                Triggered copy excerpt <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="The exact copy triggering this rule..."
                className="w-full text-xs px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-zinc-900 font-mono focus:ring-1 focus:ring-emerald-700 outline-none"
              />
            </div>

            {/* Form Input 2: Editorial Justification */}
            <div className="space-y-1.5 mb-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-800 block">
                  Why is this deviation appropriate? <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-mono text-zinc-400">
                  {justification.length} / 600
                </span>
              </div>
              <textarea
                rows={4}
                value={justification}
                maxLength={600}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain the editorial rationale, target audience context, and why brand safety is preserved..."
                className="w-full text-xs p-3.5 border border-[#E5E7EB] rounded-lg text-zinc-900 leading-relaxed focus:ring-1 focus:ring-emerald-700 outline-none"
              />
            </div>

            {/* Form Input 3: Campaign Reference */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 block">
                Campaign / Project reference
              </label>
              <input
                type="text"
                value={campaignRef}
                onChange={(e) => setCampaignRef(e.target.value)}
                placeholder="e.g. Global ambition · Q3 2026 launch"
                className="w-full text-xs px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-zinc-900 focus:ring-1 focus:ring-emerald-700 outline-none"
              />
            </div>
          </div>

          {/* Section 2: Scope & Review Parameters */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs">
            <h2 className="text-sm font-bold text-zinc-900 mb-4">
              2. Scope &amp; Review Parameters
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Applies to Scope */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 block">
                  Applies to Scope
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-zinc-900 bg-white focus:ring-1 focus:ring-emerald-700 outline-none"
                >
                  <option value="This draft only">This draft only</option>
                  <option value="All Q3 campaign assets">All Q3 campaign assets</option>
                  <option value="Temporary 30-day exemption">Temporary 30-day exemption</option>
                </select>
              </div>

              {/* Distribution Channel */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 block">
                  Distribution Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-zinc-900 bg-white focus:ring-1 focus:ring-emerald-700 outline-none"
                >
                  <option value="LinkedIn post">LinkedIn post</option>
                  <option value="Twitter / X thread">Twitter / X thread</option>
                  <option value="Press Release">Press Release</option>
                  <option value="Pitch Deck">Pitch Deck</option>
                  <option value="Email newsletter">Email newsletter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Expiration Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 block">
                  Expiration Date (Hard Cutoff)
                </label>
                <input
                  type="date"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-zinc-900 bg-white focus:ring-1 focus:ring-emerald-700 outline-none"
                />
              </div>

              {/* Designated Reviewer */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 block">
                  Designated Reviewer
                </label>
                <div className="flex items-center gap-2.5 px-3.5 py-2 border border-[#E5E7EB] rounded-lg bg-zinc-50">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-emerald-900 text-white flex items-center justify-center text-[10px] font-bold">
                    JL
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-zinc-900 truncate">
                      {reviewerName}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {reviewerTitle}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Form Action Buttons */}
            <div className="flex items-center justify-between pt-5 border-t border-[#E5E7EB]">
              <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span>Standard Review SLA: 24 business hours</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => showToast('Draft exception saved locally.')}
                  className="border border-[#E5E7EB] bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Save draft
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || isBlockedRule}
                  onClick={handleSubmit}
                  className={`text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                    isBlockedRule
                      ? 'bg-zinc-400 cursor-not-allowed opacity-60'
                      : 'bg-[#0F5132] hover:bg-[#0B4226]'
                  }`}
                  title={isBlockedRule ? 'Submission blocked: Tone rules only' : 'Submit Exception Request'}
                >
                  {isSubmitting ? (
                    'Submitting to Queue...'
                  ) : isBlockedRule ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-rose-200" />
                      <span>Submit Blocked (Tone Only)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Submit request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Summary & Evidence (4 of 12 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Submission Summary */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Submission Metadata
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-500">Requester</span>
                <span className="text-zinc-900 font-semibold">
                  {user?.name || 'Alex Morgan'} · {user?.department || 'Marketing'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-500">Rule Code</span>
                <span className="font-mono text-zinc-900 font-bold">{ruleCode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-500">Pillar</span>
                <span
                  className={`font-mono font-bold ${
                    isBlockedRule ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {isFactRule ? 'FACTUAL (BLOCKED)' : isAccessibilityRule ? 'VISUAL (BLOCKED)' : 'TONE & VOICE'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-500">Draft ID</span>
                <span className="font-mono text-zinc-900 font-bold">{draftId}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Hard Blockers</span>
                <span
                  className={`font-mono font-bold ${
                    isBlockedRule ? 'text-rose-600' : 'text-emerald-800'
                  }`}
                >
                  {isBlockedRule ? '1 Active Blocker' : 'None Verified'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Scoped Exception Safety Guarantee */}
          <div className="bg-[#EAF5EE] border border-emerald-200 p-4 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-bold text-emerald-900">
                Time-limited, scoped exception.
              </strong>{' '}
              Approval never alters the global brand rule in the registry and automatically expires on the designated cutoff date.
            </p>
          </div>

          {/* Card 3: Non-Overridable Guardrail Reminder */}
          <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-bold text-amber-900">Server-Enforced Guardrails:</strong>{' '}
              Factual truth rules (e.g. FACT_012) and accessibility guidelines cannot be overridden by an exception request.
            </p>
          </div>

          {/* Card 4: Supporting Evidence File Manager */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Supporting Evidence
              </h3>
              <span className="text-[11px] font-mono text-zinc-400">
                {attachedFiles.length} file{attachedFiles.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="space-y-2">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="border border-[#E5E7EB] rounded-lg p-2.5 flex items-center justify-between bg-zinc-50/60 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-7 h-7 rounded bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-[9px] shrink-0 border border-rose-200">
                      PDF
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold text-zinc-900 truncate">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {file.size} · {file.time}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="text-zinc-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddEvidence}
              className="w-full text-xs font-semibold text-[#0F5132] hover:text-[#0B4226] mt-3.5 py-2 border border-dashed border-emerald-300 hover:border-emerald-500 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors bg-emerald-50/30"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>+ Add supporting evidence</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
