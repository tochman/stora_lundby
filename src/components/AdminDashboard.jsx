import { useState, useMemo, useEffect } from 'react';
import api from '../utils/googleAppsScriptApi';
import { AdminLayout } from './Layout';

const statusOptions = ['Ny', 'Behandlas', 'Godkänd', 'Avslutad'];

export default function AdminDashboard() {
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState({ status: 'all', type: 'all' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const dashboard = await api.getAdminDashboard();
      setApplications(dashboard.rows || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Kunde inte ladda data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (filter.status !== 'all' && app.status !== filter.status) return false;
      if (filter.type !== 'all' && app.engagementType !== filter.type) return false;
      return true;
    });
  }, [applications, filter]);

  const summary = {
    total: applications.length,
    newCount: applications.filter((item) => String(item.status).toLowerCase() === 'ny').length,
    volunteerCount: applications.filter((item) => String(item.engagementType).toLowerCase() === 'volunteer').length,
    helpCount: applications.filter((item) => String(item.engagementType).toLowerCase() === 'need-help').length
  };

  const setStatus = async (id, nextStatus) => {
    try {
      await api.updateApplicationStatus(id, nextStatus);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Kunde inte uppdatera status.');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="card">Laddar...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

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
                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={6}>Inga anmälningar hittades.</td>
                  </tr>
                ) : (
                  filtered.map((app) => (
                    <tr key={app.id} className="border-b border-slate-200">
                      <td className="px-3 py-3 text-sm text-slate-800">{app.name}</td>
                      <td className="px-3 py-3 text-sm text-slate-600">{app.engagementType}</td>
                      <td className="px-3 py-3 text-sm text-slate-600">{app.year} / {app.term}</td>
                      <td className="px-3 py-3 text-sm text-slate-600">{app.email}</td>
                      <td className="px-3 py-3 text-sm">
                        <select
                          value={app.status || 'Ny'}
                          onChange={(e) => setStatus(app.id, e.target.value)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${String(app.consentGiven).toUpperCase() === 'TRUE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {String(app.consentGiven).toUpperCase() === 'TRUE' ? 'Ja' : 'Nej'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
