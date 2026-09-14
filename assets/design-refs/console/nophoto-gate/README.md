# A KÉP NÉLKÜLI mock kiküldés-kapuja — jóváhagyott terv („B" változat, 2026-09-14)

Tulajdonosi jóváhagyás: 2026-09-14 — a **B változat (két lépés)**, és az indoklás
**kötelező**; miután két változatot látott mobil és asztali képen, kattintható HTML-lel
(`plan.html`: a mezők élnek, a gomb csak 10+ karakteres indoklásnál enged, méret-váltó
`@container`-rel). Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem
stílus-javaslat. Referencia: `plan.html`, `A-B-mobil.png`, `A-B-asztali.png` — ⚠️ a
képeken **mindkét** változat szerepel, a jóváhagyott a **B** (asztalin a JOBB, mobilon
az ALSÓ).

**Hatókör:** `src/console/views.ts` · `src/outreach/mockPhotoHealth.ts`

## Miért van

⛔⛔ **Mért rés (Elek FK-004b GY-1, 2026-09-14, a kódból megerősítve):** a kiküldés-kapu
verdiktje `broken.length ? "broken" : "ok"` volt — vagyis **a nulla fotós lap „ok"-ot kapott**,
és a kapu átengedte. Ez az ADR-0134 (törött képes mock nem küldhető ki) **szándékának**
kijátszása: a leadhez kép nélküli oldal megy ki, zöld kapuval.

⚠️ **És a kockázat NŐTT:** az ADR-0136 óta a generálás eldobja a véglegesen halott fotókat,
tehát a „törött kép" helyét egyre inkább a „nincs kép" veszi át — amit a kapu nem fogott.

**Mérve 2026-09-14:** 595 leadből **148-ra (24,9 %)** biztosan fotó nélkül állna elő a lap
(nincs portál-fotó és nincs Places-fotóref sem); a 19 motor-sablon és a template-first
renderelő közül fotó nélkül **egyik sem** tesz képet a lapra (0 kép-hivatkozás), tehát a
„lapon nincs kép-hivatkozás" ma pontosan azt jelenti, hogy „nincs szállás-fotó".

## Mit KÖT a terv

1. **A kapu MEGÁLL a kép nélküli lapon** — ugyanabban a `.pg-box` dobozban, ugyanazon a négy
   úton, mint a törött kép (jóváhagyás · követett link · levél · SMS). Egy predikátum.
2. **A mondat a SAJÁT kérdésére válaszol.** Nem a törött-kép mondat nullás példánya
   („0 kép forrása nem érhető el" semmit nem mondana), hanem:
   **„Ezen a lapon EGYETLEN szállás-fotó sincs — a leadnek kép nélküli oldal menne ki."**
   A fejléc sem beszélhet törött képről: **„A jóváhagyás NEM történt meg — a lap FOTÓ
   NÉLKÜL menne ki"**.
3. **KÉT LÉPÉS — a kivétel nem az alapút.** A doboz először csak a rendes kiutat kínálja
   („Adatok újragyűjtése”); a kivétel egy külön, kimondott kattintás mögött nyílik:
   **„Mégis kiküldöm fotó nélkül…"**. Az indoklás mezője addig **nem látszik**.
4. **Az indoklás KÖTELEZŐ** — a mező kérdése **„Miért megy ki fotó nélkül?"**, a vállalás
   gombja **„Vállalom — fotó nélkül hagyom jóvá"**. Legalább 10 karakter, trim után. A gomb
   addig **tiltott**, és a lap **megmondja**, hány karakter hiányzik:
   **„Még {n} karakter kell az indokláshoz."** Üres indoklással megnyomva (JS nélkül is)
   **hibaüzenet** jön vissza, nem néma elutasítás.
5. **A kivétel NAPLÓZVA van:** ki · mikor · miért, az artefaktumra írva — utólag
   visszakereshető, hogy ki vállalta a kép nélküli megkeresést és milyen indokkal.
6. **A pipa csak akkor ér, ha a kurátor LÁTTA a képernyőt** (a törött-kép névsor-szabály
   megfelelője): ha nem a kép-kapu képernyőjéről érkezik a vállalás, nem érvényes.
7. **A FIZETNI AKARÓ vevőt a kapu NEM állítja meg** (ADR-0129): a vevői rendelés
   `generated → approved` emelése a `curateArtifact`-en megy, nem ezen a HTTP-úton. A kapu a
   KIKÜLDÉST őrzi, nem a pénztárat.
8. **Mobilon (390 px) a mező és a gomb egymás alá kerül**, a gomb teljes szélességű
   (hüvelykujj-cél); asztalin egy sorban állnak. A két méret két külön elrendezés.
9. **Ha a lap közben kap fotót, a kapu magától elenged** — a verdikt `ok` lesz, nincs mit
   lenyugtázni.

## Amit a terv NEM köt

A pontos árnyalatok és térközök: minden a `--citui-*` dizájn-magból jön, a meglévő `.pg-*`
komponensek (ADR-0134 kép-kapu doboz) mintáját követve. A kötelező minimum 10 karakter
**szám**a implementációs részlet — amit a terv köt, az az, hogy legyen kimondott küszöb, és
hogy a felület MEGNEVEZZE, mennyi hiányzik.

## Ami a végigkattintásból jött

A vázlat interaktív részeit Playwrighttal mindkét méreten végigmértük (12-12 állítás, 0
JS-hiba): tiltott gomb üres mezőnél, 8 karakternél még mindig tiltott (a küszöb 10),
10+ karakternél enged, a visszaigazolás **idézi** az indoklást, a B panel alapból rejtve,
és a kényszerített (disabled-ról levett) gomb hibaüzenetet ad. A statikus kép ezt nem
mutatta volna meg.
