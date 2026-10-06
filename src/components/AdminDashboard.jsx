import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import api, { unwrapBatchResult } from '../utils/googleAppsScriptApi';
import {
  decodeJwt,
  getStoredIdToken,
  googleSignOut,
  initGoogleSignIn,
  renderGoogleSignInButton,
  storeIdToken
} from '../utils/googleAuth';
import { buildActivityRosterCsv, downloadCsv } from '../utils/csv';
import { collectTermOptions, termKey, termLabel } from '../utils/terms';
import { AdminLayout } from './Layout';
import ActivitiesManager from './admin/ActivitiesManager';
import AdminsManager from './admin/AdminsManager';
import ManualEntryForm from './admin/ManualEntryForm';
import DataRetention from './admin/DataRetention';
import ActivityReport from './admin/ActivityReport';
import LoadingOverlay from './LoadingOverlay';
import ErrorBanner from './ErrorBanner';

const statusOptions = ['Ny', 'Behandlas', 'Godkänd', 'Avslutad'];
const views = [
  { id: 'applications', label: 'Anmälningar' },
  { id: 'activities', label: 'Aktiviteter' },
  { id: 'admins', label: 'Admins' },
  { id: 'retention', label: 'Dataskydd' },
  { id: 'reports', label: 'Rapporter' }
];

function formatTimestamp(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

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
        <h2 className="mb-2 text-xl font-bold text-slate-800">Logga in som administratör</h2>
        <p className="mb-6 text-sm text-slate-600">
          Obs! Endast @storalundby.se adresser.
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
  const [filter, setFilter] = useState({ status: 'all', activity: 'all', search: '', term: 'all' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notesDraft, setNotesDraft] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [view, setView] = useState('applications');
  // Each tab's content stays mounted once visited instead of unmounting on
  // tab switch (see the render below) - otherwise every single visit to a
  // tab re-triggers that screen's own full load + full-screen LoadingOverlay,
  // even if you were just there a moment ago. Only the first visit per tab
  // actually loads; switching back and forth after that is instant.
  const [visitedViews, setVisitedViews] = useState(() => new Set(['applications']));
  const [showManualEntry, setShowManualEntry] = useState(false);

  const profile = useMemo(() => (idToken ? decodeJwt(idToken) : null), [idToken]);

  const loadDashboard = async (token) => {
    try {
      setLoading(true);
      const results = await api.batch([
        { action: 'getApplications', params: { idToken: token } },
        { action: 'getAdminSummary', params: { idToken: token } },
        { action: 'getActivities', params: {} }
      ]);
      const apps = unwrapBatchResult(results, 0, 'hämtning av anmälningar');
      const summaryData = unwrapBatchResult(results, 1, 'hämtning av sammanfattning');
      const activityList = unwrapBatchResult(results, 2, 'hämtning av aktiviteter');
      setApplications(apps || []);
      setSummary(summaryData);
      setActivities(activityList || []);
      setError('');
    } catch (err) {
      // Always surface why, even when signing back out - a silent bounce
      // back to the sign-in screen with no explanation is a dead end.
      setError(err.message || 'Kunde inte ladda data.');
      if (isAuthError(err.message)) {
        googleSignOut();
        setIdToken(null);
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

  // Derived live from `applications` (not the one-off summary fetch), so it
  // stays correct after a local status patch in setStatus() without needing
  // a full reload.
  const liveNewCount = applications.filter((app) => String(app.status).toLowerCase() === 'ny').length;

  const termOptions = collectTermOptions(applications);

  const filtered = applications.filter((app) => {
    if (filter.status !== 'all' && app.status !== filter.status) return false;
    if (filter.activity !== 'all' && !(app.selectedActivities || []).includes(filter.activity)) return false;
    if (filter.term !== 'all' && termKey(app.year, app.term) !== filter.term) return false;
    if (filter.search) {
      const haystack = `${app.guardianName} ${app.guardianEmail} ${app.scoutName}`.toLowerCase();
      if (!haystack.includes(filter.search.toLowerCase())) return false;
    }
    return true;
  });

  const setStatus = async (id, nextStatus) => {
    try {
      await api.updateApplicationStatus(id, nextStatus, idToken);
      // Patch locally instead of a full loadDashboard() - we already know
      // exactly what changed, and reloading everything (plus the
      // full-screen loading overlay that comes with it) for a one-field
      // status change is disruptive and unnecessary round trips.
      setApplications((prev) => prev.map((app) => (app.id === id ? { ...app, status: nextStatus } : app)));
    } catch (err) {
      setError(err.message || 'Kunde inte uppdatera status.');
    }
  };

  const saveNotes = async (id) => {
    const notes = notesDraft[id] ?? '';
    try {
      await api.updateApplicationNotes(id, notes, idToken);
      setApplications((prev) => prev.map((app) => (app.id === id ? { ...app, internalNotes: notes } : app)));
    } catch (err) {
      setError(err.message || 'Kunde inte spara anteckning.');
    }
  };

  const handleSignOut = () => {
    googleSignOut();
    setIdToken(null);
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between text-sm text-slate-600 print:hidden">
          <span>Inloggad som {profile?.email}</span>
          <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={handleSignOut}>
            Logga ut
          </button>
        </div>

        <nav className="flex gap-2 border-b border-slate-200 print:hidden">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setView(v.id);
                setVisitedViews((prev) => (prev.has(v.id) ? prev : new Set(prev).add(v.id)));
              }}
              className={`px-4 py-2 text-sm font-semibold ${
                view === v.id ? 'border-b-2 border-brand-500 text-brand-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>

        {/* This error/retry is about loadDashboard's own data (applications,
            summary, the activities list used for filtering) - it belongs on
            the Anmälningar tab that actually shows that data. Aktiviteter,
            Admins, Dataskydd and Rapporter each load their own data and show
            their own ErrorBanner; showing this one on top of their
            successfully-loaded content was confusing - looked like "this
            screen is broken" when it wasn't. */}
        {view === 'applications' && error && <ErrorBanner message={error} onRetry={() => loadDashboard(idToken)} />}

        {visitedViews.has('activities') && (
          <div style={{ display: view === 'activities' ? 'block' : 'none' }}>
            <ActivitiesManager idToken={idToken} />
          </div>
        )}
        {visitedViews.has('admins') && (
          <div style={{ display: view === 'admins' ? 'block' : 'none' }}>
            <AdminsManager idToken={idToken} currentEmail={profile?.email} />
          </div>
        )}
        {visitedViews.has('retention') && (
          <div style={{ display: view === 'retention' ? 'block' : 'none' }}>
            <DataRetention idToken={idToken} />
          </div>
        )}
        {visitedViews.has('reports') && (
          <div style={{ display: view === 'reports' ? 'block' : 'none' }}>
            <ActivityReport idToken={idToken} />
          </div>
        )}

        {view === 'applications' && summary && (
          <section className="grid gap-4 md:grid-cols-4">
            <div className="card border-l-4 border-brand-500 bg-brand-50">
              <div className="text-sm text-slate-600">Totalt</div>
              <div className="mt-2 text-3xl font-bold text-brand-500">{summary.total}</div>
            </div>
            <div className="card border-l-4 border-yellow-500 bg-yellow-50">
              <div className="text-sm text-slate-600">Nya</div>
              <div className="mt-2 text-3xl font-bold text-yellow-500">{liveNewCount}</div>
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

        {view === 'applications' && showManualEntry && (
          <ManualEntryForm
            activities={activities}
            idToken={idToken}
            onCancel={() => setShowManualEntry(false)}
            onSaved={() => { setShowManualEntry(false); loadDashboard(idToken); }}
          />
        )}

        {view === 'applications' && (
        <section className="card">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-bold text-slate-800">Anmälningar</h2>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setShowManualEntry((v) => !v)}>
                + Lägg till manuellt
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => downloadCsv('anmalningar.csv', buildActivityRosterCsv(filtered, activities))}
              >
                Exportera CSV
              </button>
              <input
                type="text"
                placeholder="Sök namn, e-post, scout..."
                value={filter.search}
                onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
                className="input w-auto"
              />
              <select
                value={filter.term}
                onChange={(e) => setFilter((prev) => ({ ...prev, term: e.target.value }))}
                className="input w-auto"
              >
                <option value="all">Alla terminer</option>
                {termOptions.map(({ year, term }) => (
                  <option key={termKey(year, term)} value={termKey(year, term)}>{termLabel(year, term)}</option>
                ))}
              </select>
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
                  <th className="px-3 py-3 text-sm font-semibold text-slate-700">Deltagare</th>
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
                    <Fragment key={app.id}>
                    <tr className="border-b border-slate-200 align-top">
                      <td className="px-3 py-3 text-sm text-slate-800">
                        <button
                          type="button"
                          className="mb-1 flex items-center gap-1 text-left font-medium hover:text-brand-600"
                          onClick={() => setExpandedId((current) => (current === app.id ? null : app.id))}
                        >
                          <span className="text-xs text-slate-400">{expandedId === app.id ? '▾' : '▸'}</span>
                          {app.guardianName}
                        </button>
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
                          placeholder="Intern anteckning (visas ej för användare)"
                        />
                      </td>
                    </tr>
                    {expandedId === app.id && (
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td colSpan={6} className="px-3 py-3 text-sm text-slate-700">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <span className="font-semibold text-slate-600">Kommentar:</span>
                              <p className="mt-1 text-slate-600">{app.comments || '(ingen kommentar)'}</p>
                            </div>
                            <div className="text-slate-600">
                              <div><span className="font-semibold">Anmäld:</span> {formatTimestamp(app.createdAt)}</div>
                              <div><span className="font-semibold">Senast ändrad:</span> {formatTimestamp(app.updatedAt)}</div>
                              <div><span className="font-semibold">Samtycke lämnat:</span> {formatTimestamp(app.consentAt)} (version {app.consentVersion})</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>
    </AdminLayout>
  );
}
