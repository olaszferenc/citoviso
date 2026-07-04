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
  /** PostgreSQL connection string (planned). Empty until the DB layer lands. */
  databaseUrl: env("DATABASE_URL"),
  /** Outreach email transport (planned). */
  smtpUrl: env("SMTP_URL"),
  outreachFrom: env("OUTREACH_FROM"),
  googleMapsApiKey: env("GOOGLE_MAPS_API_KEY"),
} as const;

export type Config = typeof config;
