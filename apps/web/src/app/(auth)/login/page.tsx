export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-semibold text-on-surface tracking-tight mb-2">
        Welcome back
      </h1>
      <p className="text-on-surface-variant mb-8">
        Sign in to your OutreachOS account
      </p>
      {/* Phase 2: Neon Auth integration */}
      <div className="bg-surface-container rounded-[var(--radius-card)] p-6">
        <p className="text-on-surface-variant text-sm">
          Authentication UI will be implemented in Phase 2.
        </p>
      </div>
    </div>
  );
}
