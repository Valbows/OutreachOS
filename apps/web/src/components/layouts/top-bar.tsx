"use client";

import { useUIStore } from "@/lib/store";

export function TopBar() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <header className="h-14 flex items-center gap-4 px-6 bg-surface-container-low/50 backdrop-blur-sm border-b border-outline-variant/10">
      <button
        type="button"
        onClick={toggleSidebar}
        className="hidden lg:flex items-center justify-center w-8 h-8 rounded-[var(--radius-button)] text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
        aria-label="Toggle sidebar"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true" focusable="false">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>
      <div className="flex-1" />
      {/* Phase 3+: search bar, notifications, user avatar */}
    </header>
  );
}
