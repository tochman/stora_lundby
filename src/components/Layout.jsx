import Logo from './Logo';

export function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 text-center">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Föräldraengagemang</h1>
        </header>
        <main className="card">{children}</main>
      </div>
    </div>
  );
}

export function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Admin</p>
            <Logo />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 print:p-0">{children}</main>
    </div>
  );
}
