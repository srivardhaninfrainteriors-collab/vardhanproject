export const statuses = [
  "new",
  "contacted",
  "qualified",
  "site visit",
  "proposal",
  "negotiation",
  "won",
  "lost",
];
const serviceNames = [
  "Luxury interior design",
  "Premium home interiors",
  "Residential construction",
  "Villas & independent homes",
  "Commercial interiors & construction",
  "Office & retail fit-outs",
  "Renovations & transformations",
  "Builder & developer partnerships",
];
const properties = [
  "Apartment",
  "Independent home",
  "Villa",
  "Plot",
  "Office",
  "Retail",
  "Development",
  "Other",
];
export const fields = {
  name: 100,
  phone: 20,
  service: 100,
  location: 150,
  property: 50,
  area: 20,
  budget: 100,
  timeline: 100,
  company: 150,
  message: 2000,
  page: 300,
  campaign: 50,
};
export function validateLead(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid inquiry.");
  if (input.website)
    throw Error("Unable to accept this inquiry. Please contact us directly.");
  if (input.consent !== true)
    throw Error("Please agree to be contacted about your inquiry.");
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId || ""))
    throw Error("Invalid inquiry reference. Please refresh and try again.");
  const data = {};
  for (const [key, max] of Object.entries(fields)) {
    if (input[key] !== undefined && typeof input[key] !== "string")
      throw Error(`Invalid ${key}.`);
    data[key] = (input[key] || "").trim();
    if (data[key].length > max) throw Error(`${key} is too long.`);
  }
  if (
    data.name.length < 2 ||
    !data.location ||
    !serviceNames.includes(data.service) ||
    !properties.includes(data.property)
  )
    throw Error(
      "Please complete your name, service, location and property type.",
    );
  const digits = data.phone.replace(/\D/g, "");
  if (
    digits.length < 10 ||
    digits.length > 15 ||
    !/^[+0-9 ()-]+$/.test(data.phone)
  )
    throw Error("Enter a valid phone number with 10–15 digits.");
  if (
    data.area &&
    (!/^\d+(\.\d+)?$/.test(data.area) ||
      Number(data.area) <= 0 ||
      Number(data.area) > 1e7)
  )
    throw Error("Enter a valid project area.");
  data.requestId = input.requestId;
  data.consent = true;
  data.analyticsConsent = input.analyticsConsent === true;
  data.marketingConsent = input.marketingConsent === true;
  data.attribution = {};
  if (data.analyticsConsent || data.marketingConsent)
    for (const k of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ])
      if (typeof input.attribution?.[k] === "string")
        data.attribution[k] = input.attribution[k].slice(0, 150);
  return data;
}
