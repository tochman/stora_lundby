import { useState, useMemo } from 'react';
import { AdminLayout } from './Layout';

const statusOptions = ['Ny', 'Behandlas', 'Godkänd', 'Avslutad'];

const demoApplications = [
  {
    id: 1,
    name: 'Anna Andersson',
    email: 'anna@example.com',
    engagementType: 'need-help',
    year: '2026',
    term: 'Höst',
    status: 'Ny',
    consentGiven: true
  },
  {
    id: 2,
    name: 'Lars Svensson',
    email: 'lars@example.com',
    engagementType: 'volunteer',
    year: '2026',
    term: 'Höst',
    status: 'Behandlas',
    consentGiven: true
  },
  {
    id: 3,
    name: 'Maria Nilsson',
    email: 'maria@example.com',
    engagementType: 'organizer',
    year: '2026',
    term: 'Vår',
    status: 'Godkänd',
    consentGiven: true
  }
];

export default function AdminDashboard() {
  const [applications, setApplications] = useState(demoApplications);
  const [filter, setFilter] = useState({ status: 'all', type: 'all' });

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (filter.status !== 'all' && app.status !== filter.status) return false;
      if (filter.type !== 'all' && app.engagementType !== filter.type) return false;
      return true;
    });
  }, [applications, filter]);

  const summary = {
    total: applications.length,
    newCount: applications.filter((item) => item.status === 'Ny').length,
    volunteerCount: applications.filter((item) => item.engagementType === 'volunteer').length,
    helpCount: applications.filter((item) => item.engagementType === 'need-help').length
  };

  const setStatus = (id, nextStatus) => {
    setApplications((current) => current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          <div className="card border-l-4 border-brand-500 bg-brand-50">
            <div className="text-sm text-slate-600">Totalt</div>
            <div className="mt-2 text-3xl font-bold text-brand-500">{summary.total}</div>
          </div>
          <div className="card border-l-4 border-yellow-500 bg-yellow-50">
            <div className="text-sm text-slate-600">Nya</div>
            <div className="mt-2 text-3xl font-bold text-yellow-500">{summary.newCount}</div>
          </div>
          <div className="card border-l-4 border-green-500 bg-green-50">
            <div className="text-sm text-slate-600">Volontärer</div>
            <div className="mt-2 text-3xl font-bold text-green-500">{summary.volunteerCount}</div>
          </div>
          <div className="card border-l-4 border-violet-500 bg-violet-50">
            <div className="text-sm text-slate-600">Behöver hjälp</div>
            <div className="mt-2 text-3xl font-bold text-violet-500">{summary.helpCount}</div>
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-bold text-slate-800">Anmälningar</h2>
            <div className="flex gap-3">
              <select
                value={filter.status}
                onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
                className="input w-auto"
              >
                <option value="all">Alla statusar</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <select
                value={filter.type}
                onChange={(e) => setFilter((prev) => ({ ...prev, type: e.target.value }))}
                className="input w-auto"
              >
                <option value="all">Alla typer</option>
                <option value="need-help">Behöver hjälp</option>
                <option value="volunteer">Volontär</option>
                <option value="organizer">Ansvarig</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Namn</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Typ</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">År / termin</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">E-post</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Samtycke</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr key={app.id} className="border-b border-slate-200">
                    <td className="px-3 py-3 text-sm text-slate-800">{app.name}</td>
                    <td className="px-3 py-3 text-sm text-slate-600">{app.engagementType}</td>
                    <td className="px-3 py-3 text-sm text-slate-600">{app.year} / {app.term}</td>
                    <td className="px-3 py-3 text-sm text-slate-600">{app.email}</td>
                    <td className="px-3 py-3 text-sm">
                      <select
                        value={app.status}
                        onChange={(e) => setStatus(app.id, e.target.value)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${app.consentGiven ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {app.consentGiven ? 'Ja' : 'Nej'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
