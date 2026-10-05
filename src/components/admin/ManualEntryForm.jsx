import { useState } from 'react';
import api from '../../utils/googleAppsScriptApi';
import { AVDELNINGAR } from '../../utils/constants';

const emptyForm = {
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  scoutName: '',
  avdelning: '',
  selectedActivities: [],
  ownSuggestionText: '',
  comments: ''
};

export default function ManualEntryForm({ activities, idToken, onSaved, onCancel }) {
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const eventActivities = activities.filter((a) => a.category !== 'standing-role');
  const standingRoleActivities = activities.filter((a) => a.category === 'standing-role');

  const update = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const toggleActivity = (id) => {
    setFormData((prev) => ({
      ...prev,
      selectedActivities: prev.selectedActivities.includes(id)
        ? prev.selectedActivities.filter((a) => a !== id)
        : [...prev.selectedActivities, id]
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.guardianName || !formData.scoutName || !formData.avdelning) {
      setError('Ditt namn, scoutens namn och avdelning krävs.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createManualApplication(formData, idToken);
      onSaved();
    } catch (err) {
      setError(err.message || 'Kunde inte spara anmälan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="text-lg font-bold text-slate-800">Lägg till anmälan manuellt</h3>
      <p className="text-sm text-slate-500">För en förälder som lämnat in pappersblanketten istället för webbformuläret.</p>

      <div className="grid gap-4 md:grid-cols-2">
        <input className="input" placeholder="Namn" value={formData.guardianName} onChange={(e) => update('guardianName', e.target.value)} required />
        <input className="input" placeholder="Telefon" value={formData.guardianPhone} onChange={(e) => update('guardianPhone', e.target.value)} />
        <input className="input" placeholder="E-post" type="email" value={formData.guardianEmail} onChange={(e) => update('guardianEmail', e.target.value)} />
        <input className="input" placeholder="Scoutens namn" value={formData.scoutName} onChange={(e) => update('scoutName', e.target.value)} required />
        <select className="input" value={formData.avdelning} onChange={(e) => update('avdelning', e.target.value)} required>
          <option value="">Välj avdelning</option>
          {AVDELNINGAR.map((avdelning) => (
            <option key={avdelning} value={avdelning}>{avdelning}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-slate-700">Aktiviteter</h4>
        {[...eventActivities, ...standingRoleActivities].map((activity) => (
          <label key={activity.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.selectedActivities.includes(activity.id)} onChange={() => toggleActivity(activity.id)} />
            {activity.label}
          </label>
        ))}
      </div>

      {formData.selectedActivities.includes('own-suggestion') && (
        <input className="input" placeholder="Eget förslag" value={formData.ownSuggestionText} onChange={(e) => update('ownSuggestionText', e.target.value)} />
      )}

      <textarea className="input" placeholder="Kommentar" value={formData.comments} onChange={(e) => update('comments', e.target.value)} />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Avbryt</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Sparar...' : 'Spara anmälan'}</button>
      </div>
    </form>
  );
}
