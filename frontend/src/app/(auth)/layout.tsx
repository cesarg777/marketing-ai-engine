export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand visual (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-zinc-950 items-center justify-center">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Radial glow — top right */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-600/8 blur-[120px]" />
        {/* Radial glow — bottom left */}
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full bg-indigo-500/6 blur-[150px]" />

        {/* Geometric accents */}
        <div className="absolute top-[15%] left-[10%] w-px h-32 bg-gradient-to-b from-transparent via-indigo-500/30 to-transparent" />
        <div className="absolute top-[20%] left-[10%] w-16 h-px bg-gradient-to-r from-indigo-500/30 to-transparent" />
        <div className="absolute bottom-[20%] right-[15%] w-px h-24 bg-gradient-to-b from-transparent via-indigo-400/20 to-transparent" />
        <div className="absolute bottom-[25%] right-[15%] w-12 h-px bg-gradient-to-l from-indigo-400/20 to-transparent" />

        {/* Floating diamond */}
        <div className="absolute top-[30%] right-[25%] w-3 h-3 rotate-45 border border-indigo-500/20" />
        <div className="absolute bottom-[35%] left-[20%] w-2 h-2 rotate-45 bg-indigo-500/15" />

        {/* Brand content */}
        <div className="relative z-10 px-16">
          <div className="mb-6">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              <div className="w-6 h-px bg-indigo-500/40" />
            </div>
            <h1 className="text-5xl font-bold tracking-tight">
              <span className="text-white">Marketing</span>
              <span className="text-indigo-400">AI</span>
            </h1>
          </div>
          <p className="text-zinc-500 text-lg leading-relaxed max-w-sm">
            AI-powered content marketing
            <br />
            <span className="text-zinc-600">for teams that move fast.</span>
          </p>
          <div className="mt-10 flex items-center gap-6 text-[11px] text-zinc-600 uppercase tracking-widest">
            <span>Research</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>Generate</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>Amplify</span>
          </div>
        </div>

        {/* Bottom border accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[var(--surface-base)]">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
