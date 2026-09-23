## ADR-0016 — A generáló motor architektúrája: KOMPOZÍCIÓS MOTOR (recept-absztrakció) + control/data plane; WP kizárva; mock=live egy motorból

- **Kiváltó:** a tenant-admin szerkeszthetőség igénye (a tulaj a vétel után „bármit módosítson") feltárta, hogy
  a jelenlegi motor **egyedi AI-HTML-t** ad (`mockFromCorpus` szabadon interpretál), a `convertLead` pedig ezt a
  **monolitikus HTML-t MÁSOLJA** live-ba. Ez (a) mezőnként nem szerkeszthető, (b) NEM garantál `mock=live` egyezést.
- **A tulaj követelményei (kritériumok):** ① az élesnek EGYEZNIE kell a mock-kal · ② teljes modularitás ·
  ③ több-SZÁZ-dimenziós sokszínűség (nem 5–20 fix darab) · ④ iparág-független. „Szarok a dupla munkára" =
  nem a meló-spórolás a cél, hanem a `mock=live` egyezés.
- **Döntés:**
  1. **EGY központi kompozíciós motor** (control plane), multi-tenant. **NEM** per-tenant telepítés.
  2. **Az LLM szerepe: HTML-íróból → KOMPOZÍCIÓ-TERVEZŐVÉ.** A layoutot **determinisztikus PRIMITÍVEK**
     (szekció-építőelemek) adják; az LLM **kiválaszt, sorba rak, tokenekkel skinez + szöveget/palettát ad** — nem ír nyers HTML-t.
  3. **RECEPT-absztrakció** — strukturált, tárolt, szerkeszthető kompozíció-leírás: *mely primitívek, milyen
     sorrendben, mely modulok, milyen skin/paletta, milyen szövegek.* Ez a rendszer központi objektuma.
  4. **Adatfolyam:** `adat → [AI-tervező] → RECEPT → determinisztikus render(RECEPT + adat + skin) → HTML`.
  5. **`mock=live` GARANTÁLT (nem „igyekszünk"):** ugyanaz a motor+recept; **mock = recept + DEMÓ-adat**,
     **live = ugyanaz a recept + VALÓS adat**. A forma bitre azonos, mert a render determinisztikus.
  6. **Négy készlet a motorban:** primitív-készlet (layout, **iparág-agnosztikus**) · skin-készlet (`--cit-*`
     tokenek) · modul-készlet (**funkció = az IPARÁG-INTERFÉSZ**, a 3 becsatlakozás: KÍNÁLAT·ELÉRHETŐSÉG·KONVERZIÓ) · render.
  7. **Sokszínűség = KOMBINATORIKA**, nem darabszám: primitívek × generatív paletta × modul-kompozíció ×
     tipó-skála → ezrek, pár tucat karbantartott elemből.
  8. **Iparág-agnoszticitás:** a primitívek tartalom-agnosztikusak; az **iparág = a modul-készlet**. Új iparág =
     új modul-készlet, **nem új motor**.
  9. **Control/data plane felosztás:** *házon belül* a motor + a teljes pipeline (scraper/kuráció/konverzió/
     számlázás/ERP); *kirakva a tenantnak* KIZÁRÓLAG kettő: a **publikus SITE** (a motor kimenete, tenant-domain)
     és a **tenant ADMIN** (recept+adat szerkesztő). A **motor SOHA nem települ a tenanthoz.** Izoláció **adat-szinten**
     (recept+adat per tenant), nem infrastruktúra-szinten → ez adja a közel-nulla marginális költséget + a volumen-skálát.
  10. **A recept a tenant-admin szerkeszthetőség alapja:** a tulaj a **receptet + adatot** szerkeszti (szöveg,
      modul be/ki, skin-váltás) → a központi motor **újrarendel**. Megszünteti a monolitikus HTML-t és a mock-másolást.
- **Következmények (építési):**
  - A `convertLead` mock-HTML-másolása **LECSERÉLENDŐ** → a live-ot a motor rendeli (recept + valós adat + skin).
  - A `mockFromCorpus` (AI egyedi HTML) **átalakítandó**: AI → recept, majd determinisztikus render.
  - A **06-UI-CONTRACT** (téma-kontraktus `--cit-*` + modul-kontraktus `data-cit-module` + hidratáló runtime)
    **MEGMARAD és ráépül** — ez a motor MÁR KÉSZ fele (O(archetípus)+O(modul), élő-validált).
  - A 27 archetípus/korpusz → a **primitív- + skin-készlet FORRÁSA** (desztilláció), nem eldobás.
- **Elvetett alternatívák:**
  - **(A) WordPress / per-tenant CMS** — kizárva: a `mock=live` nem garantálható (más motor mockhoz/live-hoz),
    a volumen-modell összeomlik (több ezer telepítés üzemeltetése ≠ közel-nulla költség), a mock-fázisban
    (fizetés ELŐTT) nem húzható fel nem-fizető leadnek, a központi kontroll (entitlement/guardian/számlázás)
    elvész, és a „sokszínűség" fix témákból **nem** skálázódik (darabszám ≠ kombinatorika).
  - **(B) Fix skin/archetípus-készlet (5–20 darab)** — kizárva: darabszám-alapú, nem éri el a több-száz-dimenziót.
  - **(C) Mock-HTML másolása live-ra (a mostani `convertLead`)** — kizárva: monolitikus, nem szerkeszthető,
    és valójában NEM `mock=live` (statikus másolat, ami adat-frissítésnél elavul).
  - **(D) Inline WYSIWYG a generált HTML-en** — elvetve MINT ELSŐDLEGES (nem strukturált, modul-kezelés nehéz,
    patch-réteg törékeny); lehet későbbi kényelmi réteg a recept FÖLÖTT.
- **Visszafordíthatóság:** 🚪 — a motor-mag iránya nehezen visszafordítható; DE a meglévő kontraktusokra épül,
  és **fokozatosan, vékony szeleteken** vezethető be (nincs big-bang újraírás).
- **Státusz:** ELFOGADVA (architektúra-irány, a tulajjal közösen). Implementáció vékony szeletekben; az ELSŐ a
  **bizonyító szelet**: egy primitív-készlet + egy skin + determinisztikus render, ami egy VALÓS leadből live-ot ÉS
  DEMÓ-adatból mockot ad → élőben bizonyítja a `mock=live` garanciát, mielőtt a készleteket skálázzuk.
