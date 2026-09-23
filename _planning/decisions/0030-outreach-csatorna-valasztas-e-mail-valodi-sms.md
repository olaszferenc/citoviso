## ADR-0030 — Outreach csatorna-választás: e-mail (valódi) + SMS (placeholder, GSM-modul később)

- **Tulaj-döntés (2026-08-09):** a megkeresés kiküldésénél lehessen csatornát választani — e-mail
  VAGY SMS. Az SMS mögé később GSM-modul kerül; MOST placeholder.
- **Implementáció:** az outreach-piszkozat oldal (`/prospect/:id/draft`) „Küldési csatorna" blokkot
  kapott két kártyával: **E-mail** (a meglévő, valódi pipeline-küldés SMTP-n, §C-kapuval) és **SMS**
  (rövid, §C-hű szöveg: `renderSmsDraft` — személyre szabott + feladó + leiratkozó-link). Az SMS
  „Küldés" gomb (`POST /prospect/:id/send-sms`) EGYELŐRE PLACEHOLDER: csak `sent`-re jelöli a
  prospectet (H1-mérés indul), **valódi SMS nem megy ki**, a felület ezt explicit kiírja. Telefonszám
  nélkül a gomb tiltva (a szám a lead „Begyűjtött adatok" panelen szerkeszthető). §C-FLAG esetén
  egyik csatorna sem küldhető (a link/opt-out mindkettőn elérhető kell legyen).
- **A „Kiküldve — mérés indul" gomb** (meglévő) = KÉZI küldés jelölése: ha a kezelő saját
  postafiókból/telefonról küld, ezzel jelzi „elküldtem" → a H1-tölcsér (sent→opened→engaged→order)
  onnan méri; maga nem küld semmit.
- **Visszafordíthatóság:** 🔄 könnyű — additív (új route + nézet-blokk + SMS-drafter); az e-mail út
  változatlan. A GSM-transport bekötése egy későbbi szelet, a `send-sms` route mögé kerül.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-09). E-mail: éles. SMS: placeholder, GSM-modulra vár.
