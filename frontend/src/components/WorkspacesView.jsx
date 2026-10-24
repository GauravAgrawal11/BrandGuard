import React from 'react';
import { Layers, ShieldCheck, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function WorkspacesView({ onSelectWorkspace, onNavigateToInspector }) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Top Breadcrumb */}
      <div className="text-[11px] font-mono font-semibold tracking-wider text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
        <span>NORTHWIND ORGANIZATIONAL ECOSYSTEM</span>
        <span className="text-zinc-400 font-normal">·</span>
        <span>WORKSPACE DIRECTORY</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Workspaces &amp; Product Brands
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Active brand governance domains, live rulesets, and editorial clearance pipelines.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* NovaPay Primary Workspace Card */}
        <div
          onClick={onNavigateToInspector}
          className="bg-white border-2 border-[#0F5132] rounded-lg p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative"
        >
          <div className="absolute top-4 right-4">
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-mono font-medium">
              Active Primary
            </span>
          </div>

          <div className="w-10 h-10 rounded-lg bg-[#0A3423] text-white flex items-center justify-center font-bold text-sm mb-4">
            NP
          </div>

          <h2 className="text-lg font-bold text-zinc-900">NovaPay Technologies</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Global payment rails, liquidity protocols, and merchant cross-border settlement.
          </p>

          <div className="mt-5 pt-4 border-t border-[#E5E7EB] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Ruleset</span>
              <span className="font-mono text-zinc-800 font-semibold">v3.2 Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Active submissions</span>
              <span className="font-mono text-zinc-800 font-medium">24 in review</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Pending exceptions</span>
              <span className="font-mono text-rose-600 font-semibold">3 pending</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-[#0F5132]">
            <span>Open workspace inspector</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Secondary Mock Workspace 1 */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs opacity-75">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 text-white flex items-center justify-center font-bold text-sm mb-4">
            NW
          </div>

          <h2 className="text-lg font-bold text-zinc-900">Northwind Cloud Infra</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Enterprise cloud hosting, Kubernetes automation, and cluster management.
          </p>

          <div className="mt-5 pt-4 border-t border-[#E5E7EB] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Ruleset</span>
              <span className="font-mono text-zinc-800 font-semibold">v1.8 Staging</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Active submissions</span>
              <span className="font-mono text-zinc-800 font-medium">8 in review</span>
            </div>
          </div>
        </div>

        {/* Secondary Mock Workspace 2 */}
        <div className="bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-xs opacity-75">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 text-white flex items-center justify-center font-bold text-sm mb-4">
            AM
          </div>

          <h2 className="text-lg font-bold text-zinc-900">Apex Merchant Network</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Point-of-sale hardware terminals and merchant loyalty acquisition.
          </p>

          <div className="mt-5 pt-4 border-t border-[#E5E7EB] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Ruleset</span>
              <span className="font-mono text-zinc-800 font-semibold">v2.1 Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Active submissions</span>
              <span className="font-mono text-zinc-800 font-medium">12 in review</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
