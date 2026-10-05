import { useEffect, useState } from 'react';
import api from '../../utils/googleAppsScriptApi';

export default function DataRetention({ idToken }) {
  const [config, setConfig] = useState(null);
  const [retentionDraft, setRetentionDraft] = useState('');
  const [applications, setApplications] = useState([]);
  const [purgeLog, setPurgeLog] = useState([]);
  const [purgeForm, setPurgeForm] = useState({ year: '', term: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [purging, setPurging] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [publicConfig, apps, log] = await Promise.all([
        api.getConfig(),
        api.getApplications(idToken),
        api.getPurgeLog(idToken)
      ]);
      setConfig(publicConfig);
      setRetentionDraft(publicConfig.retentionPeriodMonths || '24');
      setApplications(apps || []);
      setPurgeLog(log || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Kunde inte ladda data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRetentionPeriod = async () => {
    try {
      await api.updateConfig({ retentionPeriodMonths: retentionDraft }, idToken);
      setNotice('Gallringsperiod sparad.');
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte spara gallringsperiod.');
    }
  };

  const matchingCount = applications.filter(
    (app) => app.year === purgeForm.year && app.term === purgeForm.term
  ).length;

  const handlePurge = async () => {
    if (!purgeForm.year || !purgeForm.term) return;
    if (matchingCount === 0) {
      setError('Hittade inga anmälningar för den valda terminen.');
      return;
    }
    const confirmed = window.confirm(
      `Radera ${matchingCount} anmälan(ar) och tillhörande samtyckesposter för ${purgeForm.term} ${purgeForm.year}? Detta går inte att ångra.`
    );
    if (!confirmed) return;

    try {
      setPurging(true);
      const result = await api.purgeTermData(purgeForm.year, purgeForm.term, idToken);
      setNotice(`Raderade ${result.applicationsPurged} anmälan(ar) och ${result.consentLogPurged} samtyckesposter.`);
      setPurgeForm({ year: '', term: '' });
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte gallra data.');
    } finally {
      setPurging(false);
    }
  };

  if (loading) return <div className="card">Laddar...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}

      <section className="card">
        <h2 className="mb-2 text-xl font-bold text-slate-800">Gallringsperiod</h2>
        <p className="mb-4 text-sm text-slate-500">
          Hur länge en termins personuppgifter (namn, telefon, e-post, scoutuppgifter) sparas innan de bör gallras.
          Gallring sker inte automatiskt - använd formuläret nedan när ni vill radera en viss termin.
        </p>
        <div className="flex items-end gap-3">
          <div>
            <label className="label">Månader</label>
            <input className="input w-32" type="number" min="1" value={retentionDraft} onChange={(e) => setRetentionDraft(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary" onClick={saveRetentionPeriod}>Spara</button>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold text-slate-800">Radera en termins data</h2>
        <p className="mb-4 text-sm text-slate-500">
          Tar bort alla anmälningar och samtyckesposter för den valda terminen permanent. Endast att en gallring
          skett loggas (datum, vem, antal) - inte de raderade uppgifterna.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">År</label>
            <input className="input w-32" value={purgeForm.year} onChange={(e) => setPurgeForm((p) => ({ ...p, year: e.target.value }))} />
          </div>
          <div>
            <label className="label">Termin</label>
            <select className="input w-32" value={purgeForm.term} onChange={(e) => setPurgeForm((p) => ({ ...p, term: e.target.value }))}>
              <option value="">Välj</option>
              <option value="Höst">Höst</option>
              <option value="Vår">Vår</option>
            </select>
          </div>
          {purgeForm.year && purgeForm.term && (
            <p className="text-sm text-slate-600">{matchingCount} anmälan(ar) matchar.</p>
          )}
          <button
            type="button"
            className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            disabled={!purgeForm.year || !purgeForm.term || purging}
            onClick={handlePurge}
          >
            {purging ? 'Raderar...' : 'Radera permanent'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Gallringshistorik</h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="px-2 py-2">Datum</th>
              <th className="px-2 py-2">Av</th>
              <th className="px-2 py-2">Termin</th>
              <th className="px-2 py-2">Anmälningar raderade</th>
              <th className="px-2 py-2">Samtyckesposter raderade</th>
            </tr>
          </thead>
          <tbody>
            {purgeLog.length === 0 ? (
              <tr><td className="px-2 py-4 text-slate-500" colSpan={5}>Ingen gallring har skett ännu.</td></tr>
            ) : (
              purgeLog.map((entry, index) => (
                <tr key={index} className="border-b border-slate-200">
                  <td className="px-2 py-2">{String(entry.purgedAt)}</td>
                  <td className="px-2 py-2">{entry.purgedBy}</td>
                  <td className="px-2 py-2">{entry.term} {entry.year}</td>
                  <td className="px-2 py-2">{entry.applicationsPurged}</td>
                  <td className="px-2 py-2">{entry.consentLogPurged}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
