import { useEffect, useMemo, useState } from 'react';
import api, { unwrapBatchResult } from '../../utils/googleAppsScriptApi';
import LoadingOverlay from '../LoadingOverlay';
import ErrorBanner from '../ErrorBanner';

const CATEGORY_LABELS = {
  gift: 'Lotterigåva',
  prep: 'Förberedelse',
  'market-shift': 'Marknadspass',
  workday: 'Arbetsdag',
  baking: 'Pysseldag / bak',
  'standing-role': 'Stående roll'
};

const LOCATIONS_DATALIST_ID = 'activity-locations';

const emptyDraft = {
  id: '',
  year: '',
  term: '',
  category: 'market-shift',
  label: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  capacity: '',
  active: true,
  sortOrder: 0
};

function ActivityRow({ activity, idToken, onSaved, onDeleted, onError, dragState, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [draft, setDraft] = useState(activity);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(activity);

  const update = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));

  const save = async () => {
    try {
      setSaving(true);
      const result = await api.upsertActivity(draft, idToken);
      // Update the row in place rather than reloading the whole list -
      // we already know exactly what changed, and a full-screen loading
      // overlay for editing one field in one row is disruptive, especially
      // with many activities and Apps Script's per-request latency.
      onSaved({ ...draft, id: result.id || draft.id });
    } catch (err) {
      onError(err.message || 'Kunde inte spara aktiviteten.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (deleting || !window.confirm(`Ta bort "${draft.label}"?`)) return;
    try {
      setDeleting(true);
      await api.deleteActivity(draft.id, idToken);
      onDeleted(draft.id);
    } catch (err) {
      onError(err.message || 'Kunde inte ta bort aktiviteten.');
      setDeleting(false);
    }
  };

  return (
    <tr
      className={`border-b border-slate-200 align-top ${dragState.overId === activity.id ? 'bg-brand-50' : ''}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver(activity.id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(activity.id); }}
    >
      <td
        className="cursor-grab px-2 py-2 text-center text-slate-400 active:cursor-grabbing"
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', activity.id); onDragStart(activity.id); }}
        onDragEnd={onDragEnd}
        title="Dra för att ändra ordning"
      >
        ⠿
      </td>
      <td className="px-2 py-2">
        <select className="input" value={draft.category} onChange={(e) => update('category', e.target.value)}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2"><input className="input" value={draft.label} onChange={(e) => update('label', e.target.value)} /></td>
      <td className="px-2 py-2"><input className="input" type="date" value={draft.date} onChange={(e) => update('date', e.target.value)} /></td>
      <td className="px-2 py-2"><input className="input" type="time" value={draft.startTime} onChange={(e) => update('startTime', e.target.value)} /></td>
      <td className="px-2 py-2"><input className="input" type="time" value={draft.endTime} onChange={(e) => update('endTime', e.target.value)} /></td>
      <td className="px-2 py-2">
        <input className="input" list={LOCATIONS_DATALIST_ID} value={draft.location} onChange={(e) => update('location', e.target.value)} />
      </td>
      <td className="px-2 py-2"><input className="input w-20" type="number" min="0" value={draft.capacity ?? ''} onChange={(e) => update('capacity', e.target.value === '' ? '' : Number(e.target.value))} /></td>
      <td className="px-2 py-2 text-center">
        <input type="checkbox" checked={draft.active} onChange={(e) => update('active', e.target.checked)} />
      </td>
      <td className="whitespace-nowrap px-2 py-2">
        <button type="button" className="btn btn-primary mr-2 px-2 py-1 text-xs" disabled={!dirty || saving || deleting} onClick={save}>
          {saving ? 'Sparar...' : 'Spara'}
        </button>
        <button type="button" className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50" disabled={saving || deleting} onClick={remove}>
          {deleting ? 'Tar bort...' : 'Ta bort'}
        </button>
      </td>
    </tr>
  );
}

export default function ActivitiesManager({ idToken }) {
  const [activities, setActivities] = useState([]);
  const [config, setConfig] = useState(null);
  const [configDraft, setConfigDraft] = useState(null);
  const [newActivity, setNewActivity] = useState(emptyDraft);
  const [copyForm, setCopyForm] = useState({ fromYear: '', fromTerm: '', toYear: '', toTerm: '' });
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [copying, setCopying] = useState(false);
  const [dragState, setDragState] = useState({ draggedId: null, overId: null });

  const load = async () => {
    try {
      setLoading(true);
      const results = await api.batch([
        { action: 'getActivitiesAdmin', params: { idToken } },
        { action: 'getConfig', params: {} }
      ]);
      const activityList = unwrapBatchResult(results, 0, 'hämtning av aktiviteter');
      const publicConfig = unwrapBatchResult(results, 1, 'hämtning av inställningar');
      setActivities(activityList.sort((a, b) => a.sortOrder - b.sortOrder));
      setConfig(publicConfig);
      setConfigDraft(publicConfig);
      setError('');
      setHasLoaded(true);
    } catch (err) {
      setError(err.message || 'Kunde inte ladda aktiviteter.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locationOptions = useMemo(
    () => [...new Set(activities.map((a) => a.location).filter(Boolean))].sort(),
    [activities]
  );

  const saveConfig = async () => {
    if (savingConfig) return;
    try {
      setSavingConfig(true);
      await api.updateConfig(configDraft, idToken);
      setNotice('Inställningar sparade.');
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte spara inställningar.');
    } finally {
      setSavingConfig(false);
    }
  };

  const addActivity = async (event) => {
    event.preventDefault();
    if (addingActivity) return;
    try {
      setAddingActivity(true);
      const maxSortOrder = activities.reduce((max, a) => Math.max(max, a.sortOrder), 0);
      await api.upsertActivity(
        {
          ...newActivity,
          year: newActivity.category === 'standing-role' ? '' : newActivity.year,
          term: newActivity.category === 'standing-role' ? '' : newActivity.term,
          sortOrder: maxSortOrder + 1
        },
        idToken
      );
      setNewActivity(emptyDraft);
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte lägga till aktiviteten.');
    } finally {
      setAddingActivity(false);
    }
  };

  const copyFromPreviousTerm = async (event) => {
    event.preventDefault();
    if (copying) return;
    try {
      setCopying(true);
      const result = await api.copyActivities(copyForm.fromYear, copyForm.fromTerm, copyForm.toYear, copyForm.toTerm, idToken);
      setNotice(`Kopierade ${result.copied} aktiviteter. Kom ihåg att sätta nya datum.`);
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte kopiera aktiviteter.');
    } finally {
      setCopying(false);
    }
  };

  // Reordering only ever needs to persist the ONE moved activity: its new
  // sortOrder is the midpoint between its new neighbors (fractional - that's
  // fine, we only ever compare these numerically). That keeps a drag-drop
  // to a single backend write instead of renumbering and saving every row.
  const handleDrop = async (targetId) => {
    const draggedId = dragState.draggedId;
    setDragState({ draggedId: null, overId: null });
    if (!draggedId || draggedId === targetId) return;

    const sorted = [...activities].sort((a, b) => a.sortOrder - b.sortOrder);
    const dragged = sorted.find((a) => a.id === draggedId);
    const without = sorted.filter((a) => a.id !== draggedId);
    const targetIndex = without.findIndex((a) => a.id === targetId);
    if (!dragged || targetIndex === -1) return;

    const prevItem = without[targetIndex - 1];
    const nextItem = without[targetIndex];
    let newSortOrder;
    if (prevItem && nextItem) {
      newSortOrder = (prevItem.sortOrder + nextItem.sortOrder) / 2;
    } else if (nextItem) {
      newSortOrder = nextItem.sortOrder - 1;
    } else if (prevItem) {
      newSortOrder = prevItem.sortOrder + 1;
    } else {
      newSortOrder = 0;
    }

    const updated = { ...dragged, sortOrder: newSortOrder };
    const previousActivities = activities;
    setActivities((prev) => prev.map((a) => (a.id === draggedId ? updated : a)).sort((a, b) => a.sortOrder - b.sortOrder));

    try {
      await api.upsertActivity(updated, idToken);
    } catch (err) {
      setError(err.message || 'Kunde inte spara ny ordning.');
      setActivities(previousActivities);
    }
  };

  if (loading) return <LoadingOverlay label="Laddar aktiviteter..." />;

  if (error && !hasLoaded) {
    return (
      <div className="space-y-6">
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} onRetry={load} />}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}

      <datalist id={LOCATIONS_DATALIST_ID}>
        {locationOptions.map((location) => (
          <option key={location} value={location} />
        ))}
      </datalist>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Termin och deadline</h2>
        {configDraft && (
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="label">Aktuellt år</label>
              <input className="input" value={configDraft.currentYear || ''} onChange={(e) => setConfigDraft((p) => ({ ...p, currentYear: e.target.value }))} />
            </div>
            <div>
              <label className="label">Aktuell termin</label>
              <select className="input" value={configDraft.currentTerm || ''} onChange={(e) => setConfigDraft((p) => ({ ...p, currentTerm: e.target.value }))}>
                <option value="Höst">Höst</option>
                <option value="Vår">Vår</option>
              </select>
            </div>
            <div>
              <label className="label">Sista anmälningsdag</label>
              <input className="input" type="date" value={configDraft.submissionDeadline || ''} onChange={(e) => setConfigDraft((p) => ({ ...p, submissionDeadline: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <button type="button" className="btn btn-primary w-full" disabled={savingConfig} onClick={saveConfig}>
                {savingConfig ? 'Sparar...' : 'Spara'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Aktiviteter</h2>
        <p className="mb-4 text-sm text-slate-500">Dra i <span aria-hidden="true">⠿</span> för att ändra ordningen de visas i på formuläret.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="px-2 py-2" />
                <th className="px-2 py-2">Kategori</th>
                <th className="px-2 py-2">Rubrik</th>
                <th className="px-2 py-2">Datum</th>
                <th className="px-2 py-2">Start</th>
                <th className="px-2 py-2">Slut</th>
                <th className="px-2 py-2">Plats</th>
                <th className="px-2 py-2">Platser</th>
                <th className="px-2 py-2">Aktiv</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  idToken={idToken}
                  dragState={dragState}
                  onDragStart={(id) => setDragState({ draggedId: id, overId: null })}
                  onDragOver={(id) => setDragState((s) => ({ ...s, overId: id }))}
                  onDrop={handleDrop}
                  onDragEnd={() => setDragState({ draggedId: null, overId: null })}
                  onSaved={(savedActivity) => {
                    setNotice('Sparat.');
                    setActivities((prev) =>
                      prev
                        .map((a) => (a.id === activity.id ? savedActivity : a))
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                    );
                  }}
                  onDeleted={(deletedId) => {
                    setNotice('Borttagen.');
                    setActivities((prev) => prev.filter((a) => a.id !== deletedId));
                  }}
                  onError={setError}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Lägg till aktivitet</h2>
        <form onSubmit={addActivity} className="grid gap-4 md:grid-cols-4">
          <select className="input" value={newActivity.category} onChange={(e) => setNewActivity((p) => ({ ...p, category: e.target.value }))}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input className="input md:col-span-2" placeholder="Rubrik" value={newActivity.label} onChange={(e) => setNewActivity((p) => ({ ...p, label: e.target.value }))} required />
          {newActivity.category !== 'standing-role' && (
            <>
              <input className="input" placeholder="År" value={newActivity.year} onChange={(e) => setNewActivity((p) => ({ ...p, year: e.target.value }))} />
              <select className="input" value={newActivity.term} onChange={(e) => setNewActivity((p) => ({ ...p, term: e.target.value }))}>
                <option value="">Termin</option>
                <option value="Höst">Höst</option>
                <option value="Vår">Vår</option>
              </select>
              <input className="input" type="date" value={newActivity.date} onChange={(e) => setNewActivity((p) => ({ ...p, date: e.target.value }))} />
              <input className="input" type="time" value={newActivity.startTime} onChange={(e) => setNewActivity((p) => ({ ...p, startTime: e.target.value }))} />
              <input className="input" type="time" value={newActivity.endTime} onChange={(e) => setNewActivity((p) => ({ ...p, endTime: e.target.value }))} />
              <input className="input" list={LOCATIONS_DATALIST_ID} placeholder="Plats" value={newActivity.location} onChange={(e) => setNewActivity((p) => ({ ...p, location: e.target.value }))} />
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={addingActivity}>{addingActivity ? 'Lägger till...' : 'Lägg till'}</button>
        </form>
      </section>

      <details className="card">
        <summary className="cursor-pointer text-xl font-bold text-slate-800">
          Avancerat: kopiera föregående termins aktiviteter
        </summary>
        <p className="mt-2 mb-4 text-sm text-slate-500">
          Skapar kopior av en termins aktiviteter under en ny termin, så att de bara behöver nya datum istället för att skrivas från grunden.
        </p>
        <form onSubmit={copyFromPreviousTerm} className="grid gap-4 md:grid-cols-5">
          <input className="input" placeholder="Från år (t.ex. 2026)" value={copyForm.fromYear} onChange={(e) => setCopyForm((p) => ({ ...p, fromYear: e.target.value }))} />
          <select className="input" value={copyForm.fromTerm} onChange={(e) => setCopyForm((p) => ({ ...p, fromTerm: e.target.value }))}>
            <option value="">Från termin</option>
            <option value="Höst">Höst</option>
            <option value="Vår">Vår</option>
          </select>
          <input className="input" placeholder="Till år" value={copyForm.toYear} onChange={(e) => setCopyForm((p) => ({ ...p, toYear: e.target.value }))} />
          <select className="input" value={copyForm.toTerm} onChange={(e) => setCopyForm((p) => ({ ...p, toTerm: e.target.value }))}>
            <option value="">Till termin</option>
            <option value="Höst">Höst</option>
            <option value="Vår">Vår</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={copying}>{copying ? 'Kopierar...' : 'Kopiera'}</button>
        </form>
      </details>
    </div>
  );
}
