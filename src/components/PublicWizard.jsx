const mockData = {
  applications: [
    {
      id: 'demo-1',
      createdAt: new Date().toISOString(),
      year: '2026',
      term: 'Höst',
      engagementType: 'need-help',
      supportArea: 'Marknad',
      name: 'Anna Andersson',
      phone: '070-1234567',
      email: 'anna@example.com',
      childName: 'Lina',
      childClass: '4A',
      comments: 'Behöver hjälp med marknadsföring.',
      status: 'Ny',
      consentGiven: 'TRUE',
      consentAt: new Date().toISOString(),
      consentVersion: 'v1'
    },
    {
      id: 'demo-2',
      createdAt: new Date().toISOString(),
      year: '2026',
      term: 'Höst',
      engagementType: 'volunteer',
      supportArea: 'Scout / aktivitet',
      name: 'Lars Svensson',
      phone: '073-7654321',
      email: 'lars@example.com',
      childName: '',
      childClass: '',
      comments: 'Vill hjälpa till med aktiviteter.',
      status: 'Behandlas',
      consentGiven: 'TRUE',
      consentAt: new Date().toISOString(),
      consentVersion: 'v1'
    }
  ],
  consentLog: [
    {
      applicationId: 'demo-1',
      personName: 'Anna Andersson',
      email: 'anna@example.com',
      consentGivenAt: new Date().toISOString(),
      consentVersion: 'v1',
      consentText: 'Jag godkänner att Stora Lundby sparar mina uppgifter.',
      source: 'public-form'
    }
  ],
  config: {
    currentYear: '2026',
    currentTerm: 'Höst',
    consentVersion: 'v1',
    consentText: 'Jag godkänner att Stora Lundby sparar mina uppgifter för att hantera anmälan och kontakta mig i samband med verksamheten.'
  }
};

function callGoogleAppsScript(functionName, ...args) {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler((result) => resolve(result))
        .withFailureHandler((error) => reject(error))
        [functionName](...args);
      return;
    }

    const fallbackMap = {
      submitApplication: async (payload) => {
        const result = { ok: true, message: 'Demomod: anmälan har sparats.' };
        return result;
      },
      getApplications: async () => mockData.applications,
      getAdminDashboard: async () => ({
        summary: {
          total: mockData.applications.length,
          newCount: mockData.applications.filter((item) => item.status === 'Ny').length,
          volunteerCount: mockData.applications.filter((item) => item.engagementType === 'volunteer').length,
          helpCount: mockData.applications.filter((item) => item.engagementType === 'need-help').length
        },
        rows: mockData.applications
      }),
      getConsentLog: async () => mockData.consentLog,
      getConfig: async () => mockData.config,
      updateApplicationStatus: async () => ({ ok: true }),
      createManualApplication: async () => ({ ok: true }),
      addAdmin: async () => ({ ok: true }),
      getAdmins: async () => [{ email: 'admin@example.com', role: 'admin', active: 'TRUE' }]
    };

    const fallbackFn = fallbackMap[functionName];
    if (fallbackFn) {
      fallbackFn(...args)
        .then(resolve)
        .catch(reject);
      return;
    }

    reject(new Error('Google Apps Script function not available in this environment.'));
  });
}

export const api = {
  submitApplication: (payload) => callGoogleAppsScript('submitApplication', payload),
  getApplications: () => callGoogleAppsScript('getApplications'),
  getAdminDashboard: () => callGoogleAppsScript('getAdminDashboard'),
  updateApplicationStatus: (id, status) => callGoogleAppsScript('updateApplicationStatus', id, status),
  createManualApplication: (payload) => callGoogleAppsScript('createManualApplication', payload),
  getConsentLog: () => callGoogleAppsScript('getConsentLog'),
  getConfig: () => callGoogleAppsScript('getConfig'),
  updateConfig: (key, value) => callGoogleAppsScript('updateConfig', key, value),
  addAdmin: (email) => callGoogleAppsScript('addAdmin', email),
  getAdmins: () => callGoogleAppsScript('getAdmins')
};

export default api;
