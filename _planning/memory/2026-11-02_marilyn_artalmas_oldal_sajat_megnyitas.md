# 2026-11-02 — Marilyn Vendégház: „ártalmas oldal”, e-mail, saját megnyitás a tervváltón

Session: `cit7deb79af` (brief `~/rc-briefs/megnyithat-s-g-20261102-125409.md`).

## Mi történt
- A kehidakustányi Marilyn Vendégház tulaja (lead `56650b07-8b97-476d-bbcf-1599701c554e`, MMS+SMS 11-02 09:37 UTC)
  felhívta a tulajt: kipróbálná a 14 napos próbát, de a link „ártalmas oldal” figyelmeztetést ad.
- **Diagnózis (mérve):** Google Safe Browsing tiszta (`citoviso.com`, `marilyn-vendeghaz.citoviso.com`, `admin.`);
  a lead 11:03–11:14 UTC között Android Chrome-on gond nélkül nézte; utána egyetlen kérése sem ért a szerverig →
  a tiltás a telefonon/hálózaton (szolgáltatói netvédelem / víruskereső / SMS-app / Chrome csalás-szűrő). Pontos okhoz
  a lead képernyőképe kell. Domain 2026-08-02-i, cégnév-aldomain = „friss phishing” minta.
- **A tulaj telefonszáma** (+36 30 516 1631) a `LEGAL_ENTITY_PHONE` → `/impresszum`, `/aszf`, rendelési levelek; az SMS/MMS nem.
- **E-mail:** a tulaj jóváhagyott személyes levele kiment `olasz.ferenc@citoviso.com`-ról `marilynvendeghaz@gmail.com`-ra
  (Zoho SMTP, bcc a tulajnak). A cím a DB-ben nincs rögzítve.
- **Saját megnyitás szivárgott:** a `?sajat=1` a tervváltó linkjein elveszett → a tulaj két kattintása lead-látogatásnak
  számított. Javítva (`planHref(…, ownView)`), őr a `plan-switcher-check.mts`-ben; a 2 hamis `mock_view` + 40 esemény
  élesen törölve (mentés `/opt/citoviso/backups/marilyn-own-views-20261102-141023/`).
- **free-trial-e2e piros volt minden fán** (a tiszta mainen is): a teszt 14×24 órát várt, a termék (`trialUntilFrom`)
  naptári napot ad; a 10-25-i óraátállítás óta eltér. A teszt igazítva, a termék változatlan.
- **Új tulaj-koordinátor szál:** „CIT ➕ Portál-jutalék kiváltása + láthatóság” (`~/wt/cit0dae95bf`,
  brief `~/rc-briefs/portal-jutalek-kivaltas-lathatosag-20261102.md`); a SUB-jelet leszedtem.

## Módosított fájlok
- `src/console/planSwitcher.ts`, `src/console/server.ts` — own-view jel a tervváltón
- `scripts/plan-switcher-check.mts` — 3 új ellenőrzés
- `scripts/free-trial-e2e.mts` — naptári-napos próbavég
- `MEMORY.md` — Tények és döntések

## Nyitott
- A javítás ÉLESEN NINCS (következő deploy).
- Ha a lead e-mailből sem tudja megnyitni: kell a figyelmeztetés képernyőképe; utána dönthető, kell-e a cégnév-aldomain helyett fő-domaines link.
- A konzol a látogatás-időket UTC-ben mutatja (a tulaj magyar időt vár) — nem javítva.
