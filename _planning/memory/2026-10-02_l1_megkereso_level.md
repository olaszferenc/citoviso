# L1 — a megkereső levél és SMS valódisága + saját-fotó nyomás kivezetése (2026-10-02)

SUB-szál (koordinátor: CIT „élesi teszt”, `~/wt/cit87d3f275`) · brief: `~/rc-briefs/javitas-elek-0930/l1-megkereso-level.md` ·
ADR-0305 (saját-fotó nyomás), ADR-0306 (levél) · kontraktus: `assets/design-refs/console/outreach-letter-l1/`.

## Elvégezve
- **Saját-fotó nyomás ki** (landolva `3e4eb7ac`): tenant-admin sáv/gomb/teendő, modul-leírás, mock-kérő levél, KB, nyitólap;
  őr `own-photo-pressure-check` (src + catalog + KB + README + public HTML). `src/legal.ts` (a nyilatkozat) érintetlen.
- **Levél (B)**: mérés-alapú szegmens-mondat (`siteCheckOf(lead.raw.assessment)`), 4,0 ★ küszöb, „Ezért” csak hiány után,
  csiszolás; emlékeztető-levél ugyanígy; SMS „csapata”. Őr `outreach-letter-truth-check` (300 ág, mutációval).
- **Szállásadó-szemű LLM-kritikus** sablon-változáskor (`scripts/outreach-letter-critic.mts --run`, ítélet:
  `src/outreach/letterCritic.verdict.json`). 1. kör FLAG → javítva → PASS.
- Nyitólap kártyacím: „Nyilvános adatokból”.

## Nyitott (a koordinátornak jelezve)
- A besoroló aggregátor-oldalt „saját modern oldalnak” vesz (élesen: bluepillow.com 361, freecancellations 42, vio 38 lead…)
  → ezek nem célpontok, pedig nincs saját oldaluk. Scraper-szál kell.
- A kritikus két javítandót hagyott az SMS-en (ADR-0112 tulaj-szöveg): „kötelezettségmentesen”, „A Citoviso csapata” →
  „Olasz Ferenc, Citoviso”. Tulaj-döntés, nem nyúltam hozzá.
- `src/email/orderEmail.ts` (rendelés utáni levél) is „élesítjük”-öt ír — nem megkereső levél, nem nyúltam hozzá.
