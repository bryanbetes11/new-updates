import { APP_VERSION_LABEL } from '../lib/appUpdate';

export function StartupScreen() {
  return (
    <main
      className="fixed inset-0 isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[#030504] px-6 text-white"
      aria-live="polite"
      aria-busy="true"
      aria-label="ServeSync is opening"
    >
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_32%,rgba(34,197,94,0.22),transparent_31%),radial-gradient(circle_at_50%_92%,rgba(16,185,129,0.10),transparent_35%),linear-gradient(180deg,#030504_0%,#08110b_58%,#020403_100%)]" />
      <div className="absolute left-1/2 top-[38%] -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/[0.06] blur-3xl" />

      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto flex h-44 w-44 items-center justify-center sm:h-48 sm:w-48">
          <div className="absolute inset-0 rounded-full border border-white/[0.08]" />
          <div className="absolute inset-4 rounded-full border border-dashed border-emerald-300/20 motion-safe:animate-[spin_14s_linear_infinite]" />
          <div className="absolute inset-9 rounded-[2rem] bg-emerald-400/10 blur-2xl" />
          <span className="absolute right-1 top-12 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(74,222,128,0.9)] motion-safe:animate-pulse" />
          <span className="absolute bottom-11 left-1 h-2 w-2 rounded-full bg-emerald-300/80 shadow-[0_0_16px_rgba(134,239,172,0.75)] motion-safe:animate-pulse [animation-delay:800ms]" />
          <img
            src="/generated/servesync-mark-light.png"
            alt="ServeSync"
            className="relative h-28 w-28 object-contain brightness-0 invert drop-shadow-[0_0_30px_rgba(74,222,128,0.22)] sm:h-32 sm:w-32"
          />
        </div>

        <div className="mt-7 space-y-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.34em] text-emerald-300/80">
            ServeSync
          </p>
          <h1 className="text-[25px] font-black tracking-[-0.04em] text-white sm:text-[28px]">
            Preparing your workspace.
          </h1>
          <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-white/45">
            Restoring your account, ministry updates, and the last place you were working.
          </p>
        </div>

        <div className="mx-auto mt-8 h-1 w-32 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-500 motion-safe:animate-[loader-drift_1.25s_ease-in-out_infinite]" />
        </div>

        <p className="fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-[10px] font-mono uppercase tracking-[0.18em] text-white/25">
          {APP_VERSION_LABEL}
        </p>
      </div>
    </main>
  );
}
