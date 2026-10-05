import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/googleAppsScriptApi';

const SWEDISH_MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'
];

function formatActivityWhen(activity) {
  let datePart = '';
  if (activity.date) {
    const [year, month, day] = String(activity.date).split('T')[0].split('-').map(Number);
    if (year && month && day) datePart = `${day} ${SWEDISH_MONTHS[month - 1]}`;
  }
  const timePart = activity.startTime && activity.endTime ? `kl ${activity.startTime}-${activity.endTime}` : '';
  return [datePart, timePart, activity.location].filter(Boolean).join(', ');
}

export default function ActivityReport({ idToken }) {
  const [activities, setActivities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        // Sequential, not Promise.all: Apps Script Web Apps don't reliably
        // handle several concurrent requests from the same client.
        const activityList = await api.getActivitiesAdmin(idToken);
        const apps = await api.getApplications(idToken);
        if (cancelled) return;
        setActivities([...activityList].sort((a, b) => a.sortOrder - b.sortOrder));
        setApplications(apps || []);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Kunde inte ladda data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActivity = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedActivities = useMemo(
    () => activities.filter((a) => selectedIds.includes(a.id)),
    [activities, selectedIds]
  );

  const participantsByActivity = useMemo(() => {
    const map = {};
    selectedIds.forEach((id) => { map[id] = []; });
    applications.forEach((app) => {
      (app.selectedActivities || []).forEach((id) => {
        if (map[id]) {
          map[id].push({
            guardianName: app.guardianName,
            guardianPhone: app.guardianPhone,
            guardianEmail: app.guardianEmail,
            scoutName: app.scoutName,
            avdelning: app.avdelning
          });
        }
      });
    });
    return map;
  }, [applications, selectedIds]);

  const generatedOn = new Date().toLocaleDateString('sv-SE');

  if (loading) return <div className="card">Laddar...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 print:hidden">{error}</div>}

      <section className="card print:hidden">
        <h2 className="mb-2 text-xl font-bold text-slate-800">Skapa kontaktlista</h2>
        <p className="mb-4 text-sm text-slate-500">
          Välj en eller flera aktiviteter. Förhandsgranskningen nedan visar exakt vad som skrivs ut -
          klicka sedan på "Skriv ut / Spara som PDF" och välj "Spara som PDF" i skrivardialogen.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {activities.map((activity) => (
            <label key={activity.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedIds.includes(activity.id)}
                onChange={() => toggleActivity(activity.id)}
              />
              <span>
                <span className="block font-medium text-slate-800">{activity.label}</span>
                <span className="block text-slate-500">{formatActivityWhen(activity) || '(stående roll)'}</span>
              </span>
            </label>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-primary mt-4"
          disabled={selectedIds.length === 0}
          onClick={() => window.print()}
        >
          Skriv ut / Spara som PDF
        </button>
      </section>

      {selectedActivities.length > 0 && (
        <section className="card print:border-0 print:p-0 print:shadow-none">
          <header className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4 print:border-slate-400">
            <img src="/lily-blue.svg" alt="" className="h-10 w-auto" />
            <div>
              <div className="font-logo text-lg font-bold uppercase tracking-wide text-brand-500">
                Stora Lundby Scoutkår
              </div>
              <div className="text-sm text-slate-500">Kontaktlista - genererad {generatedOn}</div>
            </div>
          </header>

          <div className="space-y-8">
            {selectedActivities.map((activity) => {
              const participants = participantsByActivity[activity.id] || [];
              return (
                <div key={activity.id} className="break-inside-avoid">
                  <h3 className="text-lg font-bold text-slate-800">{activity.label}</h3>
                  <p className="mb-2 text-sm text-slate-500">{formatActivityWhen(activity) || 'Stående roll'}</p>
                  {participants.length === 0 ? (
                    <p className="text-sm text-slate-500">Inga anmälningar ännu.</p>
                  ) : (
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-300">
                        <tr>
                          <th className="py-1 pr-4">Namn</th>
                          <th className="py-1 pr-4">Telefon</th>
                          <th className="py-1 pr-4">E-post</th>
                          <th className="py-1 pr-4">Scout</th>
                          <th className="py-1 pr-4">Avdelning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p, index) => (
                          <tr key={index} className="border-b border-slate-100">
                            <td className="py-1 pr-4">{p.guardianName}</td>
                            <td className="py-1 pr-4">{p.guardianPhone}</td>
                            <td className="py-1 pr-4">{p.guardianEmail}</td>
                            <td className="py-1 pr-4">{p.scoutName}</td>
                            <td className="py-1 pr-4">{p.avdelning}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
