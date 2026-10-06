# 2026-10-05 — Lead-fülek „ki szerkesztette utoljára” (megvalósítás, A változat)

Szál: `cit40455c24` (rc-handoff az előd tervező sessionből). Kontraktus: `assets/design-refs/console/lead-lastedit/`.

## Elvégezve
- **Migráció 0089 `lead_activity`** (`lead_id`→lead cascade, `tab` CHECK a 7 író fülre, `action` gépi kulcs,
  `actor_kind` operator|owner|system, `operator_id`→operator_user set null, `actor_label` név-pillanatkép,
  `subject_id`, `at`; index `(lead_id, tab, at desc)`). Dev DB-n lefutott. Visszamenőleges sor NINCS (§B.17).
- `src/console/leadActivity.ts`: `logLeadActivity` (soha nem dob), `operatorActor`, `decidedByOf`, `getLeadActivity`
  (fülenként a legfrissebb + mockonként a létrehozó; a napló kezdete = a 0089 `schema_migrations.applied_at`).
- Bekötve a konzol író végpontjaiba: generate / generate-curated (a szerző a KÉRÉSKOR, naplózás a kész artefaktum-id-vel),
  data, reenrich, rescrape-photos, curate (approve/reject), recopy, kézi copy, delete, places-photos, hero,
  disqualify/requalify, prospect create/sent/archive/unarchive/resubscribe/contact-email/send-sms/send-all/send-pair/
  send-pair-sms/send, timezone, convert, invoice-retry, request-payment. A szállás tulaja: `recordOrderIntent` (`data.ts`).
- `curator_decision.decided_by` = az operátor `username` (a fölérendelt régi jóváhagyásé is); a nézet a „console”-t
  „nem rögzített”-nek, a `buyer_order`-t „a szállás tulaja”-nak mutatja.
- Nézet: minden fül kétsoros (`.con-ltab__name` + `.con-ltab__who`, monogram `.con-av[data-k]`), nincs adat → „—”;
  mock-kártyán `.con-mk__by` „Létrehozta: …” (napló előtti mock / napló utáni, de nem rögzített megkülönböztetve).
- Ellenőrizve: tsc, i18n-lint, design-token-lint, console-contrast, contract-drift zöld; ui-shot 1280 + 390 a Rozé
  Fogadón ideiglenes mintasorokkal (utána törölve).

## Nyitott
- 2026-10-06 zárás: a súgó (KB) bejegyzés a két új sorhoz hiányzik, `tudasbazis-or` nem futott (tulaj: így zárunk).
- A szkriptből/ütemezőből (nem konzolból) készült mock nem naplóz → „Létrehozta: nem rögzített”. Ha kell: a motor szintjén
  `system` szereplővel.
- A „Döntés” időbélyege (`exactOf`) UTC-szelet, a fül második sora budapesti idő — régi eltérés, nem ebben a szálban.
- Élesítés: csak a nagy deployjal (a 0089-es migrációval együtt).
