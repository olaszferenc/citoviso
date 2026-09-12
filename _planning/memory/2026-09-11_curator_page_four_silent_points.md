# 2026-09-11 — A kurátor-lap négy néma pontja (Elek FK-003b) → ADR-0124

## Amit a tulaj bejelentett

Az FK-003b kör öt mért hibája a lead-lap kurátori felén: ① a nyitókép-választó csempéi
üresek/törött-kép ikonosak, egyedül a „reklámbanner" tölt be ② a percekig futó generálás néma
a lap tetején ③ ugyanaz a lap két különböző „mi maradt ki" listát ad ④ az előnézet egy MÁSIK
szállás mintája, „valós adattal" felirattal ⑤ két „approved" mock egy leaden.

## Amit MÉRTEM (és amit a mérés átírt)

- **A ① oka nem a pontozás volt, hanem a FORRÁS:** `curl`-lel mérve a hovamenjek.hu mind a
  négy fotó-URL-jére **404**-et ad, referer-rel és anélkül is. A banner (balaton.hu) 200.
  A felület viszont „nem ítélt"-et írt — az a VERDIKT hiánya, nem a betöltésé. Két különböző
  állítás, és pont a lényeg maradt ki: **ezek a képek a LEADNEK kiküldött lapon is törötten
  jelennek meg.**
- **A ⑤-nél a §I-védelem mércéje rossz volt:** mindkét duplikátum alatt ült egy prospect-sor,
  de EGYIK sem ment ki (`sent_at IS NULL`). A prospect-sor puszta létezését „megajánlott
  ajánlatnak" venni álbiztonság — a mérce a `sent_at` (ugyanaz, amit az `isArtifactDeletable`
  már használt).
- **Pixel-lelet, amit csak a böngésző mondott meg:** a bélyeg `type="submit"` gomb, ezért a
  `.con button[type=submit]` elsődleges-gomb szabálya (navy gradiens + pill-padding)
  felülírta a csempét: 107 px-es sötét keretben ült egy 77 px-es kép, a feliratok navy
  háttéren. Specificitás (0,4,1 > 0,1,0), nem ízlés. `:not(.hp-alt)` + `.con .hp-alt`.
- **A vázlat végigkattintása fogott egy CSS-csapdát:** `.con-runbar { display:flex }`
  felülírja a `[hidden]` `display:none`-ját → a „rejtett" sáv LÁTSZOTT. Ugyanaz az osztály,
  mint 2026-09-05-én. Képen nem látszik, csak kattintva.

## Amit építettem

- `src/console/photoProxy.ts` + `GET /photo?u=&s=` (HMAC-aláírt, operátor mögött) — a
  böngésző AZT tölti, amit a felület megmér; hiba esetén magyarázó helyettesítő kép.
  A proxy a saját nevünkben kér (`citoviso-bot`), nem böngészőnek álcázva.
- `GET /lead/:id/photo-health` — csempénkénti indok + összegző sor a kiküldött lapra nézve.
- Futás-sáv a fejléc alatt (jóváhagyott „A" változat), eltelt idővel; a pirula nem mond
  „approved"-ot futás közben; fül-pötty; a BUKÁS oka ugyanabban a sávban.
  `generating` Set→Map(start) + TTL + kimenet-tár.
- `views.missedAmenityGroups()` — egy forrás mindkét panelnek.
- `GET /lead/:id/tpl-preview` — a lead SAJÁT adata a kijelölt sablonon (AI nélkül);
  pillanatkép híján marad a minta-kép, de a felirat kimondja, hogy idegen.
- `curateArtifact` fölérendelés + `migrations/0064_one_approved_mock_per_lead.sql`.
- Őrök: `scripts/missed-list-check.mts` (a KIRENDERELT lapból mér; a hibát visszaállítva
  7 leadből 6 pirosra vált) és `scripts/one-approved-check.mts` — mindkettő negatív
  kontrollal, pre-commitban.

## Módosított / létrehozott fájlok

`src/console/photoProxy.ts` · `src/console/views.ts` · `src/console/server.ts` ·
`src/console/data.ts` · `src/generator/heroPick.ts` · `public/assets/ui/citui-console.css` ·
`migrations/0064_one_approved_mock_per_lead.sql` · `scripts/missed-list-check.mts` ·
`scripts/one-approved-check.mts` · `scripts/design-token-lint.mts` · `scripts/kb-check.mts` ·
`scripts/shot-lead.mts` · `hooks/pre-commit` · `elek/scenarios/FK-003b-lead-page-mock-generation.md` ·
`kb/entries/console-lead/entry.hu.md` · `assets/design-refs/console/gen-running/` ·
`_planning/DECISIONS.md` (ADR-0124)

## Nyitott

- A **hovamenjek.hu fotói élesben is 404-esek** — az ELEK-TESZT lead mockja tehát ma
  kép nélküli lapot szállítana. A választó ezt már KIMONDJA, de a javítás (újra-scrape,
  vagy a törött fotók kihagyása a generálásból) külön szál. ⚠️ Ez a hibaosztály nem csak
  a teszt-parkot érinti: érdemes megmérni, hány ÉLES lead mockja hivatkozik halott URL-re.
- A `photo-health` a lead-lap minden megnyitásakor lekéri a fotókat (cache-elve, 30/5 perc).
  Ha ez soknak bizonyul, a verdikt DB-be költöztethető (a `photo_hero_score` mintájára).
