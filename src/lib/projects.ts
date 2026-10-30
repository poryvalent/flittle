/**
 * Placeholder portfolio. Flittle has no case studies yet, so every entry here
 * is a clearly marked sample. The cover art is generated from the record (see
 * covers.ts), so replacing a project means editing one line here and, once a
 * real screenshot exists, pointing `image` at it. Twenty-one entries fill the
 * photo sphere evenly; the single `tall` one is the portrait card.
 */
export type CoverKind = "browser" | "site" | "dash" | "flow" | "phone";
export type Field = "lilac" | "mint" | "sun" | "charcoal" | "paper" | "lavender";

export type Project = {
  id: string;
  title: string;
  kind: string;
  note: string;
  cover: CoverKind;
  field: Field;
  /** Portrait card on the sphere, like a phone screen. One per archive. */
  tall?: boolean;
  /** Real artwork (3:2, or 4:5 for the tall card). Replaces the generated cover when set. */
  image?: string;
};

const NOTE =
  "Sample project. Replace this with a real case study: the problem the client had, what Flittle built, and what changed for them.";

const p = (id: string, title: string, kind: string, cover: CoverKind, field: Field, tall = false): Project => ({
  id, title, kind, cover, field, note: NOTE, ...(tall ? { tall } : {}),
});

export const PROJECTS: Project[] = [
  p("01", "Online ordering", "Web app · Retail", "browser", "lilac"),
  p("02", "Booking portal", "Web app · Services", "browser", "mint"),
  p("03", "Company website", "Website · Professional services", "site", "paper"),
  p("04", "Inventory dashboard", "Internal tool · Wholesale", "dash", "charcoal"),
  p("05", "Member app", "Web app · Community", "browser", "sun"),
  p("06", "Quote builder", "Internal tool · Trades", "dash", "lavender"),
  p("07", "Customer portal", "Web app · Logistics", "browser", "mint"),
  p("08", "Booking site", "Website · Hospitality", "site", "lilac"),
  p("09", "Reporting tool", "Internal tool · Finance", "dash", "paper"),
  p("10", "Learning platform", "Web app · Education", "browser", "charcoal"),
  p("11", "Shop integration", "Integration · E-commerce", "flow", "sun"),
  p("12", "Team scheduler", "Internal tool · Healthcare", "dash", "lilac"),
  p("13", "Patient intake", "Web app · Healthcare", "browser", "paper"),
  p("14", "Fleet tracker", "Internal tool · Logistics", "dash", "mint"),
  p("15", "Donor CRM", "Internal tool · Non-profit", "dash", "lavender"),
  p("16", "Ordering kiosk", "Web app · Hospitality", "browser", "charcoal"),
  p("17", "Tenant portal", "Web app · Property", "browser", "lilac"),
  p("18", "Event ticketing", "Website · Events", "site", "sun"),
  p("19", "Payments integration", "Integration · Finance", "flow", "mint"),
  p("20", "Field service app", "Mobile app · Trades", "phone", "paper", true),
  p("21", "Analytics console", "Internal tool · SaaS", "dash", "charcoal"),
];
