// A lead's country as SQL (table alias `l` = lead): its own raw.country, else its scrape area's —
// src/country.ts countryOf, as one expression. Shared by every query that reads the lead's country
// row (the launch status, the dispatch photo gate, the „Kiküldés” tab's count).
import { sql } from "kysely";

export const LEAD_COUNTRY_SQL = sql<string>`upper(coalesce(nullif(trim(l.raw->>'country'),''),
  (select sd.country from scrape_run sr join scraper_definition sd on sd.id = sr.scraper_definition_id where sr.id = l.scrape_run_id)))`;
