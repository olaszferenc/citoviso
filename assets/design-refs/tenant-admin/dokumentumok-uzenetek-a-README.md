# Tenant-admin — „Dokumentumok" és „Üzenetek" fül (JÓVÁHAGYOTT TERV, 2026-08-29)

**Státusz:** a tulaj jóváhagyta („A" változat, 3. kör) · **Kapu:** CLAUDE.md §2b / ADR-0081
**Kiváltó kérés:** „a tenant admin felületén kell lenni egy alszekciónak a számlák bizonylatok
dokumentumoknak. Illetve a kommunikációnak: beérkező rendszerüzenetek (email, sms) egy helyen
látható legyen."

**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A megvalósítást ehhez a képhez mérjük.
Aki eltér tőle, az a tervet szegi meg — a csendes eltérés ugyanolyan súlyos, mint a kapu
megkerülése (feedback_design_approval_gate).

- Terv (kattintható, működő): `dokumentumok-uzenetek-a.html`
- Képek: `dokumentumok-uzenetek-a-{dokumentumok,dokumentumok-szurt,uzenetek}-{mobile,desktop}.png`

---

## 1. Amit a terv KÖT (elvárt viselkedés)

### Fülsor
- **KÉT új fül**, ebben a sorrendben: `dokumentumok` (a Webcím után) és `uzenetek`,
  majd a meglévő `fiok`, `sugo`. Összesen 9 fül.
- Felirat: **„Dokumentumok"** — ⛔ NEM „Iratok" (tulajdonosi javítás: magyarul nem ez a szó).
- Oldal- és kártyacím: **„Számlák és dokumentumok"**.
- Az `uzenetek` fül **olvasatlan-jelvényt** visel, ha van olvasatlan üzenet.
- Mobilon a fülsáv **két sorba tördel** (`flex-wrap`), nem görgethető és nincs „Több" menü:
  9 elemből egy sem tűnhet el rejtett menübe (IT-kezdő célközönség, §J).
- ⚠️ `overflow-wrap:break-word` a nav-feliratokon. **NEM `anywhere`** — az a min-content
  méretet is csökkenti, és a magyar feliratot is kettétörte („Dokumentu-mok"). Mérve
  390px-en: „Dokumentumok" 97px / 103px cella, egy sorban.

### Dokumentumok fül
- **Két aldivat:** „Számlák" (alapértelmezett) és „Szerződések". Egyszerre EGY lista látszik.
- **Összegző sáv:** kiállított számla darabszám · összeg · következő fordulónap.
  ⚠️ Az összegző **együtt mozog a szűrővel** — év-szűrésnél az adott ÉV darabszáma és
  összege jelenik meg, a címke is átvált („2025-ben"). A teljes összeg ott hagyása
  szűrt nézetben félrevezető.
- **Kereső:** számlaszámra, időszakra, **összegre** és áfakulcsra is talál.
- **Év-szűrő:** a chipek **az adatból származnak**, nincsenek beégetve — ha nincs adott
  évi dokumentum, nincs gombja sem.
- **„Szűrés törlése"** csak akkor jelenik meg, ha van aktív szűrő.
- **Kereszt-találat jelzés:** ha a keresésnek a MÁSIK aldivatban is van találata, a
  találat-sor kiírja és odaugrik („… a Szerződések között további 1 találat").
  Ez az A változat egyetlen gyengéjének (két külön hely) a szerződéses ellensúlya — KÖTELEZŐ.
- **Számla-sor:** számlaszám · dátum + időszak · státusz-címke · összeg · **PDF gomb a soron**.
  ⚠️ A PDF az ELSŐDLEGES művelet: a becsukott soron kell lennie, EGY koppintásra
  (feedback_primary_action_gets_the_surface). Nem rejthető kinyitás mögé.
- **`failed` státuszú számla:** a tenant NEM hibát lát. Szaggatott keretű, tompított sor:
  „Számlázás folyamatban" + „Még nincs bizonylat" címke, **PDF gomb nélkül**.
  (Valós állapot: a dev-adatbázisban ma is van ilyen sor.)
- **Szerződések:** kártyánként cím + mikor fogadta el + kulcs-érték adatok; a fotó-jogi
  nyilatkozatnál a **szó szerinti elfogadott szöveg** idézetblokkban.
- Üres állapot mindkét listára, saját szöveggel.

### Üzenetek fül
- **Klasszikus postaláda**, fordított időrendben.
- **Olvasatlan:** vastag betű + cián keret + cián pötty. Sorra koppintva **helyben nyílik**,
  és olvasottá válik.
- **Szűrők:** Mind · E-mail · SMS · Olvasatlan (n) — és **kereső** a tárgyban és a törzsben.
- **„Mind olvasott"** gomb, csak ha van olvasatlan.
- A megnyitott üzenet lábában: csatorna · feladó · időbélyeg · melléklet neve;
  melléklet esetén letöltő gomb.
- ⛔ A fül a tenant felé küldött üzeneteket mutatja. A felirat NE állítsa, hogy tőle
  is fogadunk („amit Öntől kaptunk" — javítva a 2. körben).

---

## 2. Amit a terv NEM köt

- A minta-adat: az `OV-2026-5` és a mellette álló sikertelen számlázás valós (dev-DB),
  a korábbi hónapok és a 2025-ös sorok **minták** az év-szűrő megítéléséhez.
- A PDF-gomb a mockban toastot ad; élesben valódi letöltés.
- A többi 7 fül a mockban inaktív.

---

## 3. Ismert függőség a megvalósításhoz

⚠️ **Az Üzenetek fül ma nem tud meglévő adatot mutatni.** A kiküldött e-mail/SMS sehol nem
tárolódik (`getEmailSender().send()` ~10 hívóhelyen elküld és elfelejt; a `dunning_event`
csak azt jegyzi, HOGY melyik lépés ment ki, tárgy és törzs nélkül; az `sms_outbox` (0041)
szállítási sor, nem tenant-napló). Ezért **üzenet-napló tábla kell**, és a fül a
bekapcsolás napjától lesz tartalommal — visszamenőleg üres.

**Számla → tenant lánc:** az `invoice`-on nincs `tenant_id`; az út
`invoice.payment_id → payment.order_intent_id → order_intent.prospect_id →
prospect.lead_id = tenant.lead_id`.
