// Central configuration. Reads from process.env; no external deps.
// Keep this the single source of env access so the rest of the code stays pure.

// Load .env into process.env for local dev (Node built-in, no dotenv package).
// In prod (managed cloud) there is no .env and real env vars are already set —
// hence the guard. This is the single place env is loaded, before any read.
try {
  (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.();
} catch {
  // no .env file present — rely on the ambient environment
}

function env(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

/**
 * Every Impresszum field the law names (Eker.tv. 4. §) is present. Read directly
 * from env rather than from `config.legalEntity` so this can back the derived
 * `termsUrl` getter without the object referring to itself mid-construction.
 */
export function isLegalEntityComplete(): boolean {
  return LEGAL_ENTITY_KEYS.every((k) => env(k) !== "");
}

/** The env keys that must all be filled for the legal pages to be publishable. */
export const LEGAL_ENTITY_KEYS = [
  "LEGAL_ENTITY_NAME",
  "LEGAL_ENTITY_ADDRESS",
  "LEGAL_ENTITY_REG_NUMBER",
  "LEGAL_ENTITY_TAX_NUMBER",
  "LEGAL_ENTITY_EMAIL",
] as const;

export const config = {
  /** Chromium binary used by Playwright for scraping + screenshotting. */
  chromiumPath: env(
    "CHROMIUM_PATH",
    "/home/mineral/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome",
  ),
  /**
   * PostgreSQL connection string. When set (prod/managed cloud) it wins over the
   * per-field `pg` defaults below. Empty locally → the embedded dev cluster is used.
   */
  databaseUrl: env("DATABASE_URL"),
  /** Local dev Postgres defaults (embedded cluster on a unix socket). */
  pg: {
    host: env("PGHOST", "/tmp"),
    port: Number(env("PGPORT", "5433")),
    user: env("PGUSER", "postgres"),
    password: env("PGPASSWORD"),
    database: env("PGDATABASE", "citoviso_dev"),
  },
  /** Outreach email transport (planned). */
  smtpUrl: env("SMTP_URL"),
  outreachFrom: env("OUTREACH_FROM"),
  /**
   * Email delivery adapter (ADR-0022): 'mock' writes messages to outbox/ for local
   * end-to-end testing; 'smtp' sends for real (needs SMTP_URL + a sending domain,
   * a tulaj-external prerequisite). Defaults to 'mock' until creds exist.
   */
  emailProvider: env("EMAIL_PROVIDER", "mock"),
  /** HMAC secret for signed tenant session cookies (ADR-0023). Override in prod. */
  sessionSecret: env("SESSION_SECRET", "cit-dev-session-secret-change-me"),
  /**
   * Public base URL for prospect-facing links (/p/<token>) in outreach drafts.
   * Until public hosting exists this stays empty → the draft gate FLAGs it, so
   * a draft with an unreachable link can never pass as sendable (§C).
   */
  publicBaseUrl: env("PUBLIC_BASE_URL"),
  /**
   * Origin of the PUBLIC website + intake server (homepage, /m/<token> previews).
   * Distinct from publicBaseUrl (the console's /p/ outreach links) while dev runs
   * two ports; in prod both collapse to the one public origin.
   */
  publicSiteUrl: env("PUBLIC_SITE_URL", "http://100.97.188.105:4800"),
  /**
   * Origin of the INTERNAL operator console (cross-link from the public login).
   * Empty → derived from the request host with the console port (dev default).
   */
  consoleUrl: env("CONSOLE_URL"),
  /**
   * Public URL of the ÁSZF (terms of service). The document EXISTS (ADR-0056,
   * served at /aszf on both servers), so this always resolves and the checkout
   * always renders the acceptance row.
   *
   * It was briefly gated on `isLegalEntityComplete()` so a half-filled ÁSZF
   * could not be accepted — but that coupling was wrong twice over: it made the
   * end-to-end (scrape→invoice) run untestable locally, and it was redundant,
   * because the thing it protected against (shipping a hollow document to real
   * buyers) is already refused by deploy-prod.sh GATE 1b, which reads the LIVE
   * .env. Runtime readiness and deploy readiness are separate concerns; only the
   * latter belongs in a gate. An explicit TERMS_URL still wins (e.g. a
   * lawyer-hosted PDF).
   */
  get termsUrl(): string {
    return env("TERMS_URL") || "/aszf";
  },
  /** Identifiable outreach sender (§C.2): real person + entity + reply contact. */
  outreachSender: {
    name: env("OUTREACH_SENDER_NAME"),
    company: env("OUTREACH_SENDER_COMPANY"),
    email: env("OUTREACH_SENDER_EMAIL"),
    phone: env("OUTREACH_SENDER_PHONE"),
  },
  /**
   * Our own identity as a service provider — the Impresszum (Eker.tv. 4. §) and
   * the data-controller block of every legal page (ADR-0056).
   *
   * NEVER hardcoded in the repo: these are real registry facts about a real
   * business, and §B.17 (no fabricated hard facts) binds us about OURSELVES too
   * — an invented tax number on a public page is worse than a visible gap.
   * Unfilled fields render as `[KITÖLTENDŐ: …]` and `scripts/legal-check.mts`
   * blocks the deploy while any of them is empty.
   */
  legalEntity: {
    /** Legal name of the sole trader / company (NOT the Citoviso brand name). */
    name: env("LEGAL_ENTITY_NAME"),
    /** Registered seat, one line: irányítószám, település, utca házszám. */
    address: env("LEGAL_ENTITY_ADDRESS"),
    /** Sole-trader registry number (egyéni vállalkozói nyilvántartási szám). */
    regNumber: env("LEGAL_ENTITY_REG_NUMBER"),
    /** Hungarian tax number (adószám), e.g. 12345678-1-42. */
    taxNumber: env("LEGAL_ENTITY_TAX_NUMBER"),
    /** Contact address for legal notices + data-subject requests. */
    email: env("LEGAL_ENTITY_EMAIL"),
    phone: env("LEGAL_ENTITY_PHONE"),
  },
  googleMapsApiKey: env("GOOGLE_MAPS_API_KEY"),
  /** Programmable Search Engine (CSE) id for the Custom Search JSON API. */
  googleCseId: env("GOOGLE_CSE_ID"),
  /** Brave Search API key — the PRIMARY web-search backend (ADR-0026; the Google
   *  CSE "entire web" mode is being sunset 2027-01-01). */
  braveApiKey: env("BRAVE_API_KEY"),
  /** Anthropic API key for AI copy generation (the SDK also reads this from env). */
  anthropicApiKey: env("ANTHROPIC_API_KEY"),
} as const;

export type Config = typeof config;
