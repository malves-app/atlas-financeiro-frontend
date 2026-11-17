import { Logo } from "@/components/Logo";

/** Moldura das telas de entrar e criar conta: no computador, ganha um painel lateral com a marca. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between" aria-hidden>
        <Logo tone="dark" className="text-[22px]" />
        <div>
          <p className="display max-w-md text-[44px] leading-[1.02] font-bold tracking-tight">
            Cada real no seu lugar, mês a mês.
          </p>
          <div className="mt-10 flex max-w-sm items-end gap-3">
            {[38, 64, 46, 82, 58, 92].map((h, i) => (
              <span key={i} className="flex-1 rounded-t-md bg-white/15" style={{ height: h }} />
            ))}
          </div>
        </div>
        <span className="text-[14px] text-white/60">Organização financeira pessoal e da família</span>
      </aside>
      <div className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-[30px] leading-none lg:hidden">
            <Logo />
          </h1>
          <h2 className="display mt-6 text-[24px] font-bold tracking-tight lg:mt-0 lg:text-[30px]">{title}</h2>
          <p className="mt-1.5 mb-6 text-[15px] text-ink-2">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
