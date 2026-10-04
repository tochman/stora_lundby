export function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Stora Lundby</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Föräldraengagemang</h1>
        </header>
        <main className="card">{children}</main>
      </div>
    </div>
  );
}

export function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">Stora Lundby</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
