"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store";
import { authClient } from "@/lib/auth/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const mainNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: <DashboardIcon /> },
  { href: "/contacts", label: "Contacts", icon: <ContactsIcon /> },
  { href: "/campaigns", label: "Campaigns", icon: <CampaignsIcon /> },
  { href: "/templates", label: "Templates", icon: <TemplatesIcon /> },
  { href: "/analytics", label: "Analytics", icon: <AnalyticsIcon /> },
  { href: "/forms", label: "Forms", icon: <FormsIcon /> },
  { href: "/blog", label: "Blog", icon: <BlogIcon /> },
  { href: "/developer", label: "Developer", icon: <DeveloperIcon /> },
];

const bottomNav: NavItem[] = [
  { href: "/settings", label: "Settings", icon: <SettingsIcon /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    if (signingOut) return;
    setSignOutError(null);
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
    } catch (err) {
      setSigningOut(false);
      setSignOutError(
        err instanceof Error && err.message ? err.message : "Sign out failed"
      );
    }
  }

  return (
    <aside
      aria-label="Main navigation"
      className={`hidden lg:flex lg:flex-col bg-surface-container-low transition-all duration-200 ${
        sidebarOpen ? "lg:w-64" : "lg:w-16"
      }`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-button)] bg-gradient-primary shrink-0">
          <span className="text-sm font-bold text-on-primary-fixed" aria-hidden="true">O</span>
          {!sidebarOpen && <span className="sr-only">OutreachOS</span>}
        </div>
        {sidebarOpen && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-on-surface tracking-tight leading-tight">
              OutreachOS
            </span>
            <span className="text-[10px] text-on-surface-variant leading-tight">
              Intelligence Platform
            </span>
          </div>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {mainNav.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            }
            collapsed={!sidebarOpen}
          />
        ))}
      </nav>

      {/* Bottom navigation */}
      <div className="px-3 py-2 space-y-0.5 border-t border-outline-variant/10">
        {bottomNav.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
            collapsed={!sidebarOpen}
          />
        ))}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          aria-busy={signingOut}
          aria-label={!sidebarOpen ? (signingOut ? "Signing out" : "Log out") : undefined}
          className={`flex items-center gap-3 w-full px-3 py-2 text-sm text-on-surface-variant rounded-[var(--radius-button)] hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            !sidebarOpen ? "justify-center" : ""
          }`}
        >
          <span className="shrink-0 [&>svg]:w-5 [&>svg]:h-5">
            {signingOut && !sidebarOpen ? <SpinnerIcon /> : <LogoutIcon />}
          </span>
          {sidebarOpen && <span>{signingOut ? "Signing out..." : "Log out"}</span>}
        </button>
        {signOutError && (
          <div
            role="alert"
            className="px-3 py-2 bg-error-container/20 border border-error/20 rounded-[var(--radius-input)] text-xs text-error break-words"
          >
            {signOutError}
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      data-active={active}
      aria-label={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 px-3 py-2 text-sm rounded-[var(--radius-button)] transition-colors ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
      }`}
      title={collapsed ? item.label : undefined}
    >
      <span className="shrink-0 [&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

/* --- Icon components (Material-style 24px SVGs) --- */

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

function CampaignsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
    </svg>
  );
}

function FormsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function BlogIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
  );
}

function DeveloperIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
