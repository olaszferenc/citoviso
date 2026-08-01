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
  /** Identifiable outreach sender (§C.2): real person + entity + reply contact. */
  outreachSender: {
    name: env("OUTREACH_SENDER_NAME"),
    company: env("OUTREACH_SENDER_COMPANY"),
    email: env("OUTREACH_SENDER_EMAIL"),
    phone: env("OUTREACH_SENDER_PHONE"),
  },
  googleMapsApiKey: env("GOOGLE_MAPS_API_KEY"),
  /** Programmable Search Engine (CSE) id for the Custom Search JSON API. */
  googleCseId: env("GOOGLE_CSE_ID"),
  /** Anthropic API key for AI copy generation (the SDK also reads this from env). */
  anthropicApiKey: env("ANTHROPIC_API_KEY"),
} as const;

export type Config = typeof config;
