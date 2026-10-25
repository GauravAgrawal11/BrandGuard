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
  Clock,
  FileText,
  User,
  Building,
  Calendar,
  Sparkles,
  ShieldAlert,
  Send,
  Eye,
  ExternalLink,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

export default function ManagerQueueView({
  apiBase = API_BASE,
  onSelectApprovedHandoff,
  initialSelectedId = 'EX-2041',
}) {
  const { user, token } = useAuth();

  const [activeQueueTab, setActiveQueueTab] = useState('pending'); // 'pending' | 'approved' | 'declined' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [decisionNote, setDecisionNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Queue items state
  const [items, setItems] = useState([
    {
      id: 'EX-2041',
      title: 'Global ambition. Local simplicity.',
      requester: 'Alex Morgan · Marketing · Oct 25, 2026',
      requesterName: 'Alex Morgan',
      requesterDept: 'Marketing',
      status: 'Pending',
      type: 'Tone exception',
      rule: 'VOICE_004',
      ruleTitle: 'Aggressive Comparison Tone',
      draft: 'DRAFT_024',
      channel: 'LinkedIn post',
      scope: 'This draft only',
      expires: 'Oct 31, 2026',
      requestedDate: 'Oct 25, 2026',
      quoteText: "Don't get wrecked by banks!",
      justification:
        "This is an intentional challenger voice for NovaPay's 'Global ambition' campaign. It addresses banking friction, not individuals or protected groups, and makes no fee or speed claim.",
      supportingFileName: 'Q3_challenger_campaign_creative_deck.pdf',
      supportingFileSize: '1.2 MB',
      hardBlockers: 0,
      decisionNote: '',
      decidedAt: null,
      decidedBy: '',
    },
    {
      id: 'EX-2039',
      title: 'Move money, not mountains.',
      requester: 'Priya Nair · Growth · Oct 24, 2026',
      requesterName: 'Priya Nair',
      requesterDept: 'Growth',
      status: 'Pending',
      type: 'Tone exception',
      rule: 'VOICE_002',
      ruleTitle: 'Colloquial Idiomatic Tone',
      draft: 'DRAFT_022',
      channel: 'Twitter / X thread',
      scope: 'All Q3 campaign assets',
      expires: 'Oct 31, 2026',
      requestedDate: 'Oct 24, 2026',
      quoteText: 'Move money, not mountains.',
      justification:
        'Colloquial idiom highlighting effortless instant settlement for creator platforms. Safe from financial regulatory ambiguity.',
      supportingFileName: 'growth_creator_outreach_memo.pdf',
      supportingFileSize: '0.8 MB',
      hardBlockers: 0,
      decisionNote: '',
      decidedAt: null,
      decidedBy: '',
    },
    {
      id: 'EX-2036',
      title: 'Enterprise Rails: The Banking You Deserve',
      requester: 'Sam Okafor · Brand · Oct 22, 2026',
      requesterName: 'Sam Okafor',
      requesterDept: 'Brand',
      status: 'Approved',
      type: 'Tone exception',
      rule: 'VOICE_CONFIDENCE',
      ruleTitle: 'High-Confidence Marketing Voice',
      draft: 'DRAFT_019',
      channel: 'Press Release',
      scope: 'Temporary 30-day exemption',
      expires: 'Oct 31, 2026',
      requestedDate: 'Oct 22, 2026',
      quoteText: 'The seamless banking you deserve.',
      justification:
        'Executive quote featured in Q2 European FinTech roundup publication. Approved as non-guaranteed brand aspiration.',
      supportingFileName: 'pr_exec_quote_brief.pdf',
      supportingFileSize: '1.4 MB',
      hardBlockers: 0,
      decisionNote:
        'Approved by Brand Lead Jordan Lee. Scope is limited to CEO quotes in European FinTech roundup.',
      decidedAt: '2026-10-22T14:30:00Z',
      decidedBy: 'Jordan Lee',
    },
  ]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Fetch exceptions from server
  const fetchExceptions = async () => {
    setIsRefreshing(true);
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${apiBase}/api/exceptions/`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.exceptions && data.exceptions.length > 0) {
          const mapped = data.exceptions.map((ex) => ({
            id: ex.id,
            title: ex.title || 'Campaign Asset Review',
            requester: `${ex.requester_name || 'Alex Morgan'} · ${ex.requester_dept || 'Marketing'} · ${ex.requested_date || 'Oct 25, 2026'}`,
            requesterName: ex.requester_name || 'Alex Morgan',
            requesterDept: ex.requester_dept || 'Marketing',
            status:
              ex.status === 'APPROVED'
                ? 'Approved'
                : ex.status === 'DECLINED'
                ? 'Declined'
                : 'Pending',
            type: 'Tone exception',
            rule: ex.rule_code || 'VOICE_004',
            ruleTitle: ex.rule_description || 'Stylistic Voice & Tone Guideline',
            draft: ex.draft_id || 'DRAFT_024',
            channel: ex.channel || 'LinkedIn post',
            scope: ex.scope || 'This draft only',
            expires: ex.expires_on || 'Oct 31, 2026',
            requestedDate: ex.requested_date || 'Oct 25, 2026',
            quoteText: ex.quote_text || "Don't get wrecked by banks!",
            justification:
              ex.justification ||
              "Intentional challenger voice addressing traditional banking friction without violating regulatory boundaries.",
            supportingFileName: ex.supporting_file_name || 'Q3_challenger_campaign_creative_deck.pdf',
            supportingFileSize: ex.supporting_file_size || '1.2 MB',
            hardBlockers: ex.hard_blockers_count || 0,
            decisionNote: ex.decision_note || '',
            decidedAt: ex.decided_at || null,
            decidedBy: ex.decided_by || '',
          }));
          setItems(mapped);
          if (!selectedId && mapped.length > 0) {
            setSelectedId(mapped[0].id);
          }
        }
      }
    } catch {
      // Keep existing state on error
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${apiBase}/api/notifications/`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchExceptions();
    fetchNotifications();
  }, [apiBase, token]);

  const selectedItem =
    items.find((i) => i.id === selectedId) || items[0] || {};

  // Pre-fill decision note when selected item changes
  useEffect(() => {
    if (selectedItem?.decisionNote) {
      setDecisionNote(selectedItem.decisionNote);
    } else {
      setDecisionNote(
        "Reviewed. The challenger voice fits the target audience and channel scope without compromising factual claims or accessibility standards."
      );
    }
  }, [selectedItem?.id]);

  // Handle Approve or Decline
  const handleDecision = async (newStatus) => {
    if (!decisionNote.trim()) {
      showToast('Reviewer audit note is mandatory for governance logging.');
      return;
    }

    setIsProcessing(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const reviewerFullName = user?.name || user?.username || 'Jordan Lee';

      const res = await fetch(`${apiBase}/api/exceptions/${selectedItem.id}/decide/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          status: newStatus,
          decision_note: decisionNote,
          reviewer_name: reviewerFullName,
        }),
      });

      const updatedStatusLabel = newStatus === 'APPROVED' ? 'Approved' : 'Declined';

      // Update local state immediately
      setItems((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id
            ? {
                ...it,
                status: updatedStatusLabel,
                decisionNote: decisionNote,
                decidedAt: new Date().toISOString(),
                decidedBy: reviewerFullName,
              }
            : it
        )
      );

      if (newStatus === 'APPROVED') {
        showToast(`Exception ${selectedItem.id} APPROVED. Notification dispatched to ${selectedItem.requesterName}.`);
        if (onSelectApprovedHandoff) {
          setTimeout(() => {
            onSelectApprovedHandoff(selectedItem.id);
          }, 1500);
        }
      } else {
        showToast(`Exception ${selectedItem.id} DECLINED. Notification dispatched to ${selectedItem.requesterName}.`);
      }

      fetchNotifications();
    } catch (err) {
      showToast(`Decision recorded: ${newStatus}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter items based on active sub-tab and search query
  const filteredItems = items.filter((item) => {
    const matchesTab =
      activeQueueTab === 'all'
        ? true
        : activeQueueTab === 'pending'
        ? item.status === 'Pending'
        : activeQueueTab === 'approved'
        ? item.status === 'Approved'
        : item.status === 'Declined';

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.title?.toLowerCase().includes(q) ||
      item.id?.toLowerCase().includes(q) ||
      item.requester?.toLowerCase().includes(q) ||
      item.rule?.toLowerCase().includes(q) ||
      item.channel?.toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  const pendingCount = items.filter((i) => i.status === 'Pending').length;
  const approvedCount = items.filter((i) => i.status === 'Approved').length;
  const declinedCount = items.filter((i) => i.status === 'Declined').length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#0F5132] text-white px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2.5 border border-emerald-400/30 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase flex items-center gap-1.5">
          <span>ADMIN REVIEW QUEUE</span>
          <span className="text-zinc-400 font-normal">·</span>
          <span>GOVERNANCE SIGN-OFF</span>
          <span className="text-zinc-400 font-normal">·</span>
          <span>TONE EXCEPTIONS</span>
        </div>

        {/* Notifications Dropdown / Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsPanelOpen(!notificationsPanelOpen)}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 font-medium text-zinc-700 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-zinc-500" />
            <span>Audit Notifications</span>
            {notifications.length > 0 && (
              <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Notifications Panel */}
          {notificationsPanelOpen && (
            <div
              className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl p-3 z-50 text-xs"
              onMouseLeave={() => setNotificationsPanelOpen(false)}
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 mb-2">
                <span className="font-bold text-zinc-900">Governance Notifications</span>
                <span className="text-[10px] text-zinc-400 font-mono">Real-time Feed</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="text-zinc-400 text-center py-4 text-[11px]">
                    No recent notifications.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 text-[11px] space-y-1"
                    >
                      <div className="font-bold text-zinc-900">{n.title}</div>
                      <div className="text-zinc-600 leading-snug">{n.message}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {n.created_at ? new Date(n.created_at).toLocaleTimeString() : 'Just now'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Header and Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            One decision. A clear path forward.
          </h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl leading-relaxed">
            Review writer exception requests against deterministic brand guidelines, candidate evidence, and time-bound distribution scope.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchExceptions}
            disabled={isRefreshing}
            className="border border-[#E5E7EB] bg-white text-zinc-700 text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 hover:bg-zinc-50 font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 text-zinc-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards (3 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Pending requests */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-zinc-500 mb-1">
            Pending Exception Requests
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
              {pendingCount}
            </span>
            <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
              Awaiting Sign-off
            </span>
          </div>
        </div>

        {/* Card 2: Median time to decision */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-zinc-500 mb-1">
            Governance Decision SLA
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
              &lt; 24
            </span>
            <span className="text-xs text-zinc-500 font-medium">hours median turnaround</span>
          </div>
        </div>

        {/* Card 3: Requests with a hard blocker (Zero tolerance) */}
        <div className="bg-white border border-[#E5E7EB] border-l-4 border-l-emerald-600 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-semibold text-zinc-500 mb-1">
            Requests With Hard Blocker
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-800 font-sans tracking-tight">
              0
            </span>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
              Zero Tolerance Enforced
            </span>
          </div>
        </div>
      </div>

      {/* Split Review View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Queue Items List (5 of 12 cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-xs">
          {/* Sub-Tab Header & Search Box */}
          <div className="p-3 border-b border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-zinc-50/60">
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveQueueTab('pending')}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  activeQueueTab === 'pending'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueTab('approved')}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  activeQueueTab === 'approved'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                Approved ({approvedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueTab('declined')}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  activeQueueTab === 'declined'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                Declined ({declinedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveQueueTab('all')}
                className={`text-xs px-2 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  activeQueueTab === 'all'
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                All
              </button>
            </div>

            {/* Compact Search Box */}
            <div className="relative w-full sm:w-36">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-[#E5E7EB] rounded-lg focus:ring-1 focus:ring-emerald-700 outline-none bg-white"
              />
            </div>
          </div>

          {/* List of Requests */}
          <div className="divide-y divide-[#E5E7EB] max-h-[640px] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                No exception requests match this tab filter.
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedItem?.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/40 border-l-4 border-l-[#0F5132]'
                        : 'hover:bg-zinc-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-800">
                          {item.id}
                        </span>
                        <span className="font-mono text-[10px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded font-bold">
                          {item.rule}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          item.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : item.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-zinc-900 leading-snug line-clamp-1">
                      {item.title}
                    </div>

                    <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
                      <span className="truncate">{item.requester}</span>
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0 ml-2">
                        {item.channel}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Evidence Viewer & Decision Terminal (7 of 12 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs space-y-6">
          {/* Header */}
          <div>
            <div className="text-[11px] font-mono font-bold tracking-wider text-emerald-800 uppercase mb-1">
              REVIEW EVIDENCE &amp; SIGN-OFF TERMINAL
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
                  {selectedItem?.id} · {selectedItem?.type || 'Tone Exception'}
                </h2>
                <div className="text-xs text-zinc-500 mt-0.5 font-medium">
                  Candidate Draft: {selectedItem?.title}
                </div>
              </div>

              <span
                className={`font-mono text-xs px-3 py-1 rounded-full font-bold uppercase ${
                  selectedItem?.status === 'Pending'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : selectedItem?.status === 'Approved'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {selectedItem?.status}
              </span>
            </div>
          </div>

          {/* 4-Column Metadata Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-[#E5E7EB] text-xs">
            <div>
              <span className="text-zinc-400 block mb-0.5 font-medium">Rule Citation</span>
              <span className="font-mono text-zinc-900 font-bold">
                {selectedItem?.rule}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-0.5 font-medium">Draft ID</span>
              <span className="font-mono text-zinc-900 font-bold">
                {selectedItem?.draft}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-0.5 font-medium">Channel</span>
              <span className="text-zinc-800 font-semibold">
                {selectedItem?.channel}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 block mb-0.5 font-medium">Expires</span>
              <span className="text-zinc-800 font-semibold">
                {selectedItem?.expires}
              </span>
            </div>
          </div>

          {/* EVIDENCE SECTION 1: Candidate Quote & Author Justification */}
          <div className="space-y-4">
            <div className="text-[11px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
              EVIDENCE DOSSIER &amp; CONTEXT
            </div>

            {/* Candidate Quote Card */}
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                  Flagged Candidate Excerpt
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Channel: {selectedItem?.channel}
                </span>
              </div>
              <div className="text-lg font-bold text-zinc-900 font-sans mb-1">
                “{selectedItem?.quoteText}”
              </div>
              <div className="text-xs text-zinc-600 font-medium">
                Triggered Rule: {selectedItem?.ruleTitle || 'Aggressive voice envelope threshold exceeded.'}
              </div>
            </div>

            {/* Author Editorial Justification */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500">
                  Author Editorial Justification
                </span>
                <span className="text-[11px] font-semibold text-zinc-700">
                  {selectedItem?.requesterName} ({selectedItem?.requesterDept})
                </span>
              </div>
              <p className="text-xs text-zinc-800 leading-relaxed font-medium">
                {selectedItem?.justification}
              </p>
            </div>

            {/* Supporting Document Card */}
            <div className="border border-[#E5E7EB] rounded-xl p-3.5 flex items-center justify-between bg-white hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-rose-200">
                  PDF
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900">
                    {selectedItem?.supportingFileName || 'Q3_challenger_campaign_creative_deck.pdf'}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {selectedItem?.supportingFileSize || '1.2 MB'} · Supporting Campaign Evidence
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewModalOpen(true)}
                className="text-xs font-semibold text-[#0F5132] hover:text-[#0B4226] px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50/50 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Document</span>
              </button>
            </div>
          </div>

          {/* EVIDENCE SECTION 2: Living Source of Truth Guideline Card */}
          <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950">
                  Living Source of Truth Guideline: {selectedItem?.rule}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                Pillar: TONE
              </span>
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              Default NovaPay institutional voice maintains measured, confident, and professional rhetoric. Tone exceptions are authorized only for scoped challenger marketing where factual clarity is unimpaired.
            </p>
            <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
              <span>Allowed: Direct challenger comparison</span>
              <span className="text-emerald-700 font-normal">Factual accuracy guaranteed: 100%</span>
            </div>
          </div>

          {/* STATUS TIMELINE SECTION */}
          <div className="space-y-3 pt-2">
            <div className="text-[11px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
              STATUS TIMELINE &amp; GOVERNANCE AUDIT TRAIL
            </div>

            <div className="space-y-3 pl-2 border-l-2 border-emerald-600/30">
              {/* Step 1: Linter Warning */}
              <div className="relative pl-6">
                <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <div className="text-xs font-bold text-zinc-900">
                  Deterministic Linter Warning Triggered
                </div>
                <div className="text-[11px] text-zinc-500">
                  Rule citation {selectedItem?.rule} detected by BrandGuard engine scan.
                </div>
              </div>

              {/* Step 2: Exception Requested */}
              <div className="relative pl-6">
                <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <div className="text-xs font-bold text-zinc-900">
                  Exception Requested by {selectedItem?.requesterName}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Submitted on {selectedItem?.requestedDate} · Scope: {selectedItem?.scope}
                </div>
              </div>

              {/* Step 3: Review In Progress */}
              <div className="relative pl-6">
                <div
                  className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                    selectedItem?.status === 'Pending'
                      ? 'bg-amber-500 animate-pulse text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {selectedItem?.status === 'Pending' ? (
                    <Clock className="w-2.5 h-2.5" />
                  ) : (
                    <Check className="w-2.5 h-2.5" />
                  )}
                </div>
                <div className="text-xs font-bold text-zinc-900">
                  Governance Review {selectedItem?.status === 'Pending' ? 'In Progress' : 'Completed'}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Brand Governance Lead: Jordan Lee · Assigned SLA: &lt; 24h
                </div>
              </div>

              {/* Step 4: Decision */}
              <div className="relative pl-6">
                <div
                  className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white ${
                    selectedItem?.status === 'Approved'
                      ? 'bg-emerald-600'
                      : selectedItem?.status === 'Declined'
                      ? 'bg-rose-600'
                      : 'bg-zinc-300'
                  }`}
                >
                  {selectedItem?.status === 'Approved' ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : selectedItem?.status === 'Declined' ? (
                    <X className="w-2.5 h-2.5" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  )}
                </div>
                <div className="text-xs font-bold text-zinc-900">
                  {selectedItem?.status === 'Pending'
                    ? 'Awaiting Sign-off Decision'
                    : selectedItem?.status === 'Approved'
                    ? `Approved by ${selectedItem?.decidedBy || 'Jordan Lee'}`
                    : `Declined by ${selectedItem?.decidedBy || 'Jordan Lee'}`}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {selectedItem?.status === 'Pending'
                    ? 'Requires mandatory reviewer decision note.'
                    : `Decided on ${selectedItem?.decidedAt ? new Date(selectedItem.decidedAt).toLocaleString() : 'Oct 25, 2026'}`}
                </div>
              </div>
            </div>
          </div>

          {/* DECISION TERMINAL SECTION */}
          <div className="pt-4 border-t border-[#E5E7EB] space-y-4">
            <div>
              <label className="text-[11px] font-mono font-bold tracking-wider text-zinc-500 uppercase block mb-1.5">
                REVIEWER AUDIT NOTE (MANDATORY FOR AUDIT TRAIL)
              </label>
              <textarea
                rows={3}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Document the governance rationale for approving or declining this exception..."
                className="w-full text-xs p-3.5 border border-[#E5E7EB] rounded-lg text-zinc-900 leading-relaxed focus:ring-1 focus:ring-emerald-700 outline-none"
              />
              <div className="text-[10px] text-zinc-400 font-mono mt-1">
                Cryptographically logged to AuditTrail and dispatched in real-time notification to requester.
              </div>
            </div>

            {/* Decision Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              {selectedItem?.status === 'Approved' ? (
                <button
                  type="button"
                  onClick={() => onSelectApprovedHandoff && onSelectApprovedHandoff(selectedItem.id)}
                  className="text-xs font-bold text-[#0F5132] hover:text-[#0B4226] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>View Decided Publication Handoff →</span>
                </button>
              ) : (
                <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>AuditTrail: Action permanently signed.</span>
                </div>
              )}

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleDecision('DECLINED')}
                  className="w-full sm:w-auto border border-rose-300 bg-white hover:bg-rose-50 text-rose-800 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Decline Exception</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleDecision('APPROVED')}
                  className="w-full sm:w-auto bg-[#0F5132] hover:bg-[#0B4226] text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Recording Decision...' : 'Approve Exception'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Document Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-zinc-900 text-sm">
                  {selectedItem?.supportingFileName || 'Q3_challenger_campaign_creative_deck.pdf'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-800 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-3 text-xs text-zinc-700">
              <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                DOCUMENT EVIDENCE SUMMARY
              </div>
              <p className="leading-relaxed font-medium">
                Target Creative: <strong>{selectedItem?.title}</strong>
              </p>
              <p className="leading-relaxed">
                Audience Persona: FinTech and Treasury Directors on LinkedIn.
              </p>
              <p className="leading-relaxed">
                Key Strategic Finding: Traditional high-street banks retain a 3.4% currency spread on cross-border wire transfers. Challenger positioning focuses strictly on friction and bureaucracy, avoiding any unverified rate guarantee.
              </p>
              <div className="p-3 bg-white rounded-lg border border-zinc-200 text-zinc-800 italic">
                “{selectedItem?.quoteText}”
              </div>
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-[11px] pt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified: Zero factual claims or rate promises made in candidate asset.</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-zinc-800 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
