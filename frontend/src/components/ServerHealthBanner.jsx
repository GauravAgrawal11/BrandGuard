import React from 'react';
import { RefreshCw, Zap, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { useServerHealth } from '../context/ServerHealthContext';

export default function ServerHealthBanner() {
  const { status, wakingElapsed, isWakingBannerDismissed, setIsWakingBannerDismissed, checkHealth } = useServerHealth();

  if (status !== 'waking' || isWakingBannerDismissed) {
    return null;
  }

  return (
    <div className="bg-amber-500 text-zinc-950 px-4 py-2.5 shadow-md flex items-center justify-between text-xs z-50 sticky top-0 border-b border-amber-600 transition-all animate-fade-in">
      <div className="flex items-center gap-2.5 max-w-4xl">
        <div className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        </div>
        <div>
          <div className="font-semibold flex items-center gap-1.5">
            <span>Render Backend Server is Waking Up</span>
            <span className="font-mono bg-amber-600/30 px-1.5 py-0.2 rounded text-[10px] font-bold">
              {wakingElapsed}s elapsed
            </span>
          </div>
          <p className="text-[11px] text-zinc-900/90 mt-0.5 leading-snug">
            Free tier instances sleep after 15m of inactivity and take ~30–50s to cold start. Offline demo personas and client-side audits are fully functional while waking up.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4 shrink-0">
        <button
          type="button"
          onClick={() => checkHealth()}
          className="px-2.5 py-1 rounded bg-zinc-950 text-white hover:bg-zinc-800 text-[11px] font-medium transition cursor-pointer flex items-center gap-1 shadow-xs"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Ping API</span>
        </button>
        <button
          type="button"
          onClick={() => setIsWakingBannerDismissed(true)}
          className="p-1 hover:bg-amber-600/30 rounded text-zinc-950 transition cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
