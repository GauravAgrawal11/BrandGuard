import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Shield, Award, CheckCircle2, AlertTriangle,
  Mail, MessageSquare, Bell, RefreshCw, X, ArrowUpRight, Search, Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE } from '../config/api';

export default function TeamManagementView({ apiBase = API_BASE }) {
  const { token } = useAuth();
  const { t } = useLanguage();

  const [teamData, setTeamData] = useState([]);
  const [teamMetrics, setTeamMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Invite/Add User Modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    department: 'Marketing Creative',
    role: 'CONTENT_WRITER',
    password: 'WriterPass123!',
  });
  const [submittingUser, setSubmittingUser] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  // Webhook Test State
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);

  const fetchTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/users/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load team data (${res.status})`);
      }
      const data = await res.json();
      setTeamData(data.users || []);
      setTeamMetrics(data.team_metrics || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [token]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmittingUser(true);
    setInviteSuccess(null);
    try {
      const res = await fetch(`${apiBase}/api/users/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      setInviteSuccess(`User @${data.user.username} successfully provisioned with role ${data.user.role}!`);
      setFormData({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        department: 'Marketing Creative',
        role: 'CONTENT_WRITER',
        password: 'WriterPass123!',
      });
      fetchTeam();
      setTimeout(() => {
        setInviteModalOpen(false);
        setInviteSuccess(null);
      }, 1800);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/notifications/test-webhook/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: 'SLACK' }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookStatus({ ok: true, msg: 'Multi-channel ping dispatched: In-App, Email, and Slack simulated.' });
      } else {
        setWebhookStatus({ ok: false, msg: data.error || 'Webhook test failed' });
      }
    } catch (err) {
      setWebhookStatus({ ok: false, msg: err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const filteredUsers = teamData.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              GOVERNANCE COHORT
            </span>
            <span className="text-xs text-zinc-500 font-mono">NovaPay Global Marketing</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t('nav_team', 'Team Management')} & Performance
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Monitor per-writer compliance readiness, approval rates, top triggered rules, and provision roles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchTeam}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0A3423] hover:bg-[#134e34] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {t('btn_invite_member', 'Invite Team Member')}
          </button>
        </div>
      </div>

      {/* Aggregate Team Performance Metrics */}
      {teamMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Total Members</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">
              {teamMetrics.total_members}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              {teamMetrics.writers_count} writers · {teamMetrics.admins_count} admins
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Team Avg Score</span>
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {teamMetrics.team_avg_score} <span className="text-xs font-normal text-zinc-500">/ 100</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">
              Deterministic first-pass benchmark
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Top Friction Rule</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-lg font-mono font-bold text-zinc-900 dark:text-white truncate">
              {teamMetrics.team_top_triggered_rules?.[0]?.rule_code || 'VOICE_004'}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              Triggered {teamMetrics.team_top_triggered_rules?.[0]?.count || 0} times across team
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Multi-Channel Alerts</span>
              <Bell className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE
              </span>
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={testingWebhook}
                className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 underline font-medium cursor-pointer"
              >
                {testingWebhook ? 'Testing...' : 'Test Webhook'}
              </button>
            </div>
            {webhookStatus && (
              <div className={`text-[10px] mt-1 ${webhookStatus.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                {webhookStatus.msg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="mt-8 mb-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search writers by name, email, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="text-xs text-zinc-500">
          Showing <span className="font-semibold text-zinc-900 dark:text-white">{filteredUsers.length}</span> members
        </div>
      </div>

      {/* Writers Performance Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th scope="col" className="py-3 px-4">Member</th>
                <th scope="col" className="py-3 px-4">Role & Dept</th>
                <th scope="col" className="py-3 px-4 text-center">Audits</th>
                <th scope="col" className="py-3 px-4 text-center">Approval Rate</th>
                <th scope="col" className="py-3 px-4 text-center">Avg Score</th>
                <th scope="col" className="py-3 px-4 text-center">Exceptions</th>
                <th scope="col" className="py-3 px-4">Top Triggered Rules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading team performance records...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    No team members found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((member) => {
                  const score = member.avg_compliance_score || 100.0;
                  const scoreClass =
                    score >= 85
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
                      : score >= 70
                      ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                      : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800';

                  const approvalRate = member.approval_rate !== undefined ? member.approval_rate : 100.0;

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-zinc-50/75 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs"
                            style={{ backgroundColor: member.avatar_color || '#0A3423' }}
                          >
                            {(member.first_name?.[0] || member.username?.[0] || 'U').toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-white">
                              {member.name || member.username}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Dept */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                              member.role === 'ADMIN'
                                ? 'bg-[#0A3423] text-emerald-300 border-emerald-900'
                                : 'bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                            }`}
                          >
                            {member.role === 'ADMIN' ? 'ADMIN / LEAD' : 'CONTENT WRITER'}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {member.department || 'Marketing'}
                          </span>
                        </div>
                      </td>

                      {/* Audits Count */}
                      <td className="py-3.5 px-4 text-center font-mono font-medium">
                        {member.audits_count || 0}
                      </td>

                      {/* Approval Rate */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{approvalRate}%</span>
                        </div>
                      </td>

                      {/* Avg Score */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border ${scoreClass}`}
                        >
                          {score}
                        </span>
                      </td>

                      {/* Exceptions Requested & Approved */}
                      <td className="py-3.5 px-4 text-center font-mono text-xs">
                        <span className="font-medium">{member.exceptions_count || 0}</span>
                        {member.exceptions_approved > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                            ({member.exceptions_approved} apprv)
                          </span>
                        )}
                      </td>

                      {/* Top Triggered Rules */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {member.top_triggered_rules && member.top_triggered_rules.length > 0 ? (
                            member.top_triggered_rules.map((r) => (
                              <span
                                key={r.rule_code}
                                className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                              >
                                {r.rule_code} <span className="text-zinc-500">x{r.count}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">No flags recorded</span>
                          )}
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

      {/* Multi-Channel Alerts Footer Notification */}
      <div className="mt-8 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">
              Automated Notification Delivery System
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Dispatches multi-channel alerts across In-App, Email (SMTP), and Slack webhooks for exceptions, approvals, and blast-radius holds.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>In-App</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Email</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Slack</span>
          </div>
        </div>
      </div>

      {/* Statutory Legal Notice */}
      <div className="mt-6 text-center text-xs text-zinc-500 italic">
        {t('legal_notice', 'Brand-compliance cleared. Not a substitute for formal legal review.')}
      </div>

      {/* Invite/Add User Modal Dialog */}
      {inviteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-[#0A3423] text-emerald-400 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 id="modal-title" className="text-lg font-bold text-zinc-900 dark:text-white">
                  Provision Team Member
                </h3>
                <p className="text-xs text-zinc-500">
                  Assign role-based access for BrandGuard governance.
                </p>
              </div>
            </div>

            {inviteSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                {inviteSuccess}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. jessica_lee"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jessica@novapay.internal"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Jessica"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Lee"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="CONTENT_WRITER">Content Writer (Workspace / Inspector)</option>
                    <option value="ADMIN">Admin (Rule Registry / Review Queue)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Marketing Creative"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0A3423] hover:bg-[#134e34] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white transition cursor-pointer shadow-sm"
                >
                  {submittingUser ? 'Provisioning...' : 'Provision Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
