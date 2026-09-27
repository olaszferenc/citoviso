# 2026-09-27 — Üzenetek fül: foglalási döntés-linkek (C terv) + https-séma javítás

**Kiváltó:** a tulaj dev-en a foglalási kérés üzenetében két nyers URL-t látott („Nem lehetne ezt
ikonként?”), és mindkettő `ERR_SSL_PROTOCOL_ERROR`-ral halt.

## Elvégezve
1. **Séma-hiba** (`src/server/public.ts` `publicBaseUrl`): proxy-fejléc nélkül minden nem-localhost
   hostra `https`-t tippelt, a szerver pedig sima HTTP → a dev-gép Tailscale IP-jén a publikus porton
   halott linkek. Most a socket saját sémája; élesen az nginx mindig küld `X-Forwarded-Proto`-t (olvasva
   ellenőrizve) → ott nincs változás. A MÁR tárolt dev-üzenetekben a régi `https://` link marad.
2. **„Mi lett az eredeti tervvel?”** — a tulaj-levél jóváhagyott „Tulaj B” terve (`design-refs/console/
   booking-email/`, ADR-0244) a HTML-levélre készült; az Üzenetek fül a levél SZÖVEGES részét tárolja,
   ezért ott csak nyers (majd `linkifyText`-tel kattintható) URL állt. Nem veszett el semmi, sosem jutott át.
3. **C terv az Üzenetek fülön** (§2b: A/B/C vázlat, tulaj a C-t választotta; kontraktus
   `assets/design-refs/console/mail-links/`): `messageBodyHtml()` (`src/server/adminViews.ts`) — a
   `/foglalas/<token>/elfogadom|elutasitom|ajanlat` sorok kiemelve; „Foglalások megnyitása” gomb +
   „Gyors döntés innen is:” ikonos linkek; az azonnal döntő link `<details>` megerősítő dobozt nyit
   (JS nélkül; natív `confirm()` tiltott). A tulaj kipróbálta: működik.
4. **Idegen kapu javítva a tulaj engedélyével** — `photo-normalize-check` a tiszta mainen is piros volt:
   a vak első `tenant_user` sor egy-egységes tenant volt, a konvertáló pedig csak a >1 egységes
   szoba-rácsban él (ADR-0198). Most célzottan >1 egységes tenantot választ.
5. **Tanulság:** a munkamenet elején a tulajnak nem mondtam el, mi lett az általa felidézett tervvel —
   ő kérdezett rá. Ha a tulaj „ezt már megcsináltuk”-ot mond, az ELSŐ válasz a megtalált előzmény
   (commit, terv, mi hová jutott), csak utána a folytatás.

## Módosított fájlok
`src/server/public.ts` · `src/server/adminViews.ts` · `public/assets/ui/citui-admin.css` ·
`src/i18n/catalog.json` · `scripts/photo-normalize-check.mts` ·
`assets/design-refs/console/mail-links/{README.md,mail-links.html}`

## Nyitott
- A `photo-normalize-check` még mindig a KÖZÖS DB-ből választ (célzottan, de nem saját fixture) —
  az ADR-0249 elve szerint a végleges megoldás saját fixture a gazda szálnál.
- Nincs élesítve (csak a nagy deployjal).
