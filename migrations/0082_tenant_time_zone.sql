-- A SZÁLLÁS IDŐZÓNÁJA (ADR-0290; terv: assets/design-refs/tenant-admin/szallas-idozona/, tulaj 2026-09-30:
-- „minden szállás a saját időzónájában él").
--
-- MIÉRT KELL. A foglalási és árazási „ma" ~20 helyen UTC-napként számolt (00:00–02:00 Budapest között a
-- tegnapot adta), a tulaj és a vevő felé mutatott idők pedig a platform zónáját (Budapest) követték. Egy
-- nem-magyar szállásnál (Bécs, Lisszabon, Kanári-szigetek) mindkettő rossz: a „ma", a lejáratok és a
-- vendégnek mutatott időpontok a SZÁLLÁS órája szerint értelmesek.
--
-- IANA zóna-név (pl. 'Europe/Budapest', 'Atlantic/Canary'). Az érvényességet az alkalmazás ellenőrzi
-- (Intl), mielőtt ír. Minden meglévő tenant Europe/Budapest (mind magyar); az új tenant a szállás
-- országának alapértékét kapja (src/text/zoneTime.ts COUNTRY_DEFAULT_TIME_ZONE).
ALTER TABLE tenant ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Europe/Budapest';

DO $$ BEGIN
  ALTER TABLE tenant ADD CONSTRAINT tenant_time_zone_nonempty CHECK (time_zone <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN tenant.time_zone IS
  'A szallas IANA idozonaja (pl. Europe/Budapest): ennek oraja szerint szamol a foglalasi/arazasi "ma", a lejaratok es a tulajnak/vendegnek mutatott idopontok.';
