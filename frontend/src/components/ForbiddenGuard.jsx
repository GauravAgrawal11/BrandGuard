import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ForbiddenGuard({ attemptedTab, onNavigateBack }) {
  const { user, login } = useAuth();

  const handleSwitchToAdmin = async () => {
    await login('admin', 'admin123');
  };

  return (
    <div className="max-w-2xl mx-auto my-16 p-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4">
        <ShieldAlert className="w-8 h-8 text-rose-600" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-mono font-bold uppercase tracking-wider mb-3">
        <Lock className="w-3.5 h-3.5" />
        HTTP 403 · Access Denied
      </div>

      <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
        Admin Governance Clearance Required
      </h1>

      <p className="mt-2 text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">
        You are authenticated as <span className="font-semibold text-zinc-900">{user?.name || user?.username}</span> with role{' '}
        <span className="font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
          {user?.role}
        </span>
        . Content Writers are restricted to pre-flight audit, 1-click patching, and submitting scoped tone exceptions.
      </p>

      <div className="my-6 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left text-xs text-zinc-600 space-y-2">
        <div className="font-semibold text-zinc-800 uppercase tracking-wider text-[11px]">
          Backend Permission Enforcement:
        </div>
        <p>
          Writers cannot view or modify the <strong>Rule Registry</strong>, <strong>Review Queue</strong>, <strong>URL Scraper</strong>, or <strong>Team Management</strong>.
          Backend endpoints strictly return <code className="bg-zinc-200 text-rose-800 px-1 py-0.5 rounded font-mono">HTTP 403 Forbidden</code> via DRF <code className="bg-zinc-200 text-zinc-800 px-1 py-0.5 rounded font-mono">IsAdmin</code> permission class.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onNavigateBack}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0A3423] text-white text-xs font-semibold hover:bg-emerald-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Writer Workspace
        </button>

        <button
          type="button"
          onClick={handleSwitchToAdmin}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition-colors cursor-pointer"
        >
          <UserCheck className="w-4 h-4 text-emerald-600" />
          Switch to Admin (Jordan Lee)
        </button>
      </div>
    </div>
  );
}
