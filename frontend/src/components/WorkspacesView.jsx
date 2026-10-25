import React, { useState, useEffect } from 'react';
import {
  Layers,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Sliders,
  Check,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

export default function WorkspacesView({ onNavigateToInspector, onSelectSubmission, apiBase = API_BASE }) {
  const { user, token, isAdmin, isWriter } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');

  const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/api/submissions/`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error('Failed to load workspace submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async (subId, title) => {
    try {
      const res = await fetch(`${apiBase}/api/submissions/${subId}/export-pdf/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BrandGuard_Audit_${(title || 'campaign').replace(/[^a-zA-Z0-9]/g, '_')}_${String(subId).slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`PDF export error: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [apiBase, token]);

  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (channelFilter !== 'ALL' && s.channel_context !== channelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (s.title || '').toLowerCase().includes(q);
      const matchChannel = (s.channel_context || '').toLowerCase().includes(q);
      const matchStatus = (s.status || '').toLowerCase().includes(q);
      return matchTitle || matchChannel || matchStatus;
    }
    return true;
  });

  // Calculate high-level workspace metrics
  const totalCount = submissions.length;
  const avgScore = totalCount > 0
    ? Math.round(submissions.reduce((acc, s) => acc + (s.latest_score || 100), 0) / totalCount)
    : 100;
  const clearedCount = submissions.filter((s) => s.status === 'APPROVED').length;
  const inReviewCount = submissions.filter((s) => s.status === 'IN_REVIEW' || s.status === 'EXCEPTION_PENDING').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Top Breadcrumb */}
      <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
        <span>EDITORIAL CLEARANCE PIPELINE</span>
        <span className="text-zinc-400 font-normal">·</span>
        <span>MY WORKSPACE ({user?.department || 'Marketing Operations'})</span>
      </div>

      {/* Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            My Workspace &amp; Campaign Directory
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Pre-publication linting history, living score breakdowns, and compliance readiness statuses for NovaPay.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (onNavigateToInspector) onNavigateToInspector();
            }}
            className="inline-flex items-center px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Pre-Flight Audit
          </button>
        </div>
      </div>

      {/* Workspace KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
          <span className="text-xs font-medium text-zinc-500">Total Submissions</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-zinc-900">{totalCount}</span>
            <span className="text-xs font-semibold text-zinc-500">Campaigns</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
          <span className="text-xs font-medium text-zinc-500">Average Readiness Score</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${avgScore >= 90 ? 'text-emerald-700' : avgScore >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>
              {avgScore}/100
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" />
              Healthy
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
          <span className="text-xs font-medium text-zinc-500">Brand-Compliance Cleared</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700">{clearedCount}</span>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              Ready to Publish
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
          <span className="text-xs font-medium text-zinc-500">In Review / Exceptions</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-600">{inReviewCount}</span>
            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
              Pending Gate
            </span>
          </div>
        </div>
      </div>

      {/* Quick Starter Templates */}
      <div className="mb-6 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-indigo-50/40 p-4 rounded-xl border border-emerald-200/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
              Quick Test Templates for Pre-Flight Clearance
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">Load into inspector with 1-click</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => {
              if (onSelectSubmission) onSelectSubmission('demo_linkedin');
              else if (onNavigateToInspector) onNavigateToInspector();
            }}
            className="p-3 bg-white rounded-lg border border-zinc-200 hover:border-emerald-500 hover:shadow-xs transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900">NovaPay Global Settlement</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 rounded">
                LinkedIn
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-1">
              "Don't get wrecked by banks! Transfers settle in 24 hrs with 0.5% FX fee."
            </p>
          </div>

          <div
            onClick={() => {
              if (onSelectSubmission) onSelectSubmission('demo_press_release');
              else if (onNavigateToInspector) onNavigateToInspector();
            }}
            className="p-3 bg-white rounded-lg border border-zinc-200 hover:border-emerald-500 hover:shadow-xs transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900">Q2 Merchant Expansion</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-50 text-purple-700 rounded">
                Press Release
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-1">
              "NovaPay unveils #1 fastest settlement infrastructure for digital commerce."
            </p>
          </div>

          <div
            onClick={() => {
              if (onSelectSubmission) onSelectSubmission('demo_banner');
              else if (onNavigateToInspector) onNavigateToInspector();
            }}
            className="p-3 bg-white rounded-lg border border-zinc-200 hover:border-emerald-500 hover:shadow-xs transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900">Display Ad Visual Banner</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded">
                Display Banner
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-1">
              Off-brand swatches, deuteranopia simulation &amp; optical clear-space violations.
            </p>
          </div>
        </div>
      </div>

      {/* Submissions Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search campaigns by title, channel, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-1.5">
          {['ALL', 'IN_REVIEW', 'APPROVED', 'EXCEPTION_PENDING'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === status
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {status === 'IN_REVIEW' ? 'In Review' : status === 'APPROVED' ? 'Cleared' : status === 'EXCEPTION_PENDING' ? 'Exception' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50/75">
              <tr>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Campaign Title
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Channel Context
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Latest Version
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Readiness Score
                </th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Compliance Status
                </th>
                <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-sm text-zinc-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600 mb-2" />
                    Loading campaign submissions...
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-sm text-zinc-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    No submissions found. Click "New Pre-Flight Audit" above to lint your first campaign draft!
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const score = sub.latest_score || 100;
                  const versionsCount = sub.versions?.length || 1;
                  const isApproved = sub.status === 'APPROVED';
                  const isException = sub.status === 'EXCEPTION_PENDING';

                  return (
                    <tr
                      key={sub.id}
                      onClick={() => {
                        if (onSelectSubmission) onSelectSubmission(sub.id);
                        else if (onNavigateToInspector) onNavigateToInspector();
                      }}
                      className="hover:bg-zinc-50/80 transition cursor-pointer group"
                    >
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-zinc-900 group-hover:text-emerald-700 transition">
                          {sub.title}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          Created {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : 'Today'} · Author: {sub.author?.username || 'Writer'}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {sub.channel_context.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          v{versionsCount}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`font-mono font-bold text-sm ${
                              score >= 90 ? 'text-emerald-700' : score >= 75 ? 'text-amber-600' : 'text-rose-600'
                            }`}
                          >
                            {score}/100
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isException
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                          }`}
                        >
                          {isApproved
                            ? 'Brand-Compliance Cleared'
                            : isException
                            ? 'Exception Pending'
                            : 'In Review'}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-right text-xs font-semibold">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            title="Export PDF Audit Report"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPdf(sub.id, sub.title);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <span className="text-emerald-700 group-hover:text-emerald-800 flex items-center">
                            <span>Inspect</span>
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
