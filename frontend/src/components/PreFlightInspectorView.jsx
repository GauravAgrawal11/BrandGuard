import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UploadCloud,
  RefreshCw,
  ArrowRight,
  SlidersHorizontal,
  Check,
  Eye,
  Sliders,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  ExternalLink,
  Lock,
  GitBranch,
  Wand2,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE } from '../config/api';

export default function PreFlightInspectorView({
  onRequestException,
  onNavigateToRule,
  initialSubmissionId = null,
  apiBase = API_BASE,
}) {
  const { user, token, isAdmin, isWriter } = useAuth();
  const { t } = useLanguage();

  // Submission State
  const [submissionId, setSubmissionId] = useState(initialSubmissionId);
  const [currentVersionNumber, setCurrentVersionNumber] = useState(1);
  const [draftTitle, setDraftTitle] = useState('Global Launch Campaign · Cross-Border Rails');
  const [channel, setChannel] = useState('LINKEDIN_POST');
  const [confidentialMode, setConfidentialMode] = useState(false);
  const [draftText, setDraftText] = useState(
    "Don't get wrecked by banks! Our cheap transfers settle in 24 hrs with a 0.5% FX fee. We delve into enterprise cross-border liquidity in today's fast-paced landscape."
  );

  // File / Visual state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [useSampleBanner, setUseSampleBanner] = useState(false);

  // Active Tab: 'text' | 'visual' | 'tone'
  const [activeTab, setActiveTab] = useState('text');

  // Inspection & Scoring State
  const [isAuditing, setIsAuditing] = useState(false);
  const [readinessScore, setReadinessScore] = useState(64.0);
  const [scoreBreakdown, setScoreBreakdown] = useState({
    base_score: 100.0,
    blockers_count: 2,
    blockers_deduction: 36.0,
    blocker_rate: 18.0,
    warnings_count: 0,
    warnings_deduction: 0.0,
    warning_rate: 8.0,
    approved_exceptions_count: 0,
    approved_exceptions_deduction: 0.0,
    total_deductions: 36.0,
    final_score: 64.0
  });
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);

  // Findings & Voice Fingerprint
  const [findings, setFindings] = useState([]);
  const [voiceFingerprint, setVoiceFingerprint] = useState(null);
  const [selectedFindingId, setSelectedFindingId] = useState(null);

  // Interactive Features
  const [colorBlindMode, setColorBlindMode] = useState(false); // Deuteranopia toggle
  const [beforeAfterSliderPos, setBeforeAfterSliderPos] = useState(50); // 0-100%
  const [liveLintStatus, setLiveLintStatus] = useState('idle'); // 'idle' | 'linting' | 'clean' | 'flags_found'
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Debounce ref for live lexicon linting
  const liveLintTimerRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const getAuthHeaders = (isJson = true) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
  };

  // Run full multi-modal audit (POST /api/submissions/audit/)
  const handleRunAudit = async (customText = null, customUseBanner = null) => {
    setIsAuditing(true);
    const textToAudit = customText !== null ? customText : draftText;
    const bannerFlag = customUseBanner !== null ? customUseBanner : useSampleBanner;

    try {
      let res;
      if (uploadedFile) {
        const formData = new FormData();
        formData.append('title', draftTitle);
        formData.append('channel_context', channel);
        formData.append('confidential_mode', confidentialMode ? 'true' : 'false');
        formData.append('raw_text', textToAudit);
        formData.append('file', uploadedFile);
        formData.append('use_sample_banner', bannerFlag ? 'true' : 'false');

        res = await fetch(`${apiBase}/api/submissions/audit/`, {
          method: 'POST',
          headers: getAuthHeaders(false),
          body: formData
        });
      } else {
        res = await fetch(`${apiBase}/api/submissions/audit/`, {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            title: draftTitle,
            channel_context: channel,
            confidential_mode: confidentialMode,
            raw_text: textToAudit,
            use_sample_banner: bannerFlag
          })
        });
      }

      if (res.ok) {
        const subData = await res.json();
        setSubmissionId(subData.id);

        const latestVer = subData.versions?.[subData.versions.length - 1];
        if (latestVer) {
          setCurrentVersionNumber(latestVer.version_number);
          setReadinessScore(latestVer.compliance_score);
          if (latestVer.score_breakdown) setScoreBreakdown(latestVer.score_breakdown);
          if (latestVer.voice_fingerprint) setVoiceFingerprint(latestVer.voice_fingerprint);
          setFindings(latestVer.findings || []);

          if (latestVer.uploaded_file_url) {
            setImagePreviewUrl(`${apiBase}${latestVer.uploaded_file_url}`);
          }
        }
        showToast(`Pre-flight audit complete: ${latestVer?.findings?.length || 0} checks recorded.`);
      } else {
        showToast('Audit failed. Please verify input parameters.', 'error');
      }
    } catch (err) {
      console.error('Audit network error:', err);
      showToast('Network error during pre-flight audit.', 'error');
    } finally {
      setIsAuditing(false);
    }
  };

  // Real-time debounced live lexicon linting
  const triggerDebouncedLiveLint = (text) => {
    if (liveLintTimerRef.current) {
      clearTimeout(liveLintTimerRef.current);
    }
    setLiveLintStatus('linting');

    liveLintTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/api/submissions/live-lint/`, {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            raw_text: text,
            channel_context: channel
          })
        });

        if (res.ok) {
          const data = await res.json();
          // Update live projected score & live findings
          if (data.score_breakdown) {
            setScoreBreakdown(data.score_breakdown);
            setReadinessScore(data.compliance_score);
          }
          if (data.voice_fingerprint) {
            setVoiceFingerprint(data.voice_fingerprint);
          }
          // Merge live findings for real-time highlighting
          if (data.findings) {
            setFindings((prevFindings) => {
              const visualFindings = prevFindings.filter((f) => f.pillar === 'VISUAL');
              return [...visualFindings, ...data.findings];
            });
            setLiveLintStatus(data.findings.length > 0 ? 'flags_found' : 'clean');
          }
        }
      } catch (err) {
        setLiveLintStatus('idle');
      }
    }, 300);
  };

  // Text change handler
  const handleTextChange = (e) => {
    const val = e.target.value;
    setDraftText(val);
    triggerDebouncedLiveLint(val);
  };

  // 1-Click "Apply Patch"
  const handleApplyPatch = async (finding) => {
    const fix = finding.suggested_fixes?.[0];
    if (!fix) return;

    let replacement = fix;
    if (replacement.startsWith("Replace with '") && replacement.endsWith("'")) {
      replacement = replacement.slice(14, -1);
    } else if (replacement.startsWith("Replace with ")) {
      replacement = replacement.slice(13);
    }

    const excerpt = finding.source_excerpt;
    let patchedText = draftText;
    if (excerpt && patchedText.includes(excerpt)) {
      patchedText = patchedText.replace(excerpt, replacement);
    } else {
      patchedText = `${patchedText} ${replacement}`;
    }

    setDraftText(patchedText);

    // If an active submission exists in backend, call resolve endpoint
    if (finding.id && submissionId) {
      try {
        const res = await fetch(`${apiBase}/api/findings/${finding.id}/resolve/`, {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            action: 'ACCEPT_FIX',
            chosen_fix: fix
          })
        });
        if (res.ok) {
          const data = await res.json();
          const latestVer = data.submission?.versions?.[data.submission.versions.length - 1];
          if (latestVer) {
            setCurrentVersionNumber(latestVer.version_number);
            setReadinessScore(latestVer.compliance_score);
            if (latestVer.score_breakdown) setScoreBreakdown(latestVer.score_breakdown);
            setFindings(latestVer.findings || []);
          }
          showToast(`Patch applied! Created Version v${latestVer?.version_number || currentVersionNumber + 1}.`);
          return;
        }
      } catch (err) {
        // Fallback to local patch
      }
    }

    // Local patch re-lint
    triggerDebouncedLiveLint(patchedText);
    showToast(`Patched copy with "${replacement}".`);
  };

  // Initial load
  useEffect(() => {
    if (initialSubmissionId) {
      // Load specific submission
      fetch(`${apiBase}/api/submissions/${initialSubmissionId}/`, { headers: getAuthHeaders(false) })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.id) {
            setSubmissionId(data.id);
            setDraftTitle(data.title);
            setChannel(data.channel_context);
            const latestVer = data.versions?.[data.versions.length - 1];
            if (latestVer) {
              setDraftText(latestVer.raw_text || '');
              setCurrentVersionNumber(latestVer.version_number);
              setReadinessScore(latestVer.compliance_score);
              if (latestVer.score_breakdown) setScoreBreakdown(latestVer.score_breakdown);
              if (latestVer.voice_fingerprint) setVoiceFingerprint(latestVer.voice_fingerprint);
              setFindings(latestVer.findings || []);
              if (latestVer.uploaded_file_url) {
                setImagePreviewUrl(`${apiBase}${latestVer.uploaded_file_url}`);
              }
            }
          }
        })
        .catch(() => {});
    } else {
      // Run initial audit on default text
      handleRunAudit();
    }
  }, [initialSubmissionId]);

  // Load sample banner helper
  const handleLoadSampleBanner = () => {
    setUseSampleBanner(true);
    setImagePreviewUrl(`${apiBase}/media/sample_offbrand_banner.png`);
    setActiveTab('visual');
    handleRunAudit(draftText, true);
  };

  // Export Executive PDF Audit Report
  const handleExportPdf = async () => {
    const targetId = submissionId || 'default';
    try {
      showToast('Generating executive PDF compliance report...', 'info');
      const res = await fetch(`${apiBase}/api/submissions/${targetId}/export-pdf/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BrandGuard_Audit_${draftTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${String(targetId).slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Executive PDF audit dossier downloaded!', 'success');
    } catch (err) {
      showToast(`PDF export failed: ${err.message}`, 'error');
    }
  };

  // Filter findings for active tab
  const visualFindings = findings.filter((f) => f.pillar === 'VISUAL');
  const textFindings = findings.filter((f) => f.pillar === 'TONE' || f.pillar === 'FACTUAL');
  const toneFindings = findings.filter((f) => f.pillar === 'TONE');

  // Color-coded score styling
  const scoreBadgeBg =
    readinessScore >= 90
      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
      : readinessScore >= 75
      ? 'bg-amber-50 text-amber-800 border-amber-300'
      : 'bg-rose-50 text-rose-800 border-rose-300';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* SVG Daltonization Matrix Filter for Deuteranopia Simulation */}
      <svg className="hidden">
        <filter id="deuteranopia-cvd-matrix">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"
          />
        </filter>
      </svg>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-2xl flex items-center space-x-3 text-sm font-medium transition-all ${
            toastType === 'error'
              ? 'bg-rose-950 text-rose-100 border border-rose-800'
              : 'bg-emerald-950 text-emerald-100 border border-emerald-800'
          }`}
        >
          {toastType === 'error' ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Version Pill */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase flex items-center gap-2">
          <span>PRE-FLIGHT COMPILER &amp; LINTER</span>
          <span className="text-zinc-300">/</span>
          <span>{channel.replace('_', ' ')}</span>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-600 font-mono">DRAFT v{currentVersionNumber}</span>
        </div>

        <div className="flex items-center space-x-2">
          {liveLintStatus === 'linting' && (
            <span className="text-[11px] font-mono text-zinc-500 flex items-center">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin text-emerald-600" />
              Live Lexicon Linting...
            </span>
          )}
          {liveLintStatus === 'flags_found' && (
            <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Live Flags Active
            </span>
          )}
          {liveLintStatus === 'clean' && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center">
              <Check className="w-3 h-3 mr-1" />
              Live Lexicon Clean
            </span>
          )}
        </div>
      </div>

      {/* Main Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-zinc-200 gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="text-2xl font-bold tracking-tight text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-emerald-600 focus:outline-none w-full py-0.5 transition"
            placeholder="Campaign Draft Title..."
          />
          <p className="text-xs text-zinc-500 mt-1">
            Deterministic pre-flight compiler for NovaPay marketing communications. Multi-modal inspection across Visual, Text, and Voice.
          </p>
        </div>

        {/* Global Inspector Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (onRequestException) {
                onRequestException({
                  submissionId: submissionId || 'DRAFT_024',
                  draftTitle: draftTitle,
                  channel: channel,
                  quoteText: "Don't get wrecked by banks!",
                  ruleCode: 'VOICE_004',
                  ruleTitle: 'Aggressive Comparison Tone',
                  explanation: 'Aggressive comparison tone is outside the default voice range.',
                });
              }
            }}
            className="inline-flex items-center px-3.5 py-2 border border-zinc-300 shadow-sm text-xs font-semibold rounded-lg text-zinc-700 bg-white hover:bg-zinc-50 transition cursor-pointer"
          >
            <span>Request Exception</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5 text-zinc-500" />
          </button>

          <button
            type="button"
            onClick={handleLoadSampleBanner}
            className="inline-flex items-center px-3.5 py-2 border border-indigo-200 bg-indigo-50/60 shadow-sm text-xs font-semibold rounded-lg text-indigo-700 hover:bg-indigo-100 transition"
            title="Load sample offbrand banner with visual violations"
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Sample Banner
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 shadow-xs text-xs font-semibold rounded-lg text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition cursor-pointer"
            title="Export executive PDF audit report dossier"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('btn_export_pdf', 'Export PDF Audit Report')}</span>
          </button>

          <button
            type="button"
            disabled={isAuditing}
            onClick={() => handleRunAudit()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-lg shadow-sm text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-50"
          >
            {isAuditing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                Auditing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Run Pre-Flight Audit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Readiness Score Breakdown Banner */}
      <div className="my-6 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            {/* Score Ring / Pill */}
            <div className={`px-4 py-3 rounded-xl border flex flex-col items-center justify-center min-w-[100px] ${scoreBadgeBg}`}>
              <span className="font-mono text-3xl font-extrabold leading-none">{readinessScore}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80">Score / 100</span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-zinc-900">
                  {readinessScore >= 90
                    ? 'Brand-Compliance Cleared'
                    : readinessScore >= 75
                    ? 'Advisory Warning Clearance Required'
                    : 'Publication Blocked'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${scoreBadgeBg}`}>
                  {readinessScore >= 90 ? 'Ready' : readinessScore >= 75 ? 'Soft Stop' : 'Hard Stop'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1 max-w-xl">
                {readinessScore >= 90
                  ? 'All blocker rules passed. Campaign copy and visuals comply with NovaPay brand guidelines.'
                  : `Detected ${scoreBreakdown.blockers_count} blocker(s) and ${scoreBreakdown.warnings_count} advisory warning(s). Apply patches below to raise score.`}
              </p>
            </div>
          </div>

          {/* Breakdown Toggle */}
          <button
            onClick={() => setScoreBreakdownOpen(!scoreBreakdownOpen)}
            className="inline-flex items-center text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 transition self-start sm:self-center"
          >
            <span>Score Breakdown</span>
            {scoreBreakdownOpen ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>
        </div>

        {/* Expandable Mathematical Breakdown Accordion */}
        {scoreBreakdownOpen && (
          <div className="mt-4 pt-4 border-t border-zinc-100 text-xs animate-fade-in">
            <span className="font-bold text-zinc-700 block mb-2 uppercase tracking-wide text-[11px]">
              Mathematical Score Attribution
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 font-mono">
              <div>
                <span className="text-zinc-500 block text-[11px]">Base Score:</span>
                <span className="font-bold text-zinc-900 text-sm">100.0 pts</span>
              </div>
              <div>
                <span className="text-rose-600 block text-[11px]">
                  Blockers ({scoreBreakdown.blockers_count} × -{scoreBreakdown.blocker_rate}):
                </span>
                <span className="font-bold text-rose-700 text-sm">-{scoreBreakdown.blockers_deduction} pts</span>
              </div>
              <div>
                <span className="text-amber-600 block text-[11px]">
                  Warnings ({scoreBreakdown.warnings_count} × -{scoreBreakdown.warning_rate}):
                </span>
                <span className="font-bold text-amber-700 text-sm">-{scoreBreakdown.warnings_deduction} pts</span>
              </div>
              <div>
                <span className="text-emerald-700 block text-[11px]">
                  Approved Exceptions (+{scoreBreakdown.approved_exceptions_count}):
                </span>
                <span className="font-bold text-emerald-800 text-sm">+{scoreBreakdown.approved_exceptions_deduction} pts</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs: Visual | Text | Tone */}
      <div className="flex items-center space-x-2 border-b border-zinc-200 mb-6">
        <button
          onClick={() => setActiveTab('text')}
          className={`pb-3 px-3 text-sm font-semibold transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'text'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Text &amp; Lexicon ({textFindings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('visual')}
          className={`pb-3 px-3 text-sm font-semibold transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'visual'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Visual &amp; CVD ({visualFindings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tone')}
          className={`pb-3 px-3 text-sm font-semibold transition border-b-2 flex items-center space-x-2 ${
            activeTab === 'tone'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          <span>Tone &amp; Radar ({toneFindings.length})</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: TEXT & LEXICON (HIGHLIGHTED SPANS + 1-CLICK PATCHES)    */}
      {/* ============================================================== */}
      {activeTab === 'text' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Text Editor + Highlighted Spans */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide flex items-center">
                  <FileText className="w-4 h-4 mr-1 text-emerald-700" />
                  Live Campaign Copy Editor
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  {draftText.length} characters · 0ms deterministic linter
                </span>
              </div>

              {/* Textarea with debounced live linting */}
              <textarea
                rows={6}
                value={draftText}
                onChange={handleTextChange}
                placeholder="Paste marketing copy, headline, or announcement here..."
                className="w-full text-sm leading-relaxed p-3.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-sans text-zinc-900 bg-zinc-50/30"
              />

              {/* Highlighted Spans Preview Card */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                    Live Highlighted Findings View
                  </span>
                  <span className="text-[11px] text-zinc-400">Click highlighted tokens to view rule citation</span>
                </div>

                <div className="p-4 bg-zinc-50/70 rounded-xl border border-zinc-200 text-sm leading-relaxed text-zinc-800 font-sans min-h-[80px]">
                  {/* Tokenizer highlighting banned phrases */}
                  {(() => {
                    const words = draftText.split(/(\s+)/);
                    return words.map((token, idx) => {
                      const clean = token.toLowerCase().replace(/[^a-z0-9]/g, '');
                      // Check if matches any finding excerpt
                      const matchFinding = findings.find(
                        (f) =>
                          f.source_excerpt &&
                          (token.toLowerCase().includes(f.source_excerpt.toLowerCase()) ||
                            clean === f.source_excerpt.toLowerCase() ||
                            f.source_excerpt.toLowerCase().includes(clean))
                      );

                      if (matchFinding) {
                        const isBlocker = matchFinding.severity === 'BLOCKER';
                        const isSelected = selectedFindingId === matchFinding.id;

                        return (
                          <span
                            key={idx}
                            onClick={() => setSelectedFindingId(matchFinding.id)}
                            className={`cursor-pointer px-1 py-0.5 rounded font-medium transition ${
                              isBlocker
                                ? 'bg-rose-200/80 text-rose-950 underline decoration-rose-500 decoration-wavy'
                                : 'bg-amber-200/80 text-amber-950 underline decoration-amber-500 decoration-wavy'
                            } ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
                            title={`[${matchFinding.rule_citation_code}] ${matchFinding.rule_citation_title}`}
                          >
                            {token}
                          </span>
                        );
                      }
                      return <span key={idx}>{token}</span>;
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Findings List & 1-Click "Apply Patch" */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                Detected Rules &amp; Patches ({textFindings.length})
              </span>
              <span className="text-[11px] text-zinc-400">1-click patches update copy into v{currentVersionNumber + 1}</span>
            </div>

            {textFindings.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-zinc-900">Zero Lexicon Violations</h4>
                <p className="text-xs text-zinc-500 mt-1">Copy passes all deterministic brand tone and fact checks.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {textFindings.map((finding, idx) => {
                  const isBlocker = finding.severity === 'BLOCKER';
                  const isSelected = selectedFindingId === finding.id;

                  return (
                    <div
                      key={finding.id || idx}
                      onClick={() => setSelectedFindingId(finding.id)}
                      className={`p-4 rounded-xl border transition cursor-pointer bg-white ${
                        isSelected
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                          : isBlocker
                          ? 'border-rose-200 hover:border-rose-300'
                          : 'border-amber-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              isBlocker ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {finding.rule_citation_code}
                          </span>
                          <span className="text-xs font-bold text-zinc-900 line-clamp-1">
                            {finding.rule_citation_title}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isBlocker ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {finding.severity}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-zinc-700 leading-relaxed font-sans">
                        {finding.explanation}
                      </div>

                      {finding.source_excerpt && (
                        <div className="mt-2 text-xs font-mono bg-zinc-50 p-2 rounded border border-zinc-200">
                          <span className="text-zinc-400">Trigger: </span>
                          <span className="text-rose-700 font-bold">"{finding.source_excerpt}"</span>
                        </div>
                      )}

                      {/* 1-Click Patch Button */}
                      {finding.suggested_fixes && finding.suggested_fixes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between">
                          <span className="text-[11px] text-emerald-800 font-semibold line-clamp-1">
                            ✓ {finding.suggested_fixes[0]}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApplyPatch(finding);
                            }}
                            className="inline-flex items-center px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition shadow-xs flex-shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            Apply Patch
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: VISUAL & CVD (BOUNDING BOXES, SLIDER, DEUTERANOPIA)      */}
      {/* ============================================================== */}
      {activeTab === 'visual' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Visual Inspector with Bounding Boxes & Before/After Slider */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              {/* Controls Toolbar: Deuteranopia Toggle + Before/After Slider toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-200 gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-zinc-800 uppercase tracking-wide">
                    Computer Vision Canvas
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    (CIEDE2000 ΔE · WCAG 2.1 AA · Clear-Space)
                  </span>
                </div>

                {/* Color-Blind Deuteranopia Toggle Button */}
                <button
                  type="button"
                  onClick={() => setColorBlindMode(!colorBlindMode)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    colorBlindMode
                      ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  {colorBlindMode ? 'Deuteranopia CVD: ON' : 'Simulate Deuteranopia'}
                </button>
              </div>

              {/* Color Blind Notice */}
              {colorBlindMode && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start space-x-2 animate-fade-in">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Deuteranopia Daltonization active (affects ~8% of males):</strong> Witness how red and green luminance collapse into ambiguous yellowish-gray tones. Notice low-contrast text becoming illegible.
                  </span>
                </div>
              )}

              {/* Image Canvas with Interactive Bounding Box Overlays */}
              <div
                className="relative rounded-xl border border-zinc-300 overflow-hidden bg-zinc-950 flex items-center justify-center min-h-[360px]"
                style={{
                  filter: colorBlindMode ? 'url(#deuteranopia-cvd-matrix)' : 'none',
                }}
              >
                {imagePreviewUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={imagePreviewUrl}
                      alt="Audited Visual Asset"
                      className="max-h-[460px] w-auto object-contain select-none"
                    />

                    {/* Bounding Box Overlays from visual findings */}
                    {visualFindings.map((vf, idx) => {
                      const loc = vf.location_json || {};
                      if (!loc.w_pct) return null;
                      const isBlocker = vf.severity === 'BLOCKER';
                      const isSelected = selectedFindingId === vf.id;

                      return (
                        <div
                          key={vf.id || idx}
                          onClick={() => setSelectedFindingId(vf.id)}
                          style={{
                            left: `${loc.x_pct}%`,
                            top: `${loc.y_pct}%`,
                            width: `${loc.w_pct}%`,
                            height: `${loc.h_pct}%`,
                          }}
                          className={`absolute cursor-pointer transition-all border-2 ${
                            loc.is_exclusion_zone ? 'border-dashed' : 'border-solid'
                          } ${
                            isSelected
                              ? 'border-emerald-400 bg-emerald-500/20 ring-4 ring-emerald-400/40'
                              : isBlocker
                              ? 'border-rose-500 bg-rose-500/15 hover:bg-rose-500/25'
                              : 'border-amber-400 bg-amber-400/15 hover:bg-amber-400/25'
                          }`}
                        >
                          <span
                            className={`absolute -top-6 left-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow ${
                              isBlocker ? 'bg-rose-600 text-white' : 'bg-amber-500 text-black'
                            }`}
                          >
                            {vf.rule_citation_code}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-8 text-zinc-400 space-y-3">
                    <UploadCloud className="w-10 h-10 mx-auto text-zinc-500" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-300">No Visual Asset Loaded</p>
                      <p className="text-xs text-zinc-500">Upload a banner or load the sample banner to view CV bounding boxes.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadSampleBanner}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Load Sample Banner
                    </button>
                  </div>
                )}
              </div>

              {/* Before / After Comparison Slider */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                    Before vs After Compliance Adjustment Slider
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Split Position: {beforeAfterSliderPos}%
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-[11px] font-bold text-rose-700">Before (Off-brand)</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beforeAfterSliderPos}
                    onChange={(e) => setBeforeAfterSliderPos(Number(e.target.value))}
                    className="flex-1 accent-emerald-700 cursor-pointer h-1.5 bg-zinc-200 rounded-lg"
                  />
                  <span className="text-[11px] font-bold text-emerald-700">After (Brand-Cleared)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Findings List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                Visual Violations ({visualFindings.length})
              </span>
              <span className="text-[11px] text-zinc-400">WCAG &amp; CIEDE2000</span>
            </div>

            {visualFindings.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-zinc-900">Visuals Compliant</h4>
                <p className="text-xs text-zinc-500 mt-1">
                  Palette swatches within ΔE 4.0 tolerance. Contrast ratios satisfy WCAG 2.1 AA (4.5:1).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visualFindings.map((vf, idx) => {
                  const isBlocker = vf.severity === 'BLOCKER';
                  const isSelected = selectedFindingId === vf.id;

                  return (
                    <div
                      key={vf.id || idx}
                      onClick={() => setSelectedFindingId(vf.id)}
                      className={`p-4 rounded-xl border transition cursor-pointer bg-white ${
                        isSelected
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                          : isBlocker
                          ? 'border-rose-200 hover:border-rose-300'
                          : 'border-amber-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isBlocker ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {vf.rule_citation_code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isBlocker ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {vf.severity}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-zinc-900 mt-1.5">{vf.rule_citation_title}</h4>
                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{vf.explanation}</p>

                      {vf.suggested_fixes && vf.suggested_fixes.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-zinc-100 text-[11px] text-emerald-800 font-semibold">
                          Recommendation: {vf.suggested_fixes[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: TONE & VOICE FINGERPRINT RADAR                          */}
      {/* ============================================================== */}
      {activeTab === 'tone' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 4-Axis Voice Radar Card */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center">
                    <Wand2 className="w-4 h-4 mr-2 text-indigo-600" />
                    4-Axis Voice Fingerprint Radar
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Evaluates copy against the approved NovaPay institutional envelope for {channel.replace('_', ' ')}.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                  Target: {channel}
                </span>
              </div>

              {/* 4-Axis Voice Indicators */}
              <div className="space-y-4">
                {[
                  {
                    axis: 'Confidence',
                    val: voiceFingerprint?.confidence || 0.82,
                    target: '0.70 - 0.90',
                    desc: 'Balanced institutional authority without overbearing arrogance.',
                  },
                  {
                    axis: 'Directness',
                    val: voiceFingerprint?.directness || 0.78,
                    target: '0.65 - 0.85',
                    desc: 'Clear, crisp value propositions; zero conversational AI filler.',
                  },
                  {
                    axis: 'Precision',
                    val: voiceFingerprint?.precision || 0.88,
                    target: '0.80 - 0.95',
                    desc: 'Quantifiable operational metrics (e.g. 24h settlement, 0.5% fee).',
                  },
                  {
                    axis: 'Warmth',
                    val: voiceFingerprint?.warmth || 0.55,
                    target: '0.40 - 0.65',
                    desc: 'Professional fintech courtesy without informal slang.',
                  },
                ].map((item) => (
                  <div key={item.axis} className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-900">{item.axis}</span>
                      <span className="font-mono text-zinc-600">
                        Observed: <strong>{Math.round(item.val * 100)}%</strong> · Target: {item.target}
                      </span>
                    </div>
                    {/* Bar meter */}
                    <div className="mt-2 w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round(item.val * 100))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Tone Violations & Softening Patches */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 uppercase tracking-wide">
                Tone Linter Findings ({toneFindings.length})
              </span>
              <span className="text-[11px] text-zinc-400">Executive voice policy</span>
            </div>

            {toneFindings.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-zinc-900">Voice Policy Cleared</h4>
                <p className="text-xs text-zinc-500 mt-1">Copy aligns with the NovaPay executive voice envelope.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {toneFindings.map((tf, idx) => (
                  <div key={tf.id || idx} className="p-4 rounded-xl border border-zinc-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-50 text-indigo-700">
                        {tf.rule_citation_code}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-rose-50 text-rose-700">
                        {tf.severity}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-zinc-900">{tf.rule_citation_title}</h4>
                    <p className="text-xs text-zinc-600 leading-relaxed">{tf.explanation}</p>

                    <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-emerald-800 font-semibold line-clamp-1">
                        {tf.suggested_fixes && tf.suggested_fixes.length > 0 ? `✓ ${tf.suggested_fixes[0]}` : tf.rule_citation_title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (onRequestException) {
                              onRequestException({
                                submissionId: submissionId || 'DRAFT_024',
                                draftTitle: draftTitle,
                                channel: channel,
                                quoteText: tf.highlighted_text || draftText.slice(0, 40) || "Don't get wrecked by banks!",
                                ruleCode: tf.rule_citation_code,
                                ruleTitle: tf.rule_citation_title,
                                explanation: tf.explanation,
                              });
                            }
                          }}
                          className="inline-flex items-center px-2 py-1 border border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded text-xs font-medium transition cursor-pointer"
                        >
                          Request Exception
                        </button>
                        {tf.suggested_fixes && tf.suggested_fixes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleApplyPatch(tf)}
                            className="inline-flex items-center px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition cursor-pointer"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
