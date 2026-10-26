const settings = {
  ga: import.meta.env.VITE_GA4_ID,
  gtm: import.meta.env.VITE_GTM_ID,
  pixel: import.meta.env.VITE_META_PIXEL_ID,
  ads: import.meta.env.VITE_GOOGLE_ADS_ID,
  conversion: import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL,
};
let started = false;
export function consent() {
  try {
    return JSON.parse(localStorage.getItem("sv-consent")) || null;
  } catch {
    return null;
  }
}
const script = (src) => {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.append(s);
};
export function saveConsent(value) {
  try {
    localStorage.setItem("sv-consent", JSON.stringify(value));
  } catch {}
  if (!value.analytics && !value.marketing) {
    try {
      sessionStorage.removeItem("sv-attribution");
    } catch {}
  }
  if (started) window.location.reload();
  else initAnalytics();
}
export function initAnalytics() {
  const c = consent();
  if (started || !c || (!c.analytics && !c.marketing)) return;
  started = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("consent", "default", {
    analytics_storage: c.analytics ? "granted" : "denied",
    ad_storage: c.marketing ? "granted" : "denied",
    ad_user_data: c.marketing ? "granted" : "denied",
    ad_personalization: "denied",
  });
  if (settings.gtm) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    script(`https://www.googletagmanager.com/gtm.js?id=${settings.gtm}`);
  } else if ((c.analytics && settings.ga) || (c.marketing && settings.ads)) {
    script(
      `https://www.googletagmanager.com/gtag/js?id=${c.analytics && settings.ga ? settings.ga : settings.ads}`,
    );
    window.gtag("js", new Date());
    if (c.analytics && settings.ga) window.gtag("config", settings.ga);
    if (c.marketing && settings.ads) window.gtag("config", settings.ads);
  }
  if (c.marketing && settings.pixel) {
    const f = function () {
      f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments);
    };
    f.queue = [];
    f.loaded = true;
    f.version = "2.0";
    window.fbq = f;
    window._fbq = f;
    script("https://connect.facebook.net/en_US/fbevents.js");
    f("init", settings.pixel);
    f("track", "PageView");
  }
  attribution();
  track("landing_page_view", { page: window.location.pathname });
}
export function track(event, params = {}) {
  const c = consent();
  if (!c?.analytics && !c?.marketing) return;
  const safe = { page: window.location.pathname, ...params };
  if (settings.gtm) window.dataLayer?.push({ event, ...safe });
  else if (c.analytics) window.gtag?.("event", event, safe);
  if (event === "generate_lead" && c.marketing) {
    window.fbq?.("track", "Lead", {}, { eventID: params.event_id });
    if (!settings.gtm && settings.ads && settings.conversion)
      window.gtag?.("event", "conversion", {
        send_to: `${settings.ads}/${settings.conversion}`,
        transaction_id: params.event_id,
      });
  }
}
export function attribution() {
  if (!consent()?.analytics && !consent()?.marketing) return {};
  let result = {};
  try {
    result = JSON.parse(sessionStorage.getItem("sv-attribution")) || {};
  } catch {}
  const q = new URLSearchParams(window.location.search);
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ];
  if (keys.some((k) => q.has(k))) {
    result = {};
    for (const k of keys) if (q.has(k)) result[k] = q.get(k).slice(0, 150);
    try {
      sessionStorage.setItem("sv-attribution", JSON.stringify(result));
    } catch {}
  }
  return result;
}
