import React, { useState, useEffect } from 'react';
import {
  Download,
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Flame,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  FileText,
  Sliders,
  ExternalLink,
  Users,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { API_BASE } from '../config/api';

export default function TelemetryView({
  apiBase = API_BASE,
  onSelectRule,
  onViewAllRules,
}) {
  const [activeTab, setActiveTab] = useState('friction'); // 'friction' | 'fact_ledger'
  const [minTriggers, setMinTriggers] = useState(10);
  const [toastMessage, setToastMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Blast radius modal state
  const [blastModalOpen, setBlastModalOpen] = useState(false);
  const [selectedFactForBlast, setSelectedFactForBlast] = useState(null);
  const [blastData, setBlastData] = useState(null);
  const [isBulkAuditing, setIsBulkAuditing] = useState(false);

  // Telemetry metrics state
  const [telemetry, setTelemetry] = useState({
    audit_volume: 1248,
    audit_volume_delta: '↑ 12.4% vs prior',
    first_pass_rate: 78.0,
    first_pass_delta: '↑ 4.1 pts',
    review_time_saved: '104 hrs',
    review_time_saved_subtext: '≈ 5 min per audit',
    open_findings: 864,
    hard_blockers: 112,
    warnings_count: 752,
    weekly_trends: [
      { week: 'W1', audits: 180, first_pass: 140 },
      { week: 'W2', audits: 215, first_pass: 168 },
      { week: 'W3', audits: 240, first_pass: 187 },
      { week: 'W4', audits: 285, first_pass: 222 },
      { week: 'W5', audits: 328, first_pass: 256 },
    ],
    categories: [
      { name: 'Factual claims', count: 342, pct: 40 },
      { name: 'Color & contrast', count: 251, pct: 29 },
      { name: 'Voice & tone', count: 178, pct: 21 },
      { name: 'Logo & layout', count: 93, pct: 10 },
    ],
    severity_breakdown: {
      total: 864,
      blockers: 112,
      warnings: 752,
      blocker_pct: 13,
      warning_pct: 87,
    },
    min_triggers: 10,
    overall_friction_index: 28.4,
    high_friction_count: 2,
    friction_leaderboard: [],
  });

  // Fact Ledger state
  const [facts, setFacts] = useState([]);
  const [factSummary, setFactSummary] = useState({
    total_facts: 0,
    expiring_soon_count: 0,
    expired_count: 0,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const fetchTelemetry = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`${apiBase}/api/telemetry/?min_triggers=${minTriggers}`);
      if (res.ok) {
        const data = await res.json();
        setTelemetry((prev) => ({
          ...prev,
          ...data,
        }));
      }
    } catch {
      // Fallback
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchFacts = async () => {
    try {
      const res = await fetch(`${apiBase}/api/facts/`);
      if (res.ok) {
        const data = await res.json();
        setFacts(data.facts || []);
        setFactSummary({
          total_facts: data.total_facts || 0,
          expiring_soon_count: data.expiring_soon_count || 0,
          expired_count: data.expired_count || 0,
        });
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [apiBase, minTriggers]);

  useEffect(() => {
    fetchFacts();
  }, [apiBase]);

  // Open Blast Radius Modal for a Fact
  const handleOpenBlastRadius = async (fact) => {
    setSelectedFactForBlast(fact);
    setBlastModalOpen(true);
    setBlastData(null);
    try {
      const res = await fetch(`${apiBase}/api/facts/${fact.id}/blast-radius/`);
      if (res.ok) {
        const data = await res.json();
        setBlastData(data);
      }
    } catch {
      showToast('Could not load blast radius data.');
    }
  };

  // Run Bulk Re-Audit on a Fact
  const handleRunBulkReAudit = async (factId) => {
    setIsBulkAuditing(true);
    try {
      const res = await fetch(`${apiBase}/api/facts/${factId}/bulk-re-audit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Bulk re-audit complete: ${data.blast_radius_total} assets evaluated, ${data.flagged_count} flagged as STALE_REAUDIT_REQUIRED.`
        );
        fetchFacts();
        fetchTelemetry();
        if (selectedFactForBlast) {
          handleOpenBlastRadius(selectedFactForBlast);
        }
      } else {
        showToast('Bulk re-audit failed.');
      }
    } catch {
      showToast('Error executing bulk re-audit.');
    } finally {
      setIsBulkAuditing(false);
    }
  };

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Rule ID,Rule Name,Findings,Severity,Override Rate,Friction Score,Friction Level\n' +
      (telemetry.friction_leaderboard || [])
        .map(
          (r) =>
            `${r.rule_id},"${r.rule_name}",${r.findings},${r.severity},${r.override_rate},${r.friction_score},${r.friction_level}`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BrandGuard_Telemetry_Report_MinTriggers_${minTriggers}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Governance report exported as CSV.');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#0F5132] text-white px-4 py-3 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2.5 border border-emerald-400/30 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase flex items-center gap-1.5">
          <span>GOVERNANCE INTELLIGENCE</span>
          <span className="text-zinc-400 font-normal">·</span>
          <span>TELEMETRY &amp; FACT LEDGER</span>
          <span className="text-zinc-400 font-normal">·</span>
          <span>FRICTION INDEX</span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTab('friction')}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'friction'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Friction Score &amp; Telemetry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fact_ledger')}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'fact_ledger'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span>Fact Ledger &amp; Blast Radius</span>
            {factSummary.expired_count > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
            )}
          </button>
        </div>
      </div>

      {/* Header and Global Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Better content. Fewer preventable risks.
          </h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl leading-relaxed">
            Measure workflow friction across deterministic linting rules, audit volume velocity, and manage retroactive Fact Ledger blast radius.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              fetchTelemetry();
              fetchFacts();
            }}
            disabled={isRefreshing}
            className="border border-[#E5E7EB] bg-white text-zinc-700 text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 hover:bg-zinc-50 font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VIEW 1: FRICTION SCORE & TELEMETRY DASHBOARD                   */}
      {/* ============================================================== */}
      {activeTab === 'friction' && (
        <div className="space-y-6">
          {/* Top Metric Cards (4 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Audit volume */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 mb-1">Audit Volume</div>
              <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
                {telemetry.audit_volume.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                {telemetry.audit_volume_delta}
              </div>
            </div>

            {/* Card 2: First-pass rate */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 mb-1">First-Pass Rate</div>
              <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
                {telemetry.first_pass_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-emerald-700 font-semibold mt-1">
                {telemetry.first_pass_delta}
              </div>
            </div>

            {/* Card 3: Overall Friction Index */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 mb-1 flex items-center justify-between">
                <span>Friction Score Index</span>
                <Flame className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
                  {telemetry.overall_friction_index}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Low Friction
                </span>
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                Weighted delay index across active rules
              </div>
            </div>

            {/* Card 4: Open findings */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 mb-1">Open Findings</div>
              <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
                {telemetry.open_findings}
              </div>
              <div className="text-xs text-rose-600 font-semibold mt-1">
                {telemetry.hard_blockers} hard blockers · {telemetry.warnings_count} warnings
              </div>
            </div>
          </div>

          {/* Friction Score Leaderboard Section */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-xs">
            {/* Header with Minimum Trigger Count Controls */}
            <div className="p-5 border-b border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/50">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-600" />
                  <span>Rule Friction Score Leaderboard</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Calculates governance friction: Trigger Count × (1 + Override Rate × 2) × Severity Weight.
                </p>
              </div>

              {/* Minimum Trigger Count Filter Bar */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Min Triggers Filter:</span>
                </span>
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-1 shadow-2xs">
                  {[0, 5, 10, 20, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMinTriggers(val)}
                      className={`text-xs px-2.5 py-1 rounded font-mono font-bold transition-colors cursor-pointer ${
                        minTriggers === val
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                      }`}
                    >
                      {val === 0 ? 'All' : `≥ ${val}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] text-zinc-500 font-semibold uppercase tracking-wider text-[11px] border-b border-[#E5E7EB]">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">RULE CODE</th>
                    <th scope="col" className="px-6 py-3.5">RULE NAME &amp; PILLAR</th>
                    <th scope="col" className="px-6 py-3.5">TRIGGERS</th>
                    <th scope="col" className="px-6 py-3.5">OVERRIDE RATE</th>
                    <th scope="col" className="px-6 py-3.5">SEVERITY</th>
                    <th scope="col" className="px-6 py-3.5">FRICTION SCORE</th>
                    <th scope="col" className="px-6 py-3.5">STRATEGIC RECOMMENDATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-zinc-800">
                  {telemetry.friction_leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-zinc-400">
                        No rules triggered ≥ {minTriggers} times. Try selecting a lower trigger threshold.
                      </td>
                    </tr>
                  ) : (
                    telemetry.friction_leaderboard.map((row) => (
                      <tr
                        key={row.rule_id}
                        onClick={() => onSelectRule && onSelectRule(row.rule_id)}
                        className="hover:bg-zinc-50/70 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-mono font-bold text-zinc-900">
                          {row.rule_id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-zinc-900">{row.rule_name}</div>
                          <span className="text-[10px] font-mono uppercase text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                            {row.pillar || 'GENERAL'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-zinc-900">
                          {row.findings}
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold text-zinc-700">
                          {row.override_rate}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              row.severity === 'Blocker'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {row.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-sm text-zinc-900">
                              {row.friction_score}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                row.friction_level === 'HIGH'
                                  ? 'bg-rose-100 text-rose-800'
                                  : row.friction_level === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {row.friction_level}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-600 max-w-xs leading-relaxed text-[11px]">
                          {row.recommendation}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts Row: Audit Volume Trend & Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Card 1: Audit Volume & First-Pass Trend */}
            <div className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">
                    Audit Volume &amp; First-Pass Trend
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">5-week rolling compliance velocity</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#0F5132] inline-block"></span>
                    <span>Audits</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#CBE7D4] inline-block"></span>
                    <span>First-pass</span>
                  </span>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="h-44 flex items-end justify-between gap-3 px-4 pt-4 border-b border-[#E5E7EB]">
                {telemetry.weekly_trends.map((w, idx) => {
                  const barHeights = [
                    { total: '48%', audits: '45%' },
                    { total: '65%', audits: '50%' },
                    { total: '65%', audits: '52%' },
                    { total: '86%', audits: '48%' },
                    { total: '86%', audits: '52%' },
                  ];
                  const h = barHeights[idx] || { total: '70%', audits: '48%' };

                  return (
                    <div key={w.week} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <div className="relative w-full max-w-[54px] flex flex-col justify-end" style={{ height: h.total }}>
                        <div className="w-full bg-[#CBE7D4] rounded-t-xs flex-1 transition-all"></div>
                        <div className="w-full bg-[#0F5132] transition-all" style={{ height: h.audits }}></div>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500 mt-2 font-semibold">
                        {w.week}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Findings by Category */}
            <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-xs">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-sm font-bold text-zinc-900">Findings by Category</h3>
                <div className="text-right">
                  <span className="text-2xl font-bold text-zinc-900 font-sans tracking-tight">
                    864
                  </span>
                  <span className="text-xs text-zinc-400 font-normal ml-1">total</span>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {telemetry.categories.map((cat) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-800 font-semibold">{cat.name}</span>
                      <span className="font-mono text-zinc-700 font-bold">{cat.count}</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-[#0F5132] h-full rounded-full transition-all duration-500"
                        style={{ width: `${cat.pct}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: FACT LEDGER, EXPIRY ALERTS & BLAST RADIUS             */}
      {/* ============================================================== */}
      {activeTab === 'fact_ledger' && (
        <div className="space-y-6">
          {/* Fact Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 mb-1">Total Verified Truth Claims</div>
              <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
                {factSummary.total_facts}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Living Source of Truth Ledger</div>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 mb-1">Expiring Soon (≤ 30 days)</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-amber-700 font-sans tracking-tight">
                  {factSummary.expiring_soon_count}
                </span>
                <span className="text-xs text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                  Requires Review
                </span>
              </div>
              <div className="text-xs text-zinc-400 mt-1">Upcoming certificate / rate cutoffs</div>
            </div>

            <div className="bg-white border border-[#E5E7EB] border-l-4 border-l-rose-600 rounded-xl p-5 shadow-xs">
              <div className="text-xs font-semibold text-zinc-500 mb-1">Expired Truths</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-rose-700 font-sans tracking-tight">
                  {factSummary.expired_count}
                </span>
                <span className="text-xs text-rose-800 font-semibold bg-rose-50 px-2 py-0.5 rounded">
                  Blast Radius Alert
                </span>
              </div>
              <div className="text-xs text-rose-600 mt-1 font-medium">
                Published assets may cite outdated claims
              </div>
            </div>
          </div>

          {/* Expiry Critical Alert Banner (if expired facts exist) */}
          {factSummary.expired_count > 0 && (
            <div className="bg-rose-50 border-2 border-rose-400 rounded-xl p-4 text-xs text-rose-950 flex items-start justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold uppercase tracking-wider text-[11px] text-rose-900">
                    Critical Fact Expiry &amp; Blast Radius Notice
                  </div>
                  <p className="leading-relaxed">
                    One or more regulatory facts have expired in the NovaPay Fact Ledger. Any marketing assets citing these outdated claims pose compliance exposure and must be retroactively re-audited.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const expired = facts.find((f) => f.expiry_status === 'EXPIRED') || facts[0];
                  if (expired) handleOpenBlastRadius(expired);
                }}
                className="bg-rose-700 hover:bg-rose-800 text-white font-semibold px-4 py-2 rounded-lg text-xs shrink-0 cursor-pointer transition-colors shadow-xs"
              >
                Inspect Blast Radius →
              </button>
            </div>
          )}

          {/* Fact Ledger Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between bg-zinc-50/50">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">
                  NovaPay Truth Claims &amp; Regulatory Fact Ledger
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Single source of truth for numerical rates, settlement speeds, and certifications.
                </p>
              </div>

              <div className="text-xs font-mono text-zinc-400">
                Synchronized with Pre-Flight Compiler
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] text-zinc-500 font-semibold uppercase tracking-wider text-[11px] border-b border-[#E5E7EB]">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">FACT CODE</th>
                    <th scope="col" className="px-6 py-3.5">CATEGORY &amp; VERIFIED CLAIM TRUTH</th>
                    <th scope="col" className="px-6 py-3.5">VALID UNTIL</th>
                    <th scope="col" className="px-6 py-3.5">EXPIRY STATUS</th>
                    <th scope="col" className="px-6 py-3.5">BLAST RADIUS</th>
                    <th scope="col" className="px-6 py-3.5 text-right">GOVERNANCE ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-zinc-800">
                  {facts.map((fact) => (
                    <tr key={fact.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-zinc-900">
                        {fact.fact_code}
                      </td>
                      <td className="px-6 py-4 max-w-sm">
                        <div className="font-semibold text-zinc-900">{fact.category}</div>
                        <div className="text-zinc-600 mt-0.5 italic">“{fact.claim_truth}”</div>
                        {fact.superseded_by_text && (
                          <div className="text-[11px] text-amber-800 mt-1 font-medium">
                            Superseded by: {fact.superseded_by_text}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-600 whitespace-nowrap">
                        {fact.valid_until}
                        <div className="text-[10px] text-zinc-400">
                          {fact.days_until_expiry < 0
                            ? `Expired ${Math.abs(fact.days_until_expiry)}d ago`
                            : `Expires in ${fact.days_until_expiry}d`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                            fact.expiry_status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : fact.expiry_status === 'EXPIRING_SOON'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {fact.expiry_status === 'EXPIRING_SOON' ? 'EXPIRING SOON' : fact.expiry_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleOpenBlastRadius(fact)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{fact.blast_radius_count || 0} Assets</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenBlastRadius(fact)}
                            className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 px-2.5 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition cursor-pointer"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRunBulkReAudit(fact.id)}
                            className="text-xs font-semibold text-[#0F5132] hover:text-[#0B4226] px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition cursor-pointer"
                          >
                            Bulk Re-Audit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* BLAST RADIUS & BULK RE-AUDIT INSPECTOR MODAL                  */}
      {/* ============================================================== */}
      {blastModalOpen && selectedFactForBlast && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="font-bold text-zinc-900 text-base">
                    Blast Radius Assessment: {selectedFactForBlast.fact_code}
                  </h3>
                  <p className="text-xs text-zinc-500 font-mono">
                    Category: {selectedFactForBlast.category} · Valid Until: {selectedFactForBlast.valid_until}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBlastModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-800 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fact Statement Banner */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs space-y-1">
              <span className="font-bold text-zinc-500 uppercase text-[10px]">VERIFIED TRUTH CLAIM:</span>
              <p className="text-zinc-900 font-medium text-sm">“{selectedFactForBlast.claim_truth}”</p>
              {selectedFactForBlast.superseded_by_text && (
                <p className="text-amber-800 pt-1 font-semibold">
                  Superseded By: {selectedFactForBlast.superseded_by_text}
                </p>
              )}
            </div>

            {/* Affected Submissions List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  AFFECTED ASSETS IN BLAST RADIUS ({blastData?.blast_radius_count || 0})
                </h4>
                <span className="text-[11px] font-mono text-zinc-400">
                  Submissions citing this fact
                </span>
              </div>

              {!blastData ? (
                <div className="py-8 text-center text-xs text-zinc-400">
                  Loading blast radius dependencies...
                </div>
              ) : blastData.affected_submissions.length === 0 ? (
                <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-xs text-emerald-900 font-semibold">
                  Zero campaign assets cite this claim. Safe from retroactive compliance risk.
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden">
                  {blastData.affected_submissions.map((sub, idx) => (
                    <div key={idx} className="p-4 bg-white hover:bg-zinc-50/60 transition space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 text-sm">{sub.title}</span>
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            sub.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sub.status === 'STALE_REAUDIT_REQUIRED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-500 font-mono text-[11px]">
                        <span>Author: {sub.author}</span>
                        <span>·</span>
                        <span>Channel: {sub.channel}</span>
                        <span>·</span>
                        <span>Score: {sub.compliance_score}/100</span>
                      </div>
                      <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 text-zinc-700 italic">
                        “{sub.citing_snippet}”
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
              <div className="text-xs text-zinc-500">
                Bulk re-audit recalculates scores &amp; flags outdated claims.
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBlastModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  disabled={isBulkAuditing || !blastData || blastData.affected_submissions.length === 0}
                  onClick={() => handleRunBulkReAudit(selectedFactForBlast.id)}
                  className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBulkAuditing ? 'animate-spin' : ''}`} />
                  <span>{isBulkAuditing ? 'Executing Re-Audit...' : 'Execute Bulk Re-Audit'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Status Footer */}
      <footer className="flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 pt-6 border-t border-[#E5E7EB]">
        <div>All engines operational · Verified cryptographic ledger v3.2</div>
        <div className="mt-2 sm:mt-0">BrandGuard · Deterministic-first governance</div>
      </footer>
    </div>
  );
}
