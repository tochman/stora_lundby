import { useEffect, useMemo, useState } from 'react';
import api, { unwrapBatchResult } from '../../utils/googleAppsScriptApi';
import LoadingOverlay from '../LoadingOverlay';
import ErrorBanner from '../ErrorBanner';
import { collectTermOptions, termKey, termLabel } from '../../utils/terms';
import { formatActivityWhen } from '../../utils/dates';

export default function ActivityReport({ idToken }) {
  const [activities, setActivities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [config, setConfig] = useState(null);
  const [paperForm, setPaperForm] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [termFilter, setTermFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [generatingForm, setGeneratingForm] = useState(false);
  const [deletingForm, setDeletingForm] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const results = await api.batch([
        { action: 'getActivitiesAdmin', params: { idToken } },
        { action: 'getApplications', params: { idToken } },
        { action: 'getConfig', params: {} },
        { action: 'getPaperForm', params: { idToken } }
      ]);
      const activityList = unwrapBatchResult(results, 0, 'hämtning av aktiviteter');
      const apps = unwrapBatchResult(results, 1, 'hämtning av anmälningar');
      const publicConfig = unwrapBatchResult(results, 2, 'hämtning av inställningar');
      const existingPaperForm = unwrapBatchResult(results, 3, 'hämtning av pappersblankett');
      setActivities([...activityList].sort((a, b) => a.sortOrder - b.sortOrder));
      setApplications(apps || []);
      setConfig(publicConfig);
      setPaperForm(existingPaperForm);
      setError('');
      setHasLoaded(true);
    } catch (err) {
      setError(err.message || 'Kunde inte ladda data.');
    } finally {
      setLoading(false);
    }
  };

  const generatePaperForm = async () => {
    if (generatingForm || !config) return;
    try {
      setGeneratingForm(true);
      setFormNotice('');
      const result = await api.generatePaperForm(config.currentYear, config.currentTerm, idToken);
      setPaperForm({ year: config.currentYear, term: config.currentTerm, docUrl: result.docUrl, docId: result.docId });
      setFormNotice('Pappersblanketten har skapats.');
    } catch (err) {
      setError(err.message || 'Kunde inte skapa pappersblanketten.');
    } finally {
      setGeneratingForm(false);
    }
  };

  const deletePaperForm = async () => {
    if (deletingForm || !config) return;
    if (!window.confirm('Ta bort den aktuella pappersblanketten? Du kan skapa en ny direkt efteråt.')) return;
    try {
      setDeletingForm(true);
      setFormNotice('');
      await api.deletePaperForm(config.currentYear, config.currentTerm, idToken);
      setPaperForm(null);
      setFormNotice('Pappersblanketten togs bort.');
    } catch (err) {
      setError(err.message || 'Kunde inte ta bort pappersblanketten.');
    } finally {
      setDeletingForm(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defaults the checklist to the current term once config arrives, instead
  // of listing every activity from every term ever created - that made the
  // card grow very tall with little way to tell where it ended. Only runs
  // once (on config's first load), so switching back to "Alla terminer"
  // afterwards sticks.
  useEffect(() => {
    if (config && termFilter === 'all') {
      setTermFilter(termKey(config.currentYear, config.currentTerm));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const toggleActivity = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const termOptions = useMemo(() => collectTermOptions(activities), [activities]);

  // Standing roles aren't tied to a single term (they're perpetual), so a
  // term filter leaves them visible regardless of which term is selected -
  // filtering them out would just hide them from every term-scoped view.
  const visibleActivities = useMemo(() => {
    if (termFilter === 'all') return activities;
    return activities.filter((a) => (!a.year && !a.term) || termKey(a.year, a.term) === termFilter);
  }, [activities, termFilter]);

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

  if (loading) return <LoadingOverlay />;

  if (error && !hasLoaded) {
    return (
      <div className="space-y-6">
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="print:hidden"><ErrorBanner message={error} onRetry={load} /></div>}

      <section className="card print:hidden">
        <h2 className="mb-2 text-xl font-bold text-slate-800">Pappersblankett (Google Doc)</h2>
        <p className="mb-4 text-sm text-slate-500">
          För medlemmar som föredrar papper - aktuell termins aktiviteter plus en QR-kod till webbformuläret.
        </p>
        {config && (
          <>
            <p className="mb-3 text-sm font-semibold text-slate-700">{config.currentTerm} {config.currentYear}</p>
            {paperForm ? (
              <div className="flex flex-wrap items-center gap-3">
                <a href={paperForm.docUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
                  Öppna pappersblankett
                </a>
                <button
                  type="button"
                  className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                  disabled={deletingForm}
                  onClick={deletePaperForm}
                >
                  {deletingForm ? 'Tar bort...' : 'Ta bort'}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" disabled={generatingForm} onClick={generatePaperForm}>
                {generatingForm ? 'Skapar...' : 'Skapa pappersblankett'}
              </button>
            )}
            {formNotice && <p className="mt-3 text-sm text-green-700">{formNotice}</p>}
          </>
        )}
      </section>

      <section className="card print:hidden">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800">Skapa kontaktlista</h2>
          <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className="input w-auto">
            <option value="all">Alla terminer</option>
            {termOptions.map(({ year, term }) => (
              <option key={termKey(year, term)} value={termKey(year, term)}>{termLabel(year, term)}</option>
            ))}
          </select>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Välj aktiviteter - förhandsgranskningen nedan visar vad som skrivs ut.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleActivities.map((activity) => (
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
