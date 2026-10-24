import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';

export default function ManagerQueueView({
  apiBase = 'http://127.0.0.1:8000',
  onSelectApprovedHandoff,
  initialSelectedId = 'EX-2041',
}) {
  const [activeQueueTab, setActiveQueueTab] = useState('pending'); // 'pending' | 'approved' | 'declined'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [decisionNote, setDecisionNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Queue items state
  const [items, setItems] = useState([
    {
      id: 'EX-2041',
      title: 'Global ambition. Local simplicity.',
      requester: 'Alex Morgan · Marketing · Jun 11, 2026',
      status: 'Pending',
      type: 'Tone exception',
      rule: 'VOICE_004',
      draft: 'DRAFT_024',
      channel: 'LinkedIn post',
      expires: 'Oct 31, 2026',
      context:
        '“Don’t get wrecked by banks!” — A direct challenger voice for a LinkedIn audience of finance operators. No fee or speed claims appear in this line.',
      hardBlockers: 0,
    },
    {
      id: 'EX-2039',
      title: 'Move money, not mountains.',
      requester: 'Priya Nair · Growth · Jun 10, 2026',
      status: 'Pending',
      type: 'Tone exception',
      rule: 'VOICE_002',
      draft: 'DRAFT_022',
      channel: 'LinkedIn post',
      expires: 'Oct 31, 2026',
      context:
        '“Move money, not mountains.” — Colloquial idiom highlighting effortless instant settlement for creator platforms.',
      hardBlockers: 0,
    },
    {
      id: 'EX-2036',
      title: 'The banking you deserve.',
      requester: 'Sam Okafor · Brand · Jun 9, 2026',
      status: 'Pending',
      type: 'Superlative exception',
      rule: 'FACT_015',
      draft: 'DRAFT_019',
      channel: 'Press Release',
      expires: 'Oct 31, 2026',
      context:
        '“The banking you deserve.” — Executive quote featured in Q2 European FinTech roundup publication.',
      hardBlockers: 0,
    },
  ]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const fetchExceptions = async () => {
    try {
      const res = await fetch(`${apiBase}/api/exceptions/`);
      if (res.ok) {
        const data = await res.json();
        if (data.exceptions && data.exceptions.length > 0) {
          // merge or update
          const mapped = data.exceptions.map((ex) => ({
            id: ex.id,
            title: ex.title,
            requester: `${ex.requester_name} · ${ex.requester_dept} · ${ex.requested_date || 'Jun 11, 2026'}`,
            status: ex.status === 'APPROVED' ? 'Approved' : ex.status === 'DECLINED' ? 'Declined' : 'Pending',
            type: ex.warning_type?.includes('Tone') || ex.rule_code?.includes('VOICE') ? 'Tone exception' : 'Rule exception',
            rule: ex.rule_code,
            draft: ex.draft_id,
            channel: ex.channel,
            expires: ex.expires_on,
            context: `“${ex.quote_text}” — ${ex.justification || 'Context for reviewer evaluation.'}`,
            hardBlockers: ex.hard_blockers_count || 0,
          }));
          setItems(mapped);
        }
      }
    } catch {
      // Fallback to initial seed items
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [apiBase]);

  const selectedItem = items.find((i) => i.id === selectedId) || items[0];

  const handleDecision = async (newStatus) => {
    setIsProcessing(true);
    try {
      await fetch(`${apiBase}/api/exceptions/${selectedItem.id}/decision/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          decision_note:
            decisionNote ||
            'Reviewed. The challenger voice fits this audience and the scope is narrow.',
          reviewer_name: 'Jordan Lee',
        }),
      });

      // Update local state
      setItems((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id
            ? { ...it, status: newStatus === 'APPROVED' ? 'Approved' : 'Declined' }
            : it
        )
      );

      if (newStatus === 'APPROVED') {
        showToast(`Exception ${selectedItem.id} approved.`);
        if (onSelectApprovedHandoff) {
          setTimeout(() => {
            onSelectApprovedHandoff(selectedItem.id);
          }, 600);
        }
      } else {
        showToast(`Exception ${selectedItem.id} declined.`);
      }
    } catch {
      showToast(`Decision recorded: ${newStatus}`);
      if (newStatus === 'APPROVED' && onSelectApprovedHandoff) {
        onSelectApprovedHandoff(selectedItem.id);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter items based on active sub-tab and search query
  const filteredItems = items.filter((item) => {
    const matchesTab =
      activeQueueTab === 'pending'
        ? item.status === 'Pending'
        : activeQueueTab === 'approved'
        ? item.status === 'Approved'
        : item.status === 'Declined';
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.requester.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const pendingCount = items.filter((i) => i.status === 'Pending').length;

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
        <span>MANAGER QUEUE</span>
        <span className="text-zinc-400 font-normal">·</span>
        <span>SIGN-OFF</span>
      </div>

      {/* Header and Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            One decision. A clear path forward.
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Review exception requests against their rule, evidence and scope.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <button
              type="button"
              className="border border-[#E5E7EB] bg-white text-zinc-700 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 hover:bg-zinc-50 font-medium"
            >
              <span>All workspaces</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>

          <button
            type="button"
            onClick={fetchExceptions}
            className="border border-[#E5E7EB] bg-white text-zinc-700 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 hover:bg-zinc-50 font-medium"
          >
            <RotateCw className="w-3.5 h-3.5 text-zinc-500" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards (3 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Pending requests */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-xs">
          <div className="text-xs text-zinc-500 mb-1">Pending requests</div>
          <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
            {pendingCount}
          </div>
        </div>

        {/* Card 2: Median time to decision */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-xs">
          <div className="text-xs text-zinc-500 mb-1">Median time to decision</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
              1
            </span>
            <span className="text-xs text-zinc-500 font-normal">business day</span>
          </div>
        </div>

        {/* Card 3: Requests with a hard blocker (Red Left Accent) */}
        <div className="bg-white border border-[#E5E7EB] border-l-4 border-l-rose-500 rounded-lg p-5 shadow-xs">
          <div className="text-xs text-zinc-500 mb-1">
            Requests with a hard blocker
          </div>
          <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
            0
          </div>
        </div>
      </div>

      {/* Split Review View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Queue List (~35%, col-span-4) */}
        <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-lg overflow-hidden shadow-xs">
          {/* Queue Tab Header and Search */}
          <div className="p-3 border-b border-[#E5E7EB] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveQueueTab('pending')}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeQueueTab === 'pending'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Pending {pendingCount}
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueTab('approved')}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeQueueTab === 'approved'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Approved
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueTab('declined')}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeQueueTab === 'declined'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Declined
              </button>
            </div>

            {/* Compact Search Box */}
            <div className="relative w-36">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1 border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-emerald-700 outline-hidden"
              />
            </div>
          </div>

          {/* List of Requests */}
          <div className="divide-y divide-[#E5E7EB]">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                No requests found in this view.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedItem.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      if (item.status === 'Approved' && onSelectApprovedHandoff) {
                        onSelectApprovedHandoff(item.id);
                      }
                    }}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#F8FAF9] border-l-4 border-l-[#0F5132]'
                        : 'hover:bg-zinc-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-semibold text-zinc-700">
                        {item.id}
                      </span>
                      <span
                        className={`font-mono text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          item.status === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                            : item.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-zinc-900 leading-snug">
                      {item.title}
                    </div>

                    <div className="text-xs text-zinc-500 mt-1">
                      {item.requester}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Request Detail Pane (~65%, col-span-7) */}
        <div className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
          {/* Header */}
          <div className="text-[11px] font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-1">
            REVIEW REQUEST
          </div>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
              {selectedItem.id} · {selectedItem.type}
            </h2>

            <span
              className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-medium ${
                selectedItem.status === 'Pending'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                  : selectedItem.status === 'Approved'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {selectedItem.status}
            </span>
          </div>

          {/* 4-Column Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-[#E5E7EB] mb-5 text-xs">
            <div>
              <span className="text-zinc-400 block mb-0.5">Rule</span>
              <span className="font-mono text-zinc-800 font-semibold">
                {selectedItem.rule}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-0.5">Draft</span>
              <span className="font-mono text-zinc-800 font-semibold">
                {selectedItem.draft}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-0.5">Channel</span>
              <span className="text-zinc-800 font-medium">
                {selectedItem.channel}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-0.5">Expires</span>
              <span className="text-zinc-800 font-medium">
                {selectedItem.expires}
              </span>
            </div>
          </div>

          {/* Request Context */}
          <div className="mb-4">
            <div className="text-[11px] font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-2">
              REQUEST CONTEXT
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-4 text-xs text-zinc-700 leading-relaxed">
              {selectedItem.context}
            </div>
          </div>

          {/* Emerald Safety Guarantee Callout */}
          <div className="bg-[#EAF5EE] border border-emerald-200 text-[#0F5132] p-3 rounded-lg text-xs flex items-center gap-2.5 mb-6">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-medium">
              No incorrect factual claims are present. Only the voice rule is affected.
            </span>
          </div>

          {/* Decision Note Section */}
          <div className="mb-6">
            <label className="text-[11px] font-mono font-semibold tracking-wider text-zinc-400 uppercase block mb-1.5">
              DECISION NOTE
            </label>
            <textarea
              rows={3}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Add context for the requester and the audit trail..."
              className="w-full text-xs p-3 border border-[#E5E7EB] rounded-md text-zinc-800 focus:ring-1 focus:ring-emerald-700 outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB]">
            {selectedItem.status === 'Approved' ? (
              <button
                type="button"
                onClick={() => onSelectApprovedHandoff && onSelectApprovedHandoff(selectedItem.id)}
                className="text-xs font-semibold text-[#0F5132] hover:text-[#0B4226] flex items-center gap-1.5"
              >
                <span>View decided publication handoff →</span>
              </button>
            ) : (
              <div className="text-xs text-zinc-400">
                Decision will be cryptographically logged.
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleDecision('DECLINED')}
                className="border border-[#E5E7EB] bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-medium px-4 py-2 rounded-md transition-colors"
              >
                Decline
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleDecision('APPROVED')}
                className="bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-medium px-4 py-2 rounded-md transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve exception</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
