# A fizetés-visszaigazoló lap — JÓVÁHAGYOTT TERV („D — prémium sötét / split", 2026-09-20)

`plan.html` — a tulaj által választott terv. Ez **KONTRAKTUS**, nem stílus-javaslat: az alábbi
pontok a megvalósítás elvárt VISELKEDÉSÉT kötik. A kész felületet ehhez a képhez mérjük.

## Miért született

A tulaj a `/pay/done` sikeres lapját nézve ezt mondta: *„nem bizalomgerjesztő, mert nagyon gagyin,
nem profin néz ki"*. Mérve (2026-09-20, a lap `src/console/views.ts` `payResultPage` sikeres ága):

- a siker **le volt írva, de nem volt megmutatva** — egyetlen zöld szövegsor, semmi vizuális csúcspont;
- **dokumentum-ritmus**: h2 → bekezdés → bekezdés → doboz → h3 → natív `<ul>` pöttyök, inline `style=`-okkal;
- **nyers URL** a lap közepén, csupasz kék szövegként (a vevő nem látta, MIT vett, csak egy linket);
- **nulla bizalmi jel** egy fizetés után: se tranzakció-azonosító a fejlécben, se „biztonságos fizetés",
  se lábléc — a lap „elfogyott", nem lezárult.

Négy terv készült (`A` nyugta · `B` pecsét+oldal-kártya · `C` onboarding-lépcső · `D` split);
a tulaj a **D**-t választotta.

## Amit a terv KÖT

1. **Sötét, márkás lap — nem a konzol világos shellje.** A fizetés-visszaigazoló a VEVŐ lapja:
   navy gradiens + cián/kék aurora, a márka-sor a lapon belül. ⛔ A tervet nem szabad a meglévő
   konzol-vázba erőltetni (ez korábban három külön tervet olvasztott eggyé).
2. **Kéthasábos asztalon, egymás alatt mobilon.** Balra a MEGVETT DOLOG (pecsét, állítás, előnézet,
   cím), jobbra a PAPÍRMUNKA (összeg, előfizetés, belépés, CTA). 1024 px alatt egy oszlop, a bal
   hasáb tartalma előre. A két méret két külön tervezői döntés — nem ugyanaz kétszer lelőve.
3. **A siker LÁTSZIK:** cián pecsét rajzolódó pipával. `prefers-reduced-motion` esetén animáció nélkül,
   de a pecsét akkor is ott van.
4. **A vevő LÁTJA, amit vett:** böngésző-keretes előnézet az oldaláról, „ÉL" jelvénnyel, a keret
   címsorában a valódi címmel. Az előnézet forrása **kétszintű tartalékkal** (tulajdonosi döntés,
   2026-09-20):
   - ① valódi képernyőkép az ÉLES oldalról (aktiváláskor előre legyártva, cache-elve),
   - ② ha az nincs kész: a lap nyitóképe (hero-fotó) + cím-overlay,
   - ③ ha az sincs: márka-gradiens + cím.
   ⛔ Soha nem üres, soha nem várakoztatja a vevőt, és soha nem állít olyat, ami nem igaz
   (törött kép helyett a következő szint jön).
5. **A cím OBJEKTUM, nem csupasz link:** kiírt cím + „Cím másolása" (valódi vágólap, a gomb
   visszajelez) + „Megnyitom ↗". Hosszú címnél sem törhet szét az elrendezés.
6. **Az összeg a jobb kártya fejlécében áll**, fölötte a „Sikeres fizetés" pill, alatta egy sor,
   ami megmondja, MI volt megvéve (tétel-név; ha nem tudjuk, nem találjuk ki).
7. **A mai tartalmi kontraktus HIÁNYTALANUL megmarad** (`subscriptionBox`, checkout-fullscreen ⑪):
   következő terhelés (dátum + összeg, vagy a mai „e-mailben küldjük" mondat, ha nincs
   előfizetés-sor) · megújulás · ÁFA · számla · lemondás módja; továbbá felhasználónév · belépés
   (abszolút URL vagy a „e-mailben küldjük" mondat) · mit szerkeszthet · hivatkozási azonosító
   másolhatóan · support-cím (üres config → a felajánlás elmarad, nem kitalált cím).
8. **Egy domináns CTA** („Belépek és szerkesztem"), a másodlagos utak halkabbak. Link-alakú gomb
   is GOMB — a konzol `.con a` link-szabálya nem színezheti át (mért 1,16-os kontraszt-eset).
9. **Minden szín/betű/radius a `--citui-*` dizájn-magból** (ADR-0021 ①); nyers hex tilos.
   Minden vevő-oldali felirat `T(lang, …)` burkolással (§B.18).

## Amit a terv NEM köt

- Az elutasított fizetés lapja (`!paid`): annak saját jóváhagyott terve van
  (`../pay-gateway-exit/`), ez a kontraktus nem írja felül.
- A „fizetés megvolt, de az oldal még készül" állapot (`!activated`) ugyanezt a KERETET viseli,
  de a bal hasábban nincs előnézet/cím — ott az állapot áll, és a kötelezettség-sorok (7. pont)
  ott is járnak.

## Hogyan ellenőrizd

`plan.html` önhordó: a tetején „Mobil 390px / Asztali" váltó (`@container`, nem `@media`),
a másolás-gombok és a linkek élnek. A megvalósítást a
`npx tsx scripts/ui-shot.mts /pay/done?...` két képéhez és ehhez a tervhez kell mérni.
