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
} from 'lucide-react';

export default function TelemetryView({
  apiBase = 'http://127.0.0.1:8000',
  onSelectRule,
  onViewAllRules,
}) {
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
      { week: 'W1', audits: 180, first_pass: 140, total_pct: 48, audit_pct: 22 },
      { week: 'W2', audits: 215, first_pass: 168, total_pct: 64, audit_pct: 30 },
      { week: 'W3', audits: 240, first_pass: 187, total_pct: 64, audit_pct: 32 },
      { week: 'W4', audits: 285, first_pass: 222, total_pct: 84, audit_pct: 42 },
      { week: 'W5', audits: 328, first_pass: 256, total_pct: 84, audit_pct: 44 },
    ],
    categories: [
      { name: 'Factual claims', count: 342, pct: 68 },
      { name: 'Color & contrast', count: 251, pct: 50 },
      { name: 'Voice & tone', count: 178, pct: 36 },
      { name: 'Logo & layout', count: 93, pct: 19 },
    ],
    severity_breakdown: {
      total: 864,
      blockers: 112,
      warnings: 752,
      blocker_pct: 13,
      warning_pct: 87,
    },
    recurring_findings: [
      {
        rule_id: 'FACT_012',
        rule_name: 'International transfer speed & fees',
        findings: 128,
        severity: 'Blocker',
        override_rate: '4.2%',
        last_triggered: '2 hrs ago',
      },
      {
        rule_id: 'VOICE_004',
        rule_name: 'Unsupported superlatives',
        findings: 96,
        severity: 'Warning',
        override_rate: '11.8%',
        last_triggered: 'Today',
      },
      {
        rule_id: 'VIS_021',
        rule_name: 'CTA color drift (ΔE > 3.0)',
        findings: 74,
        severity: 'Warning',
        override_rate: '7.1%',
        last_triggered: 'Yesterday',
      },
      {
        rule_id: 'FACT_031',
        rule_name: 'Expired security certification',
        findings: 51,
        severity: 'Blocker',
        override_rate: '0.9%',
        last_triggered: 'Jun 10',
      },
    ],
  });

  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  useEffect(() => {
    fetch(`${apiBase}/api/telemetry/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.audit_volume) {
          setTelemetry((prev) => ({
            ...prev,
            ...data,
          }));
        }
      })
      .catch(() => {});
  }, [apiBase]);

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Rule ID,Rule Name,Findings,Severity,Override Rate,Last Triggered\n' +
      telemetry.recurring_findings
        .map(
          (r) =>
            `${r.rule_id},"${r.rule_name}",${r.findings},${r.severity},${r.override_rate},${r.last_triggered}`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'BrandGuard_Telemetry_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Governance report exported as CSV.');
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
        <span>WORKSPACE</span>
        <span className="text-zinc-400 font-normal">·</span>
        <span>NOVAPAY</span>
      </div>

      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Better content. Fewer preventable risks.
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Audit performance for Apr 27 – Jun 12, 2026, across all channels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="border border-[#E5E7EB] bg-white text-zinc-700 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 hover:bg-zinc-50 font-medium"
          >
            <span>All channels</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          <button
            type="button"
            className="border border-[#E5E7EB] bg-white text-zinc-700 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 hover:bg-zinc-50 font-medium"
          >
            <span>Last 30 days</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-3.5 py-1.5 rounded-md flex items-center gap-1.5 font-medium transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Audit volume */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-xs">
          <div className="text-xs text-zinc-500 mb-1">Audit volume</div>
          <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
            {telemetry.audit_volume.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            {telemetry.audit_volume_delta}
          </div>
        </div>

        {/* Card 2: First-pass rate */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-xs">
          <div className="text-xs text-zinc-500 mb-1">First-pass rate</div>
          <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
            {telemetry.first_pass_rate.toFixed(1)}%
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            {telemetry.first_pass_delta}
          </div>
        </div>

        {/* Card 3: Review time saved */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-xs">
          <div className="text-xs text-zinc-500 mb-1">Review time saved</div>
          <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
            {telemetry.review_time_saved}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {telemetry.review_time_saved_subtext}
          </div>
        </div>

        {/* Card 4: Open findings */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-xs">
          <div className="text-xs text-zinc-500 mb-1">Open findings</div>
          <div className="text-3xl font-bold text-zinc-900 font-sans tracking-tight">
            {telemetry.open_findings}
          </div>
          <div className="text-xs text-rose-600 font-medium mt-1">
            {telemetry.hard_blockers} hard blockers
          </div>
        </div>
      </div>

      {/* Middle Charts Grid (3 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Card 1: Audit volume & first-pass trend (col-span-5) */}
        <div className="lg:col-span-5 bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-zinc-900">
              Audit volume &amp; first-pass trend
            </h2>
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#0F5132] inline-block"></span>
                <span>Audits</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#CBE7D4] inline-block"></span>
                <span>First-pass</span>
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="h-44 flex items-end justify-between gap-3 px-2 pt-4 border-b border-[#E5E7EB]">
            {telemetry.weekly_trends.map((w, idx) => {
              // Exact stacked heights matching Screenshot 5
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
                    {/* Top segment: First-pass light sage */}
                    <div className="w-full bg-[#CBE7D4] rounded-t-xs flex-1 transition-all"></div>
                    {/* Bottom segment: Audits solid forest emerald */}
                    <div className="w-full bg-[#0F5132] transition-all" style={{ height: h.audits }}></div>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 mt-2">
                    {w.week}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Findings by category (col-span-4) */}
        <div className="lg:col-span-4 bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Findings by category
            </h2>
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
                  <span className="text-zinc-700 font-medium">{cat.name}</span>
                  <span className="font-mono text-zinc-700">{cat.count}</span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#0F5132] h-full rounded-full transition-all duration-500"
                    style={{ width: `${cat.pct}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Severity breakdown (col-span-3) */}
        <div className="lg:col-span-3 bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 mb-6">
              Severity breakdown
            </h2>

            {/* Segmented Bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex gap-0.5 mb-6">
              <div
                className="bg-[#F87171] h-full transition-all"
                style={{ width: '13%' }}
                title="112 Blockers (13%)"
              ></div>
              <div
                className="bg-[#FBBF24] h-full transition-all"
                style={{ width: '87%' }}
                title="752 Warnings (87%)"
              ></div>
            </div>

            {/* Legend */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]"></span>
                  <span className="text-zinc-700 font-medium">Blockers</span>
                </span>
                <span className="font-mono text-zinc-700 font-semibold">112</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]"></span>
                  <span className="text-zinc-700 font-medium">Warnings</span>
                </span>
                <span className="font-mono text-zinc-700 font-semibold">752</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 leading-relaxed mt-6 pt-4 border-t border-[#E5E7EB]">
            Blockers are legal or factual errors and stop publication. Warnings are advisory.
          </p>
        </div>
      </div>

      {/* Bottom Table: Recurring findings & rule performance */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-hidden shadow-xs mb-8">
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            Recurring findings &amp; rule performance
          </h2>

          <button
            type="button"
            onClick={onViewAllRules}
            className="text-xs font-semibold text-[#0F5132] hover:text-[#0B4226] flex items-center gap-1 transition-colors"
          >
            <span>View all rules</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFB] text-zinc-500 font-medium uppercase tracking-wider text-[11px] border-b border-[#E5E7EB]">
              <tr>
                <th scope="col" className="px-6 py-3">RULE ID</th>
                <th scope="col" className="px-6 py-3">RULE NAME</th>
                <th scope="col" className="px-6 py-3">FINDINGS</th>
                <th scope="col" className="px-6 py-3">SEVERITY</th>
                <th scope="col" className="px-6 py-3">OVERRIDE RATE</th>
                <th scope="col" className="px-6 py-3">LAST TRIGGERED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-zinc-800">
              {telemetry.recurring_findings.map((row) => (
                <tr
                  key={row.rule_id}
                  onClick={() => onSelectRule && onSelectRule(row.rule_id)}
                  className="hover:bg-zinc-50/70 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono font-semibold text-zinc-900">
                    {row.rule_id}
                  </td>
                  <td className="px-6 py-4 font-medium text-zinc-900">
                    {row.rule_name}
                  </td>
                  <td className="px-6 py-4 font-mono">
                    {row.findings}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`font-mono text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                        row.severity === 'Blocker'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono">
                    {row.override_rate}
                  </td>
                  <td className="px-6 py-4 text-zinc-500 font-mono">
                    {row.last_triggered}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Status Footer */}
      <footer className="flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 pt-4 border-t border-[#E5E7EB]">
        <div>All systems operational · Ledger synced 2 min ago</div>
        <div className="mt-2 sm:mt-0">BrandGuard · Governance workspace</div>
      </footer>
    </div>
  );
}
