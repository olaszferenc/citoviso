## ADR-0029 — Kurátor-eszközök a generálás előtt: sablon-előnézet (kattintásra nagyítható) + szerkeszthető lead-adat (hiányzó ÉS meglévő)

- **Tulaj-döntés (2026-08-08/09):** (1) amikor a kurátor sablont választ, jelenjen meg a típus
  minta-kinézete, kattintásra nagyítva; (2) a kurátor pótolhassa a hiányzó ÉS javíthassa a
  meglévő lead-adatot (elérhetőség, honlap, cím, név) a mock-generálás előtt.
- **Előnézet:** minden art-sablonhoz statikus minta-kép (`public/assets/ui/tpl-<id>.jpg` kártya +
  `tpl-<id>-full.jpg` lightbox), a VALÓS motor-kimenetből renderelve (Fortuna-adattal,
  `scripts/shot-previews.mts`) — a kurátor azt látja, amit a motor tényleg ad, nem absztrakt ikont.
  A lead-oldali select `onchange` cseréli a kártyát; kattintásra teljes-oldalas lightbox.
- **Adat-szerkesztés:** a lead kontakt/elérhetőség mezői a `raw` JSON-ban élnek (`loadLead` →
  `QualifiedLead`), így a `saveLeadEdits` (data.ts) oda ír — a scrapelt eredetit EGYSZER
  `raw.scrapedContact`-ba menti (audit), `raw.curatorEditedAt`-et bélyegez, a `name`/`address`
  oszlopot szinkronban tartja. A javított érték a KÖVETKEZŐ mock-generáláskor érvényesül
  (a motor a raw-ból dolgozik). Üres mező = törlés; részleges szerkesztés OK.
- **Jog/§A megjegyzés:** a kurátor általi kontakt-javítás legitim operátori művelet; az eredeti
  scrape-érték auditban megmarad. (Provenance-tábla source="curator" bejegyzés későbbi szelet.)
- **Visszafordíthatóság:** 🔄 könnyű — additív (raw-alkulcsok + statikus képek + form-mezők);
  a scrapelt payload többi része érintetlen, a régi leadek változatlanul renderelnek.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-09). Implementálva ebben a sessionben.
