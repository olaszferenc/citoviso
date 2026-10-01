# 2026-10-01 — Elek V-1: a levél-link megnyitása (GET) nem dönt

**Szál:** SUB a CIT „élesi teszt” koordinátor alatt; brief `~/rc-briefs/javitas-elek-0930/v1-get-dontes.md`. Döntés: ADR-0291.

## Lelet (élesen mérve, Elek)
A tulaj foglalás-értesítőjének `GET /foglalas/<t>/elfogadom|elutasitom` linkje megnyitáskor döntött; egy levelező
link-ellenőrzője (Safe Links, Gmail-előtöltés, vírusirtó) kattintás nélkül visszaigazolhatott/elutasíthatott.

## Mit találtam még (az összes levél-link GET-je)
| Link (kinek) | GET régen | Most |
|---|---|---|
| `/foglalas/<t>/elfogadom\|elutasitom` (tulaj) | **DÖNTÖTT** | megerősítő lap, POST dönt |
| `/velemeny/<t>/kiteszem\|nem-teszem-ki` (tulaj) | **DÖNTÖTT** (kitette a véleményt) | megerősítő lap, POST dönt |
| `/foglalas/<t>/ajanlat` (tulaj) | csak mutat | változatlan |
| `/foglalas/<t>/lemondom` (vendég) | megerősítő lap | változatlan |
| `/ajanlat/<t>` (vendég) | csak mutat; `/elfogadom\|nem-kerem` GET = 404 | változatlan |
| `/p/<t>/unsubscribe` (lead) | 2026-09-26 óta megerősítő lap | változatlan (a memória elavult volt, javítva) |
| `/p/<t>` (lead, hideg levél) | mock_view-t ír + n-edik látogatásnál eszkalációs ajánlatot veret | **kivétel, jelentve** |
| `/pay/go/<id>` (vevő) | lejárt ablaknál ÚJ fizetést indít + házriasztás | **kivétel, jelentve** |
| `/pay/done`, `/admin…`, `/login` | állapot-szinkron / belépés kell | nem döntés |

## Elvégezve
- `peekDecision` (requests.ts), `peekReviewDecision` (reviews.ts) — csak olvasnak.
- `bookingDecideConfirmPage`, `reviewDecideConfirmPage` (moduleConfigViews.ts) — a vendég-lemondó minta, EGY gomb, POST
  ugyanarra az URL-re. Az ár nélküli „Elfogadom” GET-re és POST-ra is az ajánlat-lapra visz (változatlan).
- public.ts: GET → megerősítő; új POST-ágak (`decideRequest` / `decideReview` + újraépítés kitételkor).
- Őr: `scripts/mail-link-get-safe-check.mts` + pre-commit trigger. Régi kódon PIROS (3 GET-mutáció, 3× POST 405), utána zöld.
  A `guest-link-host-check`, `booking-offer-check`, `consent-style-check` zöld.
- KB: admin-bookings, admin-modules-booking, admin-modules-reviews — a megerősítő lépés leírva.

## Második kör (koordinátor/tulaj-döntés, 2026-10-01) — a két kivétel is javítva
- `GET /pay/go/<id>`: lejárt ablaknál „A fizetési link lejárt” lap + „Tovább a fizetéshez” gomb; új fizetés és
  házriasztás csak a POST-ra (`resolvePayEntry(id, { reissue })`). Landolva: ed952b6a.
- `GET /p/<t>`: a GET nem ír semmit; a lap `POST /p/<t>/view`-t küld az első görgetés/kerék/érintés/egér/billentyű
  jelére vagy 5 mp látható fül után (tulaj: „B”). Ez rögzíti a megnyitást és veri az eszkalációs ajánlatot; a kártya
  és a kedvezményes ár a válasz után jelenik meg. Élesen mérve előtte: egy `curl` lekérés is látogatásnak számított.
- Őr: `mail-link-get-safe-check` ⑤ (/pay/go) és ⑥ (/p, a küszöbnél többször megnyitva) — mindkettő a régi kódon PIROS.
  Valódi böngészőben (Playwright) ellenőrizve: interakció nélkül 2,5 mp → 0 megnyitás; görgetés → 1, a sorban álló
  scroll-esemény hozzá kerül; 5 mp látható fül → rögzül; a küszöb-látogatáson a kártya megjelenik (mobil+asztal); JS-hiba 0.
- Súgó: console-outreach-draft „Mi számít megnyitásnak?”. ADR-0291 6–7. pont.

## Nyitott
- Nincs. (A /p-nél tudatos: aki 5 mp-en belül, érintés nélkül zár, nem számít megnyitásnak.)
