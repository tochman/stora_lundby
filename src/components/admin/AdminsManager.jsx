import { useEffect, useState } from 'react';
import api from '../../utils/googleAppsScriptApi';
import LoadingOverlay from '../LoadingOverlay';

export default function AdminsManager({ idToken, currentEmail }) {
  const [admins, setAdmins] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingEmail, setTogglingEmail] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const list = await api.getAdmins(idToken);
      setAdmins(list);
      setError('');
    } catch (err) {
      setError(err.message || 'Kunde inte ladda adminlistan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAdmin = async (event) => {
    event.preventDefault();
    if (!newEmail.trim() || submitting) return;
    try {
      setSubmitting(true);
      await api.addAdmin(newEmail.trim(), idToken);
      setNewEmail('');
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte lägga till admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (email, active) => {
    if (togglingEmail) return;
    if (email === currentEmail && !active) {
      if (!window.confirm('Du är på väg att ta bort din egen adminbehörighet. Fortsätta?')) return;
    }
    try {
      setTogglingEmail(email);
      await api.setAdminActive(email, active, idToken);
      await load();
    } catch (err) {
      setError(err.message || 'Kunde inte uppdatera admin.');
    } finally {
      setTogglingEmail(null);
    }
  };

  if (loading) return <LoadingOverlay label="Laddar admins..." />;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Lägg till admin</h2>
        <form onSubmit={addAdmin} className="flex gap-3">
          <input
            type="email"
            className="input"
            placeholder="namn@exempel.se"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary whitespace-nowrap" disabled={submitting}>
            {submitting ? 'Lägger till...' : 'Lägg till'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Admins</h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="px-2 py-2">E-post</th>
              <th className="px-2 py-2">Roll</th>
              <th className="px-2 py-2">Aktiv</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => {
              const isActive = String(admin.active).toUpperCase() === 'TRUE';
              return (
                <tr key={admin.email} className="border-b border-slate-200">
                  <td className="px-2 py-2">{admin.email}{admin.email === currentEmail ? ' (du)' : ''}</td>
                  <td className="px-2 py-2">{admin.role}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
                      disabled={togglingEmail === admin.email}
                      onClick={() => toggleActive(admin.email, !isActive)}
                    >
                      {togglingEmail === admin.email ? '...' : isActive ? 'Inaktivera' : 'Aktivera'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
