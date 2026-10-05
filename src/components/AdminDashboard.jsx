import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/googleAppsScriptApi';
import {
  decodeJwt,
  getStoredIdToken,
  googleSignOut,
  initGoogleSignIn,
  renderGoogleSignInButton,
  storeIdToken
} from '../utils/googleAuth';
import { AdminLayout } from './Layout';

const statusOptions = ['Ny', 'Behandlas', 'Godkänd', 'Avslutad'];

function isAuthError(message) {
  if (!message) return false;
  return /inloggning krävs|åtkomst nekad|ogiltig inloggning/i.test(message);
}

function SignInScreen({ error }) {
  const buttonRef = useRef(null);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    let cancelled = false;

    initGoogleSignIn({
      onCredential: (credential) => {
        storeIdToken(credential);
        window.location.reload();
      }
    })
      .then(() => {
        if (!cancelled) renderGoogleSignInButton(buttonRef.current);
      })
      .catch((err) => {
        if (!cancelled) setSetupError(err.message || 'Kunde inte initiera Google Sign-In.');
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <AdminLayout>
      <div className="card mx-auto max-w-md text-center">
        <h2 className="mb-2 text-xl font-bold text-slate-800">Logga in som admin</h2>
        <p className="mb-6 text-sm text-slate-600">
          Endast e-postadresser som finns i Admins-fliken i kalkylarket kan se anmälningarna.
        </p>
        <div ref={buttonRef} className="flex justify-center" />
        {setupError && <p className="mt-4 text-sm text-red-700">{setupError}</p>}
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    </AdminLayout>
  );
}

export default function AdminDashboard() {
  const [idToken, setIdToken] = useState(() => getStoredIdToken());
  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState({ status: 'all', activity: 'all', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notesDraft, setNotesDraft] = useState({});

  const profile = useMemo(() => (idToken ? decodeJwt(idToken) : null), [idToken]);

  const loadDashboard = async (token) => {
    try {
      setLoading(true);
      const [apps, summaryData, activityList] = await Promise.all([
        api.getApplications(token),
        api.getAdminSummary(token),
        api.getActivities()
      ]);
      setApplications(apps || []);
      setSummary(summaryData);
      setActivities(activityList || []);
      setError('');
    } catch (err) {
      if (isAuthError(err.message)) {
        googleSignOut();
        setIdToken(null);
      } else {
        setError(err.message || 'Kunde inte ladda data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idToken) {
      loadDashboard(idToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  if (!idToken) {
    return <SignInScreen error={error} />;
  }

  const filtered = applications.filter((app) => {
    if (filter.status !== 'all' && app.status !== filter.status) return false;
    if (filter.activity !== 'all' && !(app.selectedActivities || []).includes(filter.activity)) return false;
    if (filter.search) {
      const haystack = `${app.guardianName} ${app.guardianEmail} ${app.scoutName}`.toLowerCase();
      if (!haystack.includes(filter.search.toLowerCase())) return false;
    }
    return true;
  });

  const setStatus = async (id, nextStatus) => {
    try {
      await api.updateApplicationStatus(id, nextStatus, idToken);
      await loadDashboard(idToken);
    } catch (err) {
      setError(err.message || 'Kunde inte uppdatera status.');
    }
  };

  const saveNotes = async (id) => {
    try {
      await api.updateApplicationNotes(id, notesDraft[id] ?? '', idToken);
      await loadDashboard(idToken);
    } catch (err) {
      setError(err.message || 'Kunde inte spara anteckning.');
    }
  };

  const handleSignOut = () => {
    googleSignOut();
    setIdToken(null);
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
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Inloggad som {profile?.email}</span>
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={handleSignOut}>
            Logga ut
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {summary && (
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
              <div className="text-sm text-slate-600">Bemannade pass</div>
              <div className="mt-2 text-3xl font-bold text-green-500">{summary.attendanceCount}</div>
            </div>
            <div className="card border-l-4 border-violet-500 bg-violet-50">
              <div className="text-sm text-slate-600">Lotterigåvor / stående roller</div>
              <div className="mt-2 text-3xl font-bold text-violet-500">{summary.giftCount + summary.standingRoleCount}</div>
            </div>
          </section>
        )}

        <section className="card">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-bold text-slate-800">Anmälningar</h2>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Sök namn, e-post, scout..."
                value={filter.search}
                onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
                className="input w-auto"
              />
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
                value={filter.activity}
                onChange={(e) => setFilter((prev) => ({ ...prev, activity: e.target.value }))}
                className="input w-auto"
              >
                <option value="all">Alla aktiviteter</option>
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>{activity.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Vårdnadshavare</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Scout / avdelning</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Aktiviteter</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Samtycke</th>
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Anteckning</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={6}>Inga anmälningar hittades.</td>
                  </tr>
                ) : (
                  filtered.map((app) => (
                    <tr key={app.id} className="border-b border-slate-200 align-top">
                      <td className="px-3 py-3 text-sm text-slate-800">
                        <div className="font-medium">{app.guardianName}</div>
                        <div className="text-slate-500">{app.guardianEmail}</div>
                        <div className="text-slate-500">{app.guardianPhone}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-600">
                        <div>{app.scoutName}</div>
                        <div className="text-slate-500">{app.avdelning}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-600">
                        <ul className="list-inside list-disc space-y-1">
                          {(app.selectedActivityLabels || []).map((label, index) => (
                            <li key={index}>{label}</li>
                          ))}
                        </ul>
                        {app.ownSuggestionText && (
                          <div className="mt-1 italic text-slate-500">Eget förslag: {app.ownSuggestionText}</div>
                        )}
                      </td>
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
                      <td className="px-3 py-3 text-sm">
                        <textarea
                          className="w-48 rounded border border-slate-300 p-1 text-xs"
                          rows={2}
                          value={notesDraft[app.id] ?? app.internalNotes ?? ''}
                          onChange={(e) => setNotesDraft((prev) => ({ ...prev, [app.id]: e.target.value }))}
                          onBlur={() => {
                            if ((notesDraft[app.id] ?? '') !== (app.internalNotes ?? '')) {
                              saveNotes(app.id);
                            }
                          }}
                          placeholder="Intern anteckning (visas ej för vårdnadshavare)"
                        />
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
