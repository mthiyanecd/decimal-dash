// Public runtime configuration for the static Study Dash site.
// These values are shipped to every browser; never put passwords, private keys,
// service-account JSON, provider credentials, or App Check debug tokens here.
(() => {
  const existing = window.StudyDashConfig || {};
  window.StudyDashConfig = Object.assign({
    familyId: "zimmy",
    aiModel: "gemini-3.6-flash",
    appCheckSiteKey: "6Lde8GstAAAAAMtTa3za8xyY7v9AgllDC0VNF5nH",
    appCheckDebug: false,
    parentEmails: ["mthiyanecd@gmail.com"]
  }, existing);
})();
