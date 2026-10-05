import { useEffect, useState } from 'react';
import api from '../../utils/googleAppsScriptApi';

const CATEGORY_LABELS = {
  gift: 'Lotterigåva',
  prep: 'Förberedelse',
  'market-shift': 'Marknadspass',
  workday: 'Arbetsdag',
  baking: 'Pysseldag / bak',
  'standing-role': 'Stående roll'
};

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

function ActivityRow({ activity, idToken, onSaved, onDeleted, onError }) {
  const [draft, setDraft] = useState(activity);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(activity);

  const update = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));

  const save = async () => {
    try {
      setSaving(true);
      await api.upsertActivity(draft, idToken);
      onSaved();
    } catch (err) {
      onError(err.message || 'Kunde inte spara aktiviteten.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Ta bort "${draft.label}"?`)) return;
    try {
      await api.deleteActivity(draft.id, idToken);
      onDeleted();
    } catch (err) {
      onError(err.message || 'Kunde inte ta bort aktiviteten.');
    }
  };

  return (
    <tr className="border-b border-slate-200 align-top">
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
      <td className="px-2 py-2"><input className="input" value={draft.location} onChange={(e) => update('location', e.target.value)} /></td>
      <td className="px-2 py-2"><input className="input w-20" type="number" min="0" value={draft.capacity ?? ''} onChange={(e) => update('capacity', e.target.value === '' ? '' : Number(e.target.value))} /></td>
      <td className="px-2 py-2"><input className="input w-16" type="number" value={draft.sortOrder} onChange={(e) => update('sortOrder', Number(e.target.value))} /></td>
      <td className="px-2 py-2 text-center">
        <input type="checkbox" checked={draft.active} onChange={(e) => update('active', e.target.checked)} />
      </td>
      <td className="whitespace-nowrap px-2 py-2">
        <button type="button" className="btn btn-primary mr-2 px-2 py-1 text-xs" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Sparar...' : 'Spara'}
        </button>
        <button type="button" className="text-xs font-semibold text-red-600 hover:underline" onClick={remove}>
          Ta bort
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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      // Sequential, not Promise.all: Apps Script Web Apps don't reliably
      // handle several concurrent requests from the same client.
      const activityList = await api.getActivitiesAdmin(idToken);
      const publicConfig = await api.getConfig();
      setActivities(activityList.sort((a, b) => a.sortOrder - b.sortOrder));
      setConfig(publicConfig);
      setConfigDraft(publicConfig);
      setError('');
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

  const saveConfig = async () => {
    try {
      await api.updateConfig(configDraft, idToken);
      setNotice('Inställningar sparade.');
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte spara inställningar.');
    }
  };

  const addActivity = async (event) => {
    event.preventDefault();
    try {
      await api.upsertActivity(
        { ...newActivity, year: newActivity.category === 'standing-role' ? '' : newActivity.year, term: newActivity.category === 'standing-role' ? '' : newActivity.term },
        idToken
      );
      setNewActivity(emptyDraft);
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte lägga till aktiviteten.');
    }
  };

  const copyFromPreviousTerm = async (event) => {
    event.preventDefault();
    try {
      const result = await api.copyActivities(copyForm.fromYear, copyForm.fromTerm, copyForm.toYear, copyForm.toTerm, idToken);
      setNotice(`Kopierade ${result.copied} aktiviteter. Kom ihåg att sätta nya datum.`);
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte kopiera aktiviteter.');
    }
  };

  if (loading) return <div className="card">Laddar aktiviteter...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}

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
              <button type="button" className="btn btn-primary w-full" onClick={saveConfig}>Spara</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Kopiera föregående termins aktiviteter</h2>
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
          <button type="submit" className="btn btn-primary">Kopiera</button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Aktiviteter</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="px-2 py-2">Kategori</th>
                <th className="px-2 py-2">Rubrik</th>
                <th className="px-2 py-2">Datum</th>
                <th className="px-2 py-2">Start</th>
                <th className="px-2 py-2">Slut</th>
                <th className="px-2 py-2">Plats</th>
                <th className="px-2 py-2">Platser</th>
                <th className="px-2 py-2">Ordning</th>
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
                  onSaved={() => { setNotice('Sparat.'); load(); }}
                  onDeleted={() => { setNotice('Borttagen.'); load(); }}
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
              <input className="input" placeholder="Plats" value={newActivity.location} onChange={(e) => setNewActivity((p) => ({ ...p, location: e.target.value }))} />
            </>
          )}
          <button type="submit" className="btn btn-primary">Lägg till</button>
        </form>
      </section>
    </div>
  );
}
