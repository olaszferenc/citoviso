// Central configuration. Reads from process.env; no external deps.
// Keep this the single source of env access so the rest of the code stays pure.

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
  googleMapsApiKey: env("GOOGLE_MAPS_API_KEY"),
  /** Programmable Search Engine (CSE) id for the Custom Search JSON API. */
  googleCseId: env("GOOGLE_CSE_ID"),
  /** Anthropic API key for AI copy generation (the SDK also reads this from env). */
  anthropicApiKey: env("ANTHROPIC_API_KEY"),
} as const;

export type Config = typeof config;
