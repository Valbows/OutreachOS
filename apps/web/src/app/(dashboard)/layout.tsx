export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface-dim">
      {/* Sidebar — Phase 2: full implementation from Stitch Dashboard Overview screen */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-surface-container-low">
        <div className="flex h-16 items-center gap-2 px-6">
          <span className="text-xl font-semibold text-primary tracking-tight">
            OutreachOS
          </span>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem href="/(dashboard)" label="Dashboard" />
          <NavItem href="/(dashboard)/contacts" label="Contacts" />
          <NavItem href="/(dashboard)/campaigns" label="Campaigns" />
          <NavItem href="/(dashboard)/templates" label="Templates" />
          <NavItem href="/(dashboard)/forms" label="Forms" />
          <NavItem href="/(dashboard)/analytics" label="Analytics" />
          <NavItem href="/(dashboard)/settings" label="Settings" />
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2 text-sm text-on-surface-variant rounded-[var(--radius-button)] hover:bg-surface-container hover:text-on-surface transition-colors"
    >
      {label}
    </a>
  );
}
