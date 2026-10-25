import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ServerHealthPill from './ServerHealthPill';

export default function LoginView({ onLoginSuccess }) {
  const { login, loading, authError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!username || !password) {
      setLocalError('Please enter both username and password.');
      return;
    }
    try {
      const loggedInUser = await login(username, password);
      onLoginSuccess(loggedInUser);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleQuickLogin = async (u, p) => {
    setLocalError(null);
    try {
      const loggedInUser = await login(u, p);
      onLoginSuccess(loggedInUser);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Shield Logo */}
        <div className="flex justify-center mb-2">
          <div className="w-12 h-12 rounded-xl bg-[#0A3423] flex items-center justify-center shadow-md">
            <Shield className="w-7 h-7 text-[#00D4B6]" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          BrandGuard
        </h2>
        <p className="mt-1 text-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
          Pre-Publication Compiler & Linter · Ruleset v3.2
        </p>
        <div className="mt-3 flex justify-center">
          <ServerHealthPill />
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-zinc-200 rounded-xl sm:px-10">
          {/* Quick Switch Persona Buttons */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2.5">
              Quick Sign-in (Demo Personas)
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'admin123')}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-emerald-950">Jordan Lee</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0A3423] text-emerald-300">
                      ADMIN
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Brand Governance Lead · Full registry, telemetry & review access</p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('writer1', 'writer123')}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg border border-sky-200 bg-sky-50/40 hover:bg-sky-50 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-sky-950">Alex Morgan</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-700 text-sky-100">
                      WRITER
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Marketing Ops · Pre-flight auditor, 1-click patcher & exceptions</p>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-700 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('writer2', 'writer123')}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100/70 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-zinc-900">Taylor Reed</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-700 text-zinc-100">
                      WRITER
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Growth & Social · Content creator</p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-400 font-mono text-[10px]">Or credentials</span>
            </div>
          </div>

          {/* Error Banner */}
          {(localError || authError) && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-700">
                {localError || authError}
              </div>
            </div>
          )}

          {/* Credentials Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Username or Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or writer1"
                  className="block w-full pl-9 sm:text-xs border border-zinc-300 rounded-lg py-2 focus:ring-emerald-600 focus:border-emerald-600 text-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-zinc-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123 or writer123"
                  className="block w-full pl-9 sm:text-xs border border-zinc-300 rounded-lg py-2 focus:ring-emerald-600 focus:border-emerald-600 text-zinc-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-[#0A3423] hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-colors cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Authenticating...' : 'Sign in to BrandGuard'}
            </button>
          </form>

          {/* Security Note */}
          <div className="mt-6 border-t border-zinc-100 pt-4 text-center">
            <p className="text-[11px] text-zinc-400">
              Role permissions strictly enforced on both frontend routes and backend APIs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
