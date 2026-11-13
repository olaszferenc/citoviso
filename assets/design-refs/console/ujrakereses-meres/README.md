# Riport · „Melyik kör?” váltó — az Újrakeresés külön mérése

**Jóváhagyva:** 2026-11-13, tulajdonosi döntés: „A) legyen”. A vázlat `plan.html` (A és B változat,
Mobil/Asztali váltóval egy fájlban; **az A köt**, a B-t elvetette). Képek: `terv-A-elso-{desktop,mobile}.png`
(Első megkeresés), `terv-A-ujra-{desktop,mobile}.png` (Újrakeresés). Az Első megkeresés számai a riport
11-13-i valós képéről valók; az Újrakeresés és a csatorna-csempék számai MINTA.

**Kiváltó (tulaj, 11-13):** „az újra megkeresést külön kell mérni az első kiküldéstől!!!!”, majd a Tölcsér
képére: „ide is kell egy váltó: újrakeresés vagy valami ilyesmi megnevezéssel, hogy a második kiküldés
adatai is látszódjanak”.

**Hatókör:** `src/console/reportData.ts` · `src/console/reportViews.ts` · `src/console/server.ts` ·
`src/console/openChannels.ts` · `src/console/openChannelsViews.ts` · `public/assets/ui/citui-console.css` ·
őr: `scripts/nonopener-followup-check.mts` (⑤ mérés-szál). A kör: ReportRound / loadProspectFacts(round), a címben kor=ujra.

## Mit KÖT ez a terv

1. **Újrakeresés** = a nem-nyitóknak 14 nap után kiment utánkövető levél (`nonopener_followup`, ADR-0442).
2. **Váltó a Riport Tölcsér lapján**, a szűrősor FÖLÖTT: „Melyik kör?” · `Első megkeresés N` · `Újrakeresés N`
   (N = a kör kiküldései az időszakban). Az Újrakeresés aktív állapota narancs, az Első megkeresésé sötétkék.
   Alatta egy sor: mit mér az adott kör. Telefonon a két gomb teljes szélességű. A választás a címben
   él: `/report?kor=ujra` (hiánya = Első megkeresés), és minden szűrő-link/űrlap továbbviszi.
3. **Első megkeresés:** a mostani számok, de az utánkövető levél kiküldése után történteket NEM számolja bele
   (megnyitás, próba, rendelés, fizetés, leiratkozás, válasz) — ugyanaz a vágás, mint a próba-kampánynál
   (`loadSecondTouch`); ha mindkettő volt, a korábbi vág. A „Honnan nyitották” panelben NINCS „Utánkövető
   levél” sor.
4. **Újrakeresés:** ugyanazok a kártyák és panelek, de a kohorsz = akiknek az időszakban az utánkövető levél
   KIMENT (a levél `sent_at`-ja szerint), és csak a levél UTÁNI események számítanak. A „Gyorsan reagál-e?”
   a levél küldésétől méri az 1. megnyitást. A meta-sor: „Újrakeresés · N utánkövető levél ment ki az
   időszakban · mind olyan leadnek, aki az első megkeresés linkjét 14 napig nem nyitotta meg”.
5. **Összevetés (A):** az Újrakeresés kártyáin a „… a tegnapihoz” helyén „az első körben: X” áll (ugyanarra
   az időszakra számolt első-köri érték). Az Első megkeresés kártyái változatlanok (nincs összevetés-sor).
6. **Honnan nyitották — Újrakeresés:** „Utánkövető levél” (a levél `?f` linkje) és a régi linkek a levél
   után, a csatornájuk szerint.
7. **Irányítópult „Megnyitás csatornánként”:** 5. csempe „Újrakeresés · 2. kör” (narancs), ugyanabban a
   formában: 7 napos arány nagyban, „N megnyitotta a M utánkövető levélből”, Ma · 7 nap · Összes. Kapta = az
   időszakban kiment utánkövető levél; Megnyitotta = utána bármelyik linkről nyitott (bot nem). Rákattintva
   `/report?days=7&kor=ujra`. Asztalon öt csempe egy sorban, telefonon 2 × 2 + az Újrakeresés teljes
   szélességben alul. A négy csatorna-csempe nem változik.
