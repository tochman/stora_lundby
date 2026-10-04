import { useState } from 'react';
import { PublicLayout } from './Layout';

const steps = [1, 2, 3, 4, 5];

const engagementOptions = [
  { value: 'need-help', label: 'Jag behöver hjälp' },
  { value: 'volunteer', label: 'Jag vill hjälpa till' },
  { value: 'organizer', label: 'Jag vill vara ansvarig' }
];

const supportAreas = [
  'Marknad',
  'Scout / aktivitet',
  'Logistik',
  'Mat och fika',
  'Kommunikation',
  'Administration',
  'Annan'
];

export default function PublicWizard() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    year: '2026',
    term: 'Höst',
    engagementType: '',
    supportArea: '',
    name: '',
    phone: '',
    email: '',
    childName: '',
    childClass: '',
    comments: '',
    consent: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (step < 5) {
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
    setSuccess('');

    if (!formData.name || !formData.phone || !formData.email) {
      setError('Namn, telefon och e-post är obligatoriska.');
      return;
    }

    if (!formData.consent) {
      setError('Du måste godkänna GDPR-samtycke för att skicka in anmälan.');
      return;
    }

    setLoading(true);

    try {
      // Replace with google.script.run in production.
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSuccess('Din anmälan har mottagits.');
      setFormData({
        year: '2026',
        term: 'Höst',
        engagementType: '',
        supportArea: '',
        name: '',
        phone: '',
        email: '',
        childName: '',
        childClass: '',
        comments: '',
        consent: false
      });
      setStep(1);
    } catch (err) {
      setError('Något gick fel. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl">
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
            <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800">1. Välj år och termin</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="year">År</label>
                  <select id="year" value={formData.year} onChange={(e) => updateField('year', e.target.value)} className="input">
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="term">Termin</label>
                  <select id="term" value={formData.term} onChange={(e) => updateField('term', e.target.value)} className="input">
                    <option value="Höst">Höst</option>
                    <option value="Vår">Vår</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800">2. Vilken typ av engagemang?</h2>
              <div>
                <label className="label" htmlFor="engagementType">Jag vill</label>
                <select
                  id="engagementType"
                  value={formData.engagementType}
                  onChange={(e) => updateField('engagementType', e.target.value)}
                  className="input"
                >
                  <option value="">Välj</option>
                  {engagementOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="supportArea">Typ av stöd</label>
                <select
                  id="supportArea"
                  value={formData.supportArea}
                  onChange={(e) => updateField('supportArea', e.target.value)}
                  className="input"
                >
                  <option value="">Välj (valfritt)</option>
                  {supportAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800">3. Kontaktuppgifter</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="name">Namn</label>
                  <input id="name" type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Telefon</label>
                  <input id="phone" type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="email">E-post</label>
                  <input id="email" type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="childName">Barnets namn</label>
                  <input id="childName" type="text" value={formData.childName} onChange={(e) => updateField('childName', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="childClass">Klass / årskurs</label>
                  <input id="childClass" type="text" value={formData.childClass} onChange={(e) => updateField('childClass', e.target.value)} className="input" />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800">4. Övrig information</h2>
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
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800">5. GDPR-samtycke</h2>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
                <p>Jag godkänner att Stora Lundby sparar mina uppgifter för att administrera min anmälan och kontakta mig i samband med verksamheten.</p>
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
          {success && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div>}

          <div className="flex justify-between gap-4 pt-4">
            <button type="button" className="btn btn-secondary" disabled={step === 1} onClick={previousStep}>
              Tillbaka
            </button>

            {step < 5 ? (
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
