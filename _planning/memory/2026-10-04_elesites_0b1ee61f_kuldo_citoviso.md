# Élesítés 0b1ee61f + éles feladó „Citoviso” (koordinátor, 2026-10-03/04)

## Elvégezve
- **Deploy `0b1ee61f`** (`prod/20261003-1912`), tulaj-engedéllyel erre a SHA-ra; előtte száraz futás zöld, a cél közben nem változott.
  Előző éles: `6179595c` (visszagörgetés: `bash scripts/deploy-prod.sh 6179595cffe64cff27583635cfe673d9617654e5 --go`).
  Benne: ADR-0312 · 0313 · 0315 (Elek K3), „Kapunyitás” sablon (ADR-0311), Google-értékelés ≥0,7 + összevont hely (ADR-0317), Adatok fül mindent-vagy-semmit + autofill ki (ADR-0316).
  Migráció nem volt; GATE 5 en-fordítás 13 string + 1 KB-entry frissült; console 303 / public 200, hibanapló üres.
- **Éles `.env` (külön tulaj-engedéllyel):** `OUTREACH_FROM=Citoviso <olasz.ferenc@citoviso.com>`, `OUTREACH_SENDER_NAME=Citoviso`,
  `OUTREACH_SENDER_COMPANY=citoviso.com`. Mentés: `/opt/citoviso/app/.env.bak-sender-20261003-175918`. A `LEGAL_ENTITY_*` lábléc nem változott. Console → public restart, mindkettő active.

## Módosított fájlok
- Repóban: csak ez a jegyzet + `MEMORY.md`. Élesen: `/opt/citoviso/app/.env` (3 sor).

## Nyitott kérdések / következő lépések
- **Elek-visszamérés (javasolt, rövid):** a K3-javítások élesen még nincsenek mérve (plus-alcím = egy címzett, Citoviso feladó, kültéri MINTA blokk).
  Új teszt-lead kell VALÓDI második e-mail-címmel — a tulajtól kérdezve, még nincs válasz.
- **Tulaj emberi köre** a `[TESZT] Lovász apartman`-on (e-mail `olaszferenc@gmail.com`; telefon ha kell `+36 30 516 1631`, soha a modem-SIM).
  Fizetéshez `offer` sor: `kind=campaign, percent=98, scope=initial, expires now()+24h` (kosárhoz `scope=purchase` a tenantra) — élesi DB-írás, külön engedély.
- **A teszt végén:** `MOBILE_SEND_WINDOW_OFF` ki az éles `.env`-ből (+ restart); a `teszt-muschel-panzio` (és a Lovász) előfizetés lemondása
  (`revokeAutoCharge` + `cancelSubscription`, `src/payment/subscription.ts`), engedéllyel.
