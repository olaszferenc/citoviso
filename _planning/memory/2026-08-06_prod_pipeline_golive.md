# 2026-08-06 — ADR-0025 ①② impl + kurátori kapu + prod pipeline-infra élesítés

## Kontextus
Deliberáció (ADR-0025) után a tulaj: „mindenképp a minőséget javítsuk". Leimplementáltuk a sorrend 1. körét
(①restraint + ②fókusz), majd a tulaj pivotolt: **valós tenant-feedback nélkül tippelgetünk** → előbb a
blokkolókat, aztán a normál folyamaton át kis valós kör, MINDEN mock előtt kurátori jóváhagyás.

## Styling ①② (commit `4ecc426`)
- `RecipeSection.emphasis?: focal|normal|quiet` (recipe.ts) + megosztott `isSampleOnly()`.
- **① restraint** (planner.ts): `enforce()` nem húz be kényszer-mintát; `applyRestraint` max 1 minta-modul
  (rooms>reviews>faq); valós modul érintetlen; a fallback is enforce-on át.
- **② fókusz** (planner.ts `guaranteeEmphasis`): pontosan egy focal (a legerősebb valós adu, default gallery),
  minta-modul kényszer-quiet, hero/enquiry sose focal.
- **render.ts**: `data-cit-emphasis` attribútum a szekció-rootra; `EMPHASIS_CSS` (primitives.ts) az archetípus-CSS
  UTÁN emittálva (nyer) — space+scale, nincs full-bleed breakout → nem töri a split-archetípusokat.
- **generateEngine.ts**: a `rooms` withCopy-ág spread-del megőrzi az emphasist.
- Verifikáció: `scripts/verify-emphasis.ts` (determinisztikus, fallback-út): hideg lead 1 quiet minta + focal
  gallery, gazdag lead mind valós; render 1 focal attr; tsc tiszta; designCheck pass. Screenshot desktop+mobil OK.
- ⑤ (fotó-paletta) MÁR main-en volt (párhuzamos session `0dc0f57`, `engine/palette.ts`) — a roadmap „nincs" elavult.

## Kurátori kapu (commit `ec04714`)
- `sendBatch.ts`: küldés CSAK ha a prospect mock_artifactja `mock_artifact.status='approved'` (curateArtifact-tal,
  ember). `sendOutreachMail` korai kapu + `listSendableProspects` inner-join `approved`. Artifact nélküli /
  'generated' / 'rejected' → sose megy ki. A mechanizmus (curate-gomb, curator_decision) már megvolt; a rés a
  küldés-oldali követelmény hiánya volt.

## Blokkoló-döntések (tulaj)
- B1 kurátori kapu: kész (fent).
- B2 valós árak: **tulaj állítja a /pricing-en** + `pricingConfirmed=true`. A kaput round-trip-teszttel igazoltuk
  (mentés→confirmed felenged→false visszazár, eredeti visszaállítva).
- B3 pipeline-hely: **egységes prod** (a normál scrape→mock→kuráció→approve→send prodon fut, egy DB).
- Fontos felismerés: a követett `/p/:token` link a PROD publikus szervert hívja → a prospect/artifact soroknak a
  prod DB-ben kell lenniük (a küldés Zoho-relayen megy, a küldő gép IP-je nem számít a kézbesíthetőséghez).

## Prod-infra (B3 1–5, deploy-doktrína, current-turn tulaj-go) — mind verifikált
1. **Deploy**: rsync `git ls-files` a jelenlegi main-re (`root@178.104.3.223:/opt/citoviso/app`,
   `--chown=citoviso:citoviso`), ~40 fájl; nem érint .env/node_modules/sites. Service-ek aktívak.
2. Anthropic-kulcs: már kint volt.
3. **Chromium**: apt `chromium` (`/usr/bin/chromium`, 151.x) + `CHROMIUM_PATH` a prod .env-ben; playwright-core
   launch smoke OK.
4. **0016 pricing-migráció** alkalmazva (`npx tsx src/db/migrate.ts` citoviso userként) → 16 migráció.
5. **`admin.citoviso.com`** konzol: nginx külön server_name blokk (`/etc/nginx/sites-enabled/citoviso-admin`)
   → `127.0.0.1:4600` (specifikus név elveszi a `*.citoviso.com` wildcardtól); DNS-változás NEM kellett (wildcard
   + CF-TLS fedi). Operátor-user **`olaszferenc`** (`scripts/operator-user.ts` GENERÁL jelszót → helyette egyszeri
   inline upsert a tulaj választott jelszavával, hashPassword scrypt; jelszó NEM tárolt). Login e2e verifikált
   (`cit_op_session`, „Vezérlőpult").

## Hátra (6. lépés = a kis valós kör)
- Tulaj: valós árak a /pricing-en (admin.citoviso.com).
- Scrape prodon (egy régió, kis cap) → mock (új motor) → kuráció admin-felületen (approve) → kis batch küldés
  (per-batch KÜLÖN tulaj-go a hideg küldéshez; §C + kurátori + suppression kapuk a csőben).
- Nyitott: dev↔prod DB — az egységes-prod döntéssel a leadek prodon keletkeznek (a régi dev-leadek nem kellenek).

## Módosított/létrehozott fájlok (ebben a blokkban)
- `src/engine/recipe.ts`, `primitives.ts`, `render.ts`, `planner.ts`; `src/generator/generateEngine.ts`;
  `src/outreach/sendBatch.ts`; `scripts/verify-emphasis.ts` (új).
- Commitok: `d5515b7` (docs ADR-0025), `4ecc426` (engine ①②), `ec04714` (outreach kurátori kapu).
- Prod: kód-deploy, chromium, .env `CHROMIUM_PATH`, 0016 migráció, nginx `citoviso-admin`, `operator_user` olaszferenc.

## A-Z teszt-küldés + levél-formátum döntés (2026-08-06 este)
- **Végigment a valós küldés prodon** (Zoho SMTP → Gmail): scrape→mock→approve→§C→SMTP. A §C-kapu 3 valós
  hiányt fogott el kiküldés előtt: (C2) `OUTREACH_SENDER_*` feladó-identitás, (C4) `pricingConfirmed`, és a
  **/p/ link-hoszt hiba** (a link `citoviso.com/p/`-ra mutatott, de a `/p/` csak a konzolon élt → 404).
- **/p/ link-fix (nginx, NEM kód):** `citoviso.com` server-blokk `location /p/ { proxy_pass :4600 }` — a
  `/p/` handlerek auth-mentesek a konzolon; a `/p/`-oldal önálló (konfigurátor+runtime INLINE-olva), ezért a
  proxy elég. `citoviso.com/p/<token>` → 200.
- **Feladó személyesítve:** prod `.env` `OUTREACH_FROM="Olasz Ferenc <olasz.ferenc@citoviso.com>"` +
  `OUTREACH_SENDER_EMAIL=olasz.ferenc@citoviso.com` (az `info@` szerepcím helyett).
- **⭐ LEVÉL-FORMÁTUM DÖNTÉS (tulaj, 2026-08-06):** a levél **KÉPES lesz mindenképp** (a mock nyitóképe inline).
  Kiderült: a Gmail a levelet **Frissítések** fülre teszi (NEM spam — a kézbesítés jó, auth OK); a fül a
  TARTALOM (kép + `List-Unsubscribe`) miatt van, nem a feladó/Zoho miatt. Kép nélkül IS Frissítésekben maradt →
  **nem a kép a bűnös.** A tulaj a képet választotta (A út): elfogadjuk a Frissítések fület, javítja a
  **domain-bemelegítés** + később egy **hideg-email-eszköz** (Instantly/Smartlead/Postmark) UGYANAZON a
  domainen. A Zoho nem hiba: a saját-domainről-jogszerűen-inboxba küldést oldja meg (+ fogadás/login-levelek).
- **Levél-átírás (commit):** `outreachEmail.ts` — személyes 1:1 stílus (nincs brand-kártya/gomb), a mock
  **inline képként** + **szöveg-link** (nem gomb); `draft.ts` személyes tárgy („<Név> – készítettem Önöknek egy
  honlap-tervet"). `List-Unsubscribe` fejléc BENT marad (megfelelés).
- **Nyitott a valós küldéshez:** valós árak (/pricing) + a tulaj VALÓS e.v.-megnevezése (most placeholder
  „Olasz Ferenc e.v.") + telefon. A tesztben placeholder 3900 Ft, küldés után `pricingConfirmed=false` visszazárva.
