## ADR-XXXX — A platform-levelek közös kerete: E4 logó, „Citoviso” feladó, cégadatos lábléc (2026-09-24)

- **Kiváltó (tulaj, 2026-09-24):** a belépési és a számla-levelet Gmailben nézve: *„ezek nem túl profi
  vállalat benyomását keltik…”*.
- **Mi volt a baj (mérve a kódban):** 12 platform-levél (belépés, számla, 7 díj/felszólító, 3 domain)
  mind a saját, csupasz héját másolta: nem volt bennük logó, a feladó „Olasz Ferenc” volt (a
  rendszerlevél így magánlevélnek hatott), és nem volt lábléc cégnévvel, székhellyel, adószámmal
  (egy számlát küldő levélnél ez adathalászatnak hat). A belépési levél nem szólította meg a címzettet,
  nem nevezte meg az oldalt, és kétszer mondta a „jegyezze fel” mondatot; a számla HTML-jéből hiányzott
  a megszólítás, ami a szöveges változatban megvolt.
- **Döntés:** egy közös keret, `src/email/platformLayout.ts`, amin mind a 12 levél megy. A jóváhagyott
  terv (§2b, A változat): `assets/design-refs/console/platform-email/` (README = kontraktus).
  ① Fejléc: a „szem”itoviso logó (E4 jel a „C” helyén), **CID-inline PNG**-ként.
  ② Feladó neve: **„Citoviso”**, a cím a hitelesített postafiók marad.
  ③ Lábléc a `config.legalEntity`-ből; csak a kitöltött mező jelenik meg.
  ④ Megszólítás: magánszemélynek névvel, cégnek vagy ismeretlen olvasónak „Kedves Partnerünk!”.
- **Elvetve:** B (nyugta-stílus, sötét fejléc-sáv) és C (belépés + számla egy üdvözlő levélben —
  a könyvelőnek továbbított számlával a jelszó is menne). Hosztolt logó-URL: az éles deploytól és a
  Gmail-képproxy elérhetőségétől függene (a dev gép nem érhető el); SVG: a Gmail nem mutatja.
- **Hatókörön kívül:** a forgalmi és a programajánló levél (saját, jóváhagyott keret), valamint az
  outreach (szándékosan személyes hangú).
- **Visszafordíthatóság:** 🔄 olcsó (egy modul).
- **Státusz:** lokálban kész, valódi SMTP-próba a tulaj Gmailjébe átment (2026-09-24). Nincs élesítve.
