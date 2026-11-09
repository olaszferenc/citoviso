## ADR-XXXX — Rossz címzett: a javított megkeresés kimehet, és a telefon-ütközés az e-mailt is megállítja

**Dátum:** 2026-11-09 · **Döntött:** tulaj („Miért nem gyártunk neki mockot, javított megkeresést?” · „3. ok”) · **Kapcsolódik:** a közös-kontakt kapu (2026-09-28, `sharedContactGate.ts`), „egy gazda, egy megkeresés” (2026-10-27)

**Kontextus.** 2026-11-07-én Neo a kontakt nélküli balatongyöröki *Benó apartman* leadre (`018e362c`) ráírta a kőröshegyi *BeNo Apartman* (`b06f20d9`) e-mail-címét és telefonszámát (névhasonlóság). 11-09 08:09-kor a kiküldő a mobil-párt visszatartotta, mert a telefonszám egy másik szállásé is, az e-mailt viszont kiküldte. A címzett 08:12-kor visszaírt: „ez nem a mi apartmanunk, a miénk Kőröshegyen van”. Amikor elkészült a saját apartmanjáról a terv, két kapu is visszatartotta: az iker-őr és a közös-kontakt kapu. Mindkettő a reggeli, rossz leadnek küldött prospect címét számolta úgy, hogy erre a címre már ment megkeresés.

**Döntés.**
1. **A rossz címzett javítása feloldja a tartást.** Ha egy kiküldött prospect címét egy kurátor később levette a leadjéről (`raw.emailCuratedAt` későbbi a prospectnél, és a lead már nem hordozza a címet), akkor az a levél rossz vállalkozáshoz ment. Ez a prospect nem teszi a címet idegen birtokossá, és nem számít „már megkeresett ikernek”. A postafiók valódi gazdája megkaphatja az első megkeresést a saját szállásáról. Kurátori levétel nélkül minden marad a régiben.
2. **A telefon-ütközés az egész kiküldést tartja.** Ha a lead telefonszáma egy másik szállásé is, a kiküldő az e-mailt sem küldi el („e-mail sem ment: …”), mert ugyanaz a hibás egyezés hozza a telefont és az e-mailt.
3. Aki azt írja, hogy „ez nem az enyém”, az **nem elutasító**. A saját szállásáról javított megkeresést kaphat (a tulaj szava, 2026-11-09).

**Visszafordíthatóság:** 🔄 egy-egy feltétel a `sharedContactGate.ts`-ben (`curatedAwayFrom`) és az `autoDispatch.ts`-ben (`sharedPhoneHold`). **Őr:** `scripts/dispatch-twin-check.mts` ⑥–⑧ (az ítélet előtti kontroll tud pirosra menni). **Elvetett:** a régi prospect `contact_email`-jének átírása (meghamisítaná, kinek mi ment ki), illetve az, hogy a javítás csak válaszlevélben menjen ki, link nélkül.
