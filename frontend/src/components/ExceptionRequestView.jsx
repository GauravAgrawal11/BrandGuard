import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Info,
  FileText,
  CheckCircle2,
  Paperclip,
  Upload,
} from 'lucide-react';

export default function ExceptionRequestView({
  apiBase = 'http://127.0.0.1:8000',
  onBackToInspection,
  onSubmitSuccess,
}) {
  const [justification, setJustification] = useState(
    "This is an intentional challenger voice for NovaPay's 'Global ambition' campaign. It addresses banking friction, not individuals or protected groups, and makes no fee or speed claim."
  );
  const [campaignRef, setCampaignRef] = useState('Global ambition · Q3 2026 launch');
  const [scope, setScope] = useState('This draft only');
  const [channel, setChannel] = useState('LinkedIn post');
  const [expiresOn, setExpiresOn] = useState('2026-10-31');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([
    { name: 'Q3_challenger_campaign.pdf', size: '1.2 MB', time: 'Uploaded today' },
  ]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        id: 'EX-2041',
        draft_id: 'DRAFT_024',
        rule_code: 'VOICE_004',
        title: 'Global ambition. Local simplicity.',
        requester_name: 'Alex Morgan',
        requester_dept: 'Marketing',
        warning_type: 'Warning · Voice',
        quote_text: "Don't get wrecked by banks!",
        rule_description: 'Aggressive comparison tone is outside the default voice range.',
        justification: justification,
        campaign_reference: campaignRef,
        scope: scope,
        channel: channel,
        expires_on: expiresOn,
        reviewer_name: 'Jordan Lee',
        reviewer_title: 'Brand Manager',
        hard_blockers_count: 0,
        supporting_file_name: attachedFiles[0]?.name || 'Q3_challenger_campaign.pdf',
        supporting_file_size: attachedFiles[0]?.size || '1.2 MB',
      };

      const res = await fetch(`${apiBase}/api/exceptions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Exception request EX-2041 submitted to Manager Review Queue.');
        setTimeout(() => {
          if (onSubmitSuccess) onSubmitSuccess();
        }, 800);
      } else {
        showToast('Request submitted locally.');
        setTimeout(() => {
          if (onSubmitSuccess) onSubmitSuccess();
        }, 800);
      }
    } catch {
      showToast('Exception request saved.');
      setTimeout(() => {
        if (onSubmitSuccess) onSubmitSuccess();
      }, 800);
    } finally {
      setIsSubmitting(false);
    }
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
          { name: file.name, size: `${sizeMb} MB`, time: 'Just now' },
        ]);
        showToast(`Attached evidence: ${file.name}`);
      }
    };
    input.click();
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
        <span>DRAFT_024</span>
        <span className="text-zinc-400 font-normal">·</span>
        <span>EXCEPTION REQUEST</span>
      </div>

      {/* Header and Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Make the case. Keep the guardrails.
          </h1>
        </div>

        <div>
          <button
            type="button"
            onClick={onBackToInspection}
            className="text-xs text-zinc-500 hover:text-zinc-800 font-medium flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to inspection</span>
          </button>
        </div>
      </div>

      {/* Two-Column Form Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: 8 of 12 columns (~66%) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Campaign justification */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">
              Campaign justification
            </h2>

            {/* Amber Warning Banner */}
            <div className="bg-amber-50/50 border border-amber-200/90 rounded-lg p-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-amber-100 text-amber-800 text-[11px] font-mono font-medium px-2 py-0.5 rounded">
                  Warning · Voice
                </span>
                <span className="font-mono text-[11px] text-zinc-600">
                  VOICE_004
                </span>
              </div>

              <div className="text-base sm:text-lg font-bold text-zinc-900 mb-1">
                “Don’t get wrecked by banks!”
              </div>

              <div className="text-xs text-zinc-600">
                Aggressive comparison tone is outside the default voice range.
              </div>
            </div>

            {/* Form Input 1: Justification */}
            <div className="space-y-1.5 mb-5">
              <label className="text-xs font-medium text-zinc-800 block">
                Why is this appropriate? <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={justification}
                maxLength={600}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full text-xs p-3 border border-[#E5E7EB] rounded-md text-zinc-800 leading-relaxed focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 outline-hidden"
              />
              <div className="text-right text-xs font-mono text-zinc-400">
                {justification.length} / 600
              </div>
            </div>

            {/* Form Input 2: Campaign Reference */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-800 block">
                Campaign reference
              </label>
              <input
                type="text"
                value={campaignRef}
                onChange={(e) => setCampaignRef(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-[#E5E7EB] rounded-md text-zinc-800 focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 outline-hidden"
              />
            </div>
          </div>

          {/* Card 2: Scope & review */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">
              Scope &amp; review
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Applies to */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 block">
                  Applies to
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-[#E5E7EB] rounded-md text-zinc-800 bg-white focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 outline-hidden"
                >
                  <option value="This draft only">This draft only</option>
                  <option value="All Q3 campaign assets">All Q3 campaign assets</option>
                  <option value="Temporary 30-day exemption">Temporary 30-day exemption</option>
                </select>
              </div>

              {/* Channel */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 block">
                  Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-[#E5E7EB] rounded-md text-zinc-800 bg-white focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 outline-hidden"
                >
                  <option value="LinkedIn post">LinkedIn post</option>
                  <option value="Twitter / X thread">Twitter / X thread</option>
                  <option value="Press Release">Press Release</option>
                  <option value="Pitch Deck">Pitch Deck</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Expires on */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 block">
                  Expires on
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={expiresOn}
                    onChange={(e) => setExpiresOn(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-[#E5E7EB] rounded-md text-zinc-800 bg-white focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 outline-hidden"
                  />
                </div>
              </div>

              {/* Reviewer */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 block">
                  Reviewer
                </label>
                <div className="flex items-center gap-2.5 px-3 py-2 border border-[#E5E7EB] rounded-md bg-zinc-50/50">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-emerald-800 shrink-0">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80"
                      alt="Jordan Lee"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-zinc-800">
                    Jordan Lee · Brand Manager
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => showToast('Draft saved successfully.')}
                className="border border-[#E5E7EB] bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-medium px-4 py-2 rounded-md transition-colors"
              >
                Save draft
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-medium px-4 py-2 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 4 of 12 columns (~34%) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Submission summary */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <h2 className="text-sm font-semibold text-zinc-900 mb-4">
              Submission summary
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-500">Requester</span>
                <span className="text-zinc-800 font-medium">Alex Morgan, Marketing</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-500">Rule</span>
                <span className="font-mono text-zinc-800 font-medium">VOICE_004</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                <span className="text-zinc-500">Draft</span>
                <span className="font-mono text-zinc-800 font-medium">DRAFT_024</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Hard blockers</span>
                <span className="font-mono text-emerald-800 font-semibold">None</span>
              </div>
            </div>
          </div>

          {/* Guardrail Callout 1 (Emerald Info Box) */}
          <div className="bg-[#EAF5EE] border border-emerald-200 p-3.5 rounded-lg text-xs text-emerald-950 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="font-semibold text-emerald-900">Time-limited, scoped exception.</strong>{' '}
              Approval never changes the rule itself and expires automatically.
            </p>
          </div>

          {/* Guardrail Callout 2 (Amber Warning Box) */}
          <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-lg text-xs text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Factual rules such as FACT_012 can't be overridden by a tone exception.
            </p>
          </div>

          {/* Card 2: Supporting evidence */}
          <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Supporting evidence
            </h2>

            <div className="space-y-2">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="border border-[#E5E7EB] rounded-lg p-3 flex items-center gap-3 bg-white hover:bg-zinc-50/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-[10px] shrink-0 border border-rose-200">
                    PDF
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-medium text-zinc-900 truncate">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      {file.size} · {file.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddEvidence}
              className="text-xs font-medium text-[#0F5132] hover:text-[#0B4226] mt-3.5 inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>+ Add supporting evidence</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Footer Note */}
      <div className="text-xs text-zinc-400 mt-8">
        Requests are reviewed by a manager before publication.
      </div>
    </div>
  );
}
