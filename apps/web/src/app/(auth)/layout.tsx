import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-surface-dim">
      {/* Left branding panel — Stitch Login/Signup screen hero section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-container-lowest">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5" />
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <Link href="/" className="mb-12">
            <span className="text-2xl font-semibold text-primary tracking-tight">
              OutreachOS
            </span>
          </Link>
          <h1 className="text-4xl xl:text-5xl font-semibold text-on-surface tracking-tight leading-tight mb-4">
            Intelligent outreach.
            <br />
            <span className="text-primary">Built for agents.</span>
          </h1>
          <p className="text-lg text-on-surface-variant max-w-md leading-relaxed">
            Automate your communication workflow with enterprise-grade
            intelligence. Scale your outreach without losing the human touch.
          </p>
          <div className="mt-12 flex items-center gap-3" aria-hidden="true">
            <div className="h-1 w-8 rounded-full bg-primary/60" />
            <div className="h-1 w-4 rounded-full bg-primary/30" />
            <div className="h-1 w-4 rounded-full bg-primary/15" />
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
