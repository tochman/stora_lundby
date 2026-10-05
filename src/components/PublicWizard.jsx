import { useEffect, useMemo, useState } from 'react';
import api from '../utils/googleAppsScriptApi';
import { PublicLayout } from './Layout';
import { AVDELNINGAR } from '../utils/constants';

const steps = [1, 2, 3, 4, 5];

const SWEDISH_MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'
];

function formatActivityDate(isoDate) {
  if (!isoDate) return '';
  // Tolerates a full ISO datetime (e.g. if a value ever comes back as a
  // serialized Date instead of plain yyyy-MM-dd) by only looking at the
  // date portion before any "T".
  const [year, month, day] = String(isoDate).split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${SWEDISH_MONTHS[month - 1]}`;
}

function formatActivityWhen(activity) {
  const datePart = formatActivityDate(activity.date);
  const timePart = activity.startTime && activity.endTime ? `kl ${activity.startTime}-${activity.endTime}` : '';
  const locationPart = activity.location || '';
  return [datePart, timePart, locationPart].filter(Boolean).join(', ');
}

const emptyForm = {
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  scoutName: '',
  avdelning: '',
  selectedActivities: [],
  ownSuggestionText: '',
  comments: '',
  consent: false
};

export default function PublicWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(emptyForm);
  const [activities, setActivities] = useState([]);
  const [config, setConfig] = useState(null);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadingActivities(true);
        // Sequential, not Promise.all: Apps Script Web Apps don't reliably
        // handle several concurrent requests from the same client.
        const activityList = await api.getActivities();
        const publicConfig = await api.getConfig();
        if (cancelled) return;
        setActivities(activityList);
        setConfig(publicConfig);
        setLoadError('');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || 'Kunde inte hämta formuläret. Försök igen senare.');
        }
      } finally {
        if (!cancelled) setLoadingActivities(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // A gift pledge is a different kind of commitment from working a shift -
  // it gets its own step rather than being just another checkbox in the
  // same list as market passes and workdays.
  const workActivities = useMemo(
    () => activities.filter((activity) => activity.category !== 'standing-role' && activity.category !== 'gift'),
    [activities]
  );
  const giftActivities = useMemo(
    () => activities.filter((activity) => activity.category === 'gift'),
    [activities]
  );
  const standingRoleActivities = useMemo(
    () => activities.filter((activity) => activity.category === 'standing-role'),
    [activities]
  );

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleActivity = (activityId) => {
    setFormData((prev) => {
      const isSelected = prev.selectedActivities.includes(activityId);
      return {
        ...prev,
        selectedActivities: isSelected
          ? prev.selectedActivities.filter((id) => id !== activityId)
          : [...prev.selectedActivities, activityId]
      };
    });
  };

  const nextStep = () => {
    if (step < steps.length) {
      setStep((current) => current + 1);
      setError('');
    }
  };

  const previousStep = () => {
    if (step > 1) {
      setStep((current) => current - 1);
      setError('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.guardianName || !formData.guardianPhone || !formData.guardianEmail) {
      setError('Namn, telefon och e-post är obligatoriska.');
      return;
    }

    if (!formData.scoutName || !formData.avdelning) {
      setError('Scoutens namn och avdelning är obligatoriska.');
      return;
    }

    if (formData.selectedActivities.includes('own-suggestion') && !formData.ownSuggestionText.trim()) {
      setError('Beskriv ditt eget förslag innan du skickar in anmälan.');
      return;
    }

    if (!formData.consent) {
      setError('Du måste godkänna GDPR-samtycke för att skicka in anmälan.');
      return;
    }

    setLoading(true);

    try {
      const result = await api.submitApplication({
        year: config?.currentYear,
        term: config?.currentTerm,
        ...formData
      });
      setSubmitted({
        message: result.message || 'Din anmälan har mottagits.',
        guardianName: formData.guardianName,
        guardianEmail: formData.guardianEmail,
        scoutName: formData.scoutName,
        avdelning: formData.avdelning,
        ownSuggestionText: formData.ownSuggestionText,
        selectedActivities: result.selectedActivities || []
      });
      setFormData(emptyForm);
      setStep(1);
    } catch (err) {
      setError(err.message || 'Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingActivities) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-3xl text-center text-slate-600">Laddar formulär...</div>
      </PublicLayout>
    );
  }

  if (loadError) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
      </PublicLayout>
    );
  }

  if (submitted) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Tack, {submitted.guardianName}!</h2>
          <p className="mt-2 text-slate-600">{submitted.message}</p>

          <div className="card mt-6 text-left">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {submitted.scoutName} · {submitted.avdelning}
            </p>

            {submitted.selectedActivities.length === 0 ? (
              <p className="mt-3 text-slate-600">Du valde inga aktiviteter den här gången.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {submitted.selectedActivities.map((activity) => (
                  <li key={activity.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <span className="block font-medium text-slate-800">{activity.label}</span>
                    {formatActivityWhen(activity) && (
                      <span className="block text-slate-500">{formatActivityWhen(activity)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {submitted.ownSuggestionText && (
              <p className="mt-3 text-sm italic text-slate-600">Eget förslag: {submitted.ownSuggestionText}</p>
            )}

            <p className="mt-4 text-sm text-slate-500">
              En bekräftelse har skickats till {submitted.guardianEmail}. Vill du ändra något? Fyll i formuläret
              igen med samma e-postadress så uppdateras din anmälan istället för att skapa en ny.
            </p>
          </div>

          <button type="button" className="btn btn-primary mt-6" onClick={() => setSubmitted(null)}>
            Gör en ny anmälan
          </button>
        </div>
      </PublicLayout>
    );
  }

  const deadlinePassed = config?.submissionDeadline && new Date() > new Date(`${config.submissionDeadline}T23:59:59`);

  if (deadlinePassed) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-700">
          <h2 className="mb-2 text-xl font-bold text-slate-800">Anmälningstiden har gått ut</h2>
          <p>Sista anmälningsdag var {formatActivityDate(config.submissionDeadline)}. Kontakta en scoutledare om du ändå behöver anmäla dig.</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl">
        {config?.submissionDeadline && (
          <p className="mb-6 text-center text-sm font-semibold text-brand-600">
            Lämnas till scoutledare senast {formatActivityDate(config.submissionDeadline)}
          </p>
        )}

        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-2">
            {steps.map((item) => (
              <div
                key={item}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                  item <= step ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(step / steps.length) * 100}%` }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-800">Kryssa i vad du kan hjälpa till med</h2>
              <p className="text-sm text-slate-500">Marknadspass, förberedelser, arbetsdag och pysseldag.</p>
              <div className="space-y-2">
                {workActivities.map((activity) => (
                  <label key={activity.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                      checked={formData.selectedActivities.includes(activity.id)}
                      onChange={() => toggleActivity(activity.id)}
                    />
                    <span>
                      <span className="block font-medium text-slate-800">{formatActivityWhen(activity)}</span>
                      <span className="block text-slate-600">{activity.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-800">Gåva till lotteriet</h2>
              <p className="text-sm text-slate-500">
                Skänker du en vinst till lotteriet? Kryssa i vilken/vilka marknader och lämna in gåvan på angiven tid.
              </p>
              <div className="space-y-2">
                {giftActivities.map((activity) => (
                  <label key={activity.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                      checked={formData.selectedActivities.includes(activity.id)}
                      onChange={() => toggleActivity(activity.id)}
                    />
                    <span>
                      <span className="block font-medium text-slate-800">{formatActivityWhen(activity)}</span>
                      <span className="block text-slate-600">{activity.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-800">Jag kan ställa upp till följande</h2>
              <div className="space-y-2">
                {standingRoleActivities.map((activity) => (
                  <div key={activity.id} className="rounded-lg border border-slate-200 p-3">
                    <label className="flex items-start gap-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                        checked={formData.selectedActivities.includes(activity.id)}
                        onChange={() => toggleActivity(activity.id)}
                      />
                      <span>{activity.label}{activity.id === 'own-suggestion' ? ':' : ''}</span>
                    </label>
                    {activity.id === 'own-suggestion' && formData.selectedActivities.includes('own-suggestion') && (
                      <input
                        type="text"
                        value={formData.ownSuggestionText}
                        onChange={(e) => updateField('ownSuggestionText', e.target.value)}
                        className="input mt-2"
                        placeholder="Beskriv ditt förslag"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800">Kontaktuppgifter</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="guardianName">Namn</label>
                  <input id="guardianName" type="text" value={formData.guardianName} onChange={(e) => updateField('guardianName', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="guardianPhone">Telefon</label>
                  <input id="guardianPhone" type="tel" value={formData.guardianPhone} onChange={(e) => updateField('guardianPhone', e.target.value)} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="guardianEmail">E-post</label>
                  <input id="guardianEmail" type="email" value={formData.guardianEmail} onChange={(e) => updateField('guardianEmail', e.target.value)} className="input" />
                </div>
              </div>

              <h2 className="pt-2 text-2xl font-bold text-slate-800">Jag är förälder till följande scout</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="scoutName">Namn</label>
                  <input id="scoutName" type="text" value={formData.scoutName} onChange={(e) => updateField('scoutName', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="avdelning">Avdelning</label>
                  <select id="avdelning" value={formData.avdelning} onChange={(e) => updateField('avdelning', e.target.value)} className="input">
                    <option value="">Välj avdelning</option>
                    {AVDELNINGAR.map((avdelning) => (
                      <option key={avdelning} value={avdelning}>{avdelning}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="comments">Kommentar</label>
                <textarea
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => updateField('comments', e.target.value)}
                  className="input min-h-28"
                  placeholder="Skriv eventuella önskemål eller behov här..."
                />
              </div>

              <h2 className="pt-2 text-2xl font-bold text-slate-800">GDPR-samtycke</h2>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
                <p>{config?.consentText}</p>
              </div>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.consent}
                  onChange={(e) => updateField('consent', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                />
                <span>Jag godkänner GDPR-samtycke.</span>
              </label>
            </div>
          )}

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <div className="flex justify-between gap-4 pt-4">
            <button type="button" className="btn btn-secondary" disabled={step === 1} onClick={previousStep}>
              Tillbaka
            </button>

            {step < steps.length ? (
              <button type="button" className="btn btn-primary" onClick={nextStep}>
                Nästa
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Skickar...' : 'Skicka anmälan'}
              </button>
            )}
          </div>
        </form>
      </div>
    </PublicLayout>
  );
}
