-- 0119 SEARCH CONSOLE BEKÜLDÉS — minden élő szállásoldal sitemapje automatikusan a Google-höz (ADR-XXXX).
--
-- MIÉRT KELL. Mérve 2026-11-02 (élő sama-vendeghaz.citoviso.com, overseer.hu): az oldalak indexelhetők
-- (index,follow · canonical · LodgingBusiness JSON-LD · robots.txt + sitemap.xml), de a Google-nek semmi
-- nem jelzi, hogy léteznek. Tulaj-döntés 2026-11-02/03: mindkét címet beküldjük, a szállásadónak nincs dolga vele.
--
-- HÁROM TÁBLA, három kérdésre:
--   search_console_property — melyik Search Console tulajdont (sc-domain:…) ellenőriztük már, és mivel.
--   search_console_target   — oldalanként és címenként EGY sor: mit kell beküldeni, hol tart (állapotgép),
--                             mikor próbáljuk újra, és MELYIK sitemap-tartalmat küldtük be utoljára (hash) —
--                             ebből látszik a változás (új egység-aloldal → újraküldés).
--   search_console_event    — append-only napló: minden külső hívás (token, TXT, ellenőrzés, sites.add,
--                             sitemaps.submit, sitemap-letöltés), a válasz kódjával és szövegével.
-- A beküldés NEM az élesítés része: egy időzítő egyezteti az élő oldalakat ezzel a táblával, így a Google
-- hibája sosem buktathatja el a próba indulását, a vásárlást vagy a domain élesítését.

CREATE TABLE IF NOT EXISTS search_console_property (
  -- A Search Console tulajdon azonosítója, pl. 'sc-domain:citoviso.com' vagy 'sc-domain:overseer.hu'.
  property     text PRIMARY KEY,
  -- platform = a közös citoviso.com tulajdon (egyszeri beállítás, scripts/search-console-setup.mts);
  -- custom   = a szállás saját domainje (az időzítő ellenőrzi DNS TXT-vel, a zónát mi kezeljük).
  kind         text NOT NULL CHECK (kind IN ('platform', 'custom')),
  -- A Site Verification API tokenje (a TXT rekord tartalma) — újrapróbánál ugyanazt írjuk vissza.
  verify_token text,
  -- Mikor írtuk ki a TXT-t (a DNS terjedése után próbálunk ellenőrizni).
  txt_written_at timestamptz,
  verified_at  timestamptz,
  -- sites.add lefutott (a service account látja a tulajdont a Search Console-ban).
  added_at     timestamptz,
  last_error   text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_console_target (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES site(id) ON DELETE CASCADE,
  -- platform = <slug>.citoviso.com, custom = a saját domain.
  kind            text NOT NULL CHECK (kind IN ('platform', 'custom')),
  host            text NOT NULL,
  property        text NOT NULL,
  sitemap_url     text NOT NULL UNIQUE,
  -- pending   = beküldendő (új, vagy változott a sitemap, vagy hibázott és vár az újrapróbára)
  -- submitted = a legutóbbi sitemap-tartalom bent van
  -- retired   = a cím már nem a szállás oldalát adja (pl. a citoviso.com-os cím 301-gyel a saját domainre visz)
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'retired')),
  -- A legutóbb SIKERESEN beküldött sitemap <loc>-halmazának sha256-ja.
  submitted_hash  text,
  submitted_at    timestamptz,
  -- Egymás utáni sikertelen próbák száma (siker nullázza) — ebből jön a visszalépés és a riasztás.
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  -- Mikor néztük meg utoljára a sitemapet (a beküldött sorokat ritkábban nézzük újra).
  checked_at      timestamptz,
  last_error      text,
  alerted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, kind)
);

CREATE INDEX IF NOT EXISTS search_console_target_due_idx ON search_console_target (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS search_console_event (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  target_id   uuid REFERENCES search_console_target(id) ON DELETE SET NULL,
  property    text,
  -- sitemap_fetch | verify_token | dns_txt | verify | add_site | submit | retire
  action      text NOT NULL,
  ok          boolean NOT NULL,
  http_status integer,
  -- a válasz (rövidítve) vagy a hibaüzenet
  detail      text,
  -- false = dev/mock kliens (a Google-t nem hívtuk) — a naplóban így sosem keveredik a valódival
  live        boolean NOT NULL
);

CREATE INDEX IF NOT EXISTS search_console_event_target_idx ON search_console_event (target_id, at);
