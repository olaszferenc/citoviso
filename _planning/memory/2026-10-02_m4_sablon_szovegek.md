# M4 — sablon-szövegek, vélemény-csillagsor, arch-frames cím, lake-balaton UA, tegező alak-szabály (2026-10-02)

SUB-szál (koordinátor: CIT „élesi teszt”, `~/wt/cit87d3f275`) · brief: `~/rc-briefs/javitas-elek-0930/m4-sablon-szovegek.md` ·
ADR-XXXX (sablon szövege) · kontraktus: `assets/design-refs/tenant-site/sablon-szovegek/`.

## Elvégezve
- **Vélemény-kártya csillagsor** (brutalism, organic, watercolor, dopamine, claymorphism): kártyáról le, fejlécben egyszer
  (brutalism: pontszám-bélyeg). **arch-frames** vélemény-cím = a reviews copy. Az editorial ugyanígy hibás → M3 javítja;
  a `template-copy-check` KNOWN-kivételként viszi, a fel nem használt kivétel bukás (az M3 landja veszi ki).
- **19 sablon-szöveg csere + 2b kör** (tulaj: „mind igen”): 63 forrás-csere 16 fájlban; halott CSS/változók törölve;
  katalógus frissítve (36 régi string ki, „Amit még kínálunk” be).
- **lake-balaton UA** (`a907502e`, fent): a portál a `HeadlessChrome` UA-ra 429-et ad; siteShot/qaAiriness/Elek-futó
  bot-UA-val; őr `shot-user-agent-check`.
- **Tegező alak-szabály** (`b6f3ed0a`, fent): `addressRegister.ts`; 42 tegező / 45 csapda / katalógus-ellenpróba /
  10 mutáns; őr `address-register-check`.

## Mérések
- Vendég-kritikus a mai kódon (tárolt mockok, új generálás nélkül): az „Amit itt kapsz” felcímet a régi lint is elkapta
  (Laguna, Villa Suzy, Boróka, Artemisz; a Muschel élesen ugyanez); a rés a ragozott alakokon volt.
- `template-copy-check` a javítás előtti forráson: 265 lelet → utána 0.

## Tanulság
- ⛔ A `land.sh` törli a `_drafts/`-ot (ADR-0077) — a döntési képek ÉS a patch-mentés vele veszett. Land előtt
  mindig FÁN KÍVÜLI mentés (`~/rc-briefs/reports/`).

## Nyitott
- Kompozíciós ág (`primitives.ts`): „Vendégkönyv / Levelek a vendégkönyvből”, római számozás — nincs jóváhagyva.
- A gépi szöveg (AI copy) „Amit itt kapsz” — a kritikus lintje most elkapja; régi mockok újragenerálásig hordják.
