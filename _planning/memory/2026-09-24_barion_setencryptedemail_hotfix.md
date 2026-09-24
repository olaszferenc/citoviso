# 2026-09-24 — Barion -001: a setEncryptedEmail sosem sült el — hotfix élesítve (csak ez)

## A kiváltó

A Barion (Katalin, 2026-09-23 15:33) az -001-es észrevételben: *„hiába próbálok eljutni a
Pénztár email mezőjéhez… a setEncryptedEmail még nem jelent meg egyszer sem"*. Igaza volt,
és ez nekünk ciki, mert a 09-22-i javítást élesben senki nem próbálta végig a bíráló útján.

## Két hiba egymás mögött (mindkettő mérve)

1. **A bírálói linken nem volt pénztár.** `/p/demo5b0455b4067b` a demó-TENANT leadjéhez kötött →
   a 09-20-as „már vásárolt” ág (`ownedSiteForProspectToken`, lead-kulcsú) pénztár nélkül
   szolgálta ki. Éles log: „MÁR VÁSÁROLT lead … vásárlási réteg nélkül”.
2. **A cím beírása nem küldött semmit.** A change-figyelő `t.name === "buyer_email"`-re várt,
   a `bField()` mezőinek viszont nincs `name`-je (`data-f` a horog). A cím CSAK a Fizetek-ágon
   ment ki — a bíráló nem fizet, tehát 1. nélkül is néma maradt volna.
   Az őr (Z9) azért volt zöld, mert a `fill()` nem blurol: csak a Fizetek-ágat mérte.

## Javítás

- `cit-configurator.js`: a figyelő `data-f`-et néz.
- `barion-pixel-check`: **Z9/b** — a Fizetek ELŐTT (blur után) ki kell mennie. Régi kóddal
  mérve: Z9 zöld, Z9/b PIROS (a vakfolt pontosan ez); az önteszt nevesített pirost követel.
- `demo-prospect.mts`: külön, tenant nélküli bírálói lead, determinisztikus `review…` token;
  ⚠️ a SZERVER cwd-jéből kell futtatni (a mock-útvonal relatív), élesen `sudo -u citoviso`
  + `DATABASE_URL=postgres://localhost/citoviso?host=/var/run/postgresql`.

## Élesítés — CSAK a hotfix (tulaj: „ne vidd az egész maint”)

- `hotfix/pixel-email-20260924` = `dcb130b` + a javítás + `targets.json` → **`263ef8dd`**,
  tag **`prod/20260924-1004`**. A main-be `-s ours` merge-dzsel (tartalom-változás nélkül) került,
  hogy a GATE 1 (őse az origin/main-nek) teljesüljön. Visszagörgetés: `deploy-prod.sh dcb130b --go`.
- Két kapu nem tudott egy ADR-0220/GATE-6 előtti élesre épülő hotfixen futni:
  - **GATE 1c/kép** → új, KIMONDOTT kihagyás: `KB_SHOT_GATE_WAIVE="<indok ≥20 kar>"` (tulaj-döntés),
    hangosan kiírva + az éles `DEPLOYED`-naplóba írva. Nem alapértelmezés.
  - **GATE 6** → a hotfix `targets.json`-ja pontosan az élesen futó 4 időzítőt deklarálja
    (a renderelt egységek BÁJTRA egyeztek az élessel — mérve).
- Élesen mérve (Playwright, Fizetek NÉLKÜL): `https://citoviso.com/p/review5b0455b4067b` →
  Elfogadom → „Ez lehet az Öné” → fotó-jog pipa → számlázás → e-mail + Tab →
  `pixel.barion.com/a.gif` `{"event_method":"identity","event_name":"setEncryptedEmail",…}`
  (előtte grantConsent + 2× contentView ugyanígy).

## Nyitott

- A Barion-válasz (link + „előbb Elfogadom”) a tulajnál — beküldés az ő dolga.
- Az éles fa 80 commit mögött van a main-hez képest; a következő teljes élesítés a tulaj döntése.
- A demó-TENANT linkje (`/p/demo…`) szándékosan vásárlás nélküli marad; a bírálat után mindkét
  demó-lead + a teszt-rendelés kitakarítandó a prodból.
