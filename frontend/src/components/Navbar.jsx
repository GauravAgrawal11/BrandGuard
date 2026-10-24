import React from 'react';
import { Bell } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, queueCount = 3 }) {
  const tabs = [
    { id: 'workspaces', label: 'Workspaces' },
    { id: 'inspector', label: 'Pre-Flight Inspector' },
    { id: 'registry', label: 'Rule Registry' },
    { id: 'queue', label: 'Manager Queue', badge: queueCount },
    { id: 'telemetry', label: 'Telemetry' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-[#E5E7EB] px-6 h-14 flex items-center justify-between">
      {/* Left: Brand Identity & Workspace Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* BrandGuard Shield Icon */}
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 shrink-0" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#0F5132" />
            <path
              d="M14 6L8 8.5V14C8 18 10.8 21.2 14 22C17.2 21.2 20 18 20 14V8.5L14 6Z"
              fill="white"
            />
            <path
              d="M14 8L10 9.8V14C10 16.8 11.8 19.4 14 20.1C16.2 19.4 18 16.8 18 14V9.8L14 8Z"
              fill="#0F5132"
            />
          </svg>
          <span className="font-bold text-zinc-900 text-[15px] tracking-tight">BrandGuard</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-normal ml-1">
          <span>Northwind</span>
          <span className="text-zinc-400">›</span>
          <span className="text-zinc-700 font-medium">NovaPay</span>
        </div>

        {/* Ruleset Status Pill */}
        <div className="ml-2 hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-200 bg-[#EAF5EE] font-mono text-[11px] text-[#0F5132] font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block shadow-sm"></span>
          <span>Ruleset v3.2 · Active</span>
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <nav className="flex items-center gap-6 h-full text-xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-full flex items-center gap-1.5 px-0.5 border-b-2 font-medium transition-colors relative ${
                isActive
                  ? 'border-[#0F5132] text-zinc-950 font-semibold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-rose-100 text-rose-700 font-mono text-[11px] px-1.5 py-0.2 rounded-full font-semibold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: Notification Bell & User Avatar */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="text-zinc-500 hover:text-zinc-800 transition-colors p-1"
        >
          <Bell className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {/* User Profile Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-200 ring-2 ring-emerald-100/50 cursor-pointer shrink-0">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
            alt="User avatar"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Graceful fallback to styled initials avatar
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement.innerHTML =
                '<div class="w-full h-full bg-[#0F5132] text-white flex items-center justify-center font-bold text-xs">AM</div>';
            }}
          />
        </div>
      </div>
    </header>
  );
}
