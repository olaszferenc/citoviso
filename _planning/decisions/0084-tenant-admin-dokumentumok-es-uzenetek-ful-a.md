## ADR-0084 — Tenant-admin: „Dokumentumok" és „Üzenetek" fül + a tenant-üzenetnapló

**Dátum:** 2026-08-29 · **Státusz:** ELFOGADVA (tulajdonosi kérés + jóváhagyott terv) ·
**Kapcsolódó:** ADR-0021/0023 (tenant-admin), ADR-0032 (számlázás), ADR-0080 ⑦ (SMS),
ADR-0081 (§2b felület-kapu), CLAUDE.md §2b.

**A kérés.** „A tenant admin felületén kell lenni egy alszekciónak a számlák bizonylatok
dokumentumoknak. Illetve a kommunikációnak: beérkező rendszerüzenetek (email, sms) egy helyen
látható legyen." Két hiány: a tenant ma sem a saját bizonylatait, sem a neki küldött
értesítéseket nem látja a felületen.

**A terv-kör (§2b).** Két változat készült (Iratrendező / Idővonal), mindkettő működő mockként,
mobil+desktop nézettel. A tulaj az **„A"-t** választotta, majd két körben pontosított:
① „lehessen keresni és szűrni is", ② „magyarul nem iratok hanem Számlák / dokumentumok".
A befagyasztott kontraktus: `assets/design-refs/tenant-admin/dokumentumok-uzenetek-a*`
(HTML + 6 kép + README, ami kimondja, mit KÖT a terv).

**① A számlák tárolása MA (feltárás, nem döntés).** A kiállított PDF **base64-ként a Postgres
`invoice.pdf_base64` oszlopában** él (0030), nem fájlrendszeren — a Számlázz.hu Agent API
`szamlaLetoltes=true` válaszából. A tenant-admin tehát a DB-ből tudja kiszolgálni, külön
tárolóréteg nélkül. ⚠️ Két, egymásnak ellentmondó tárolási doktrína él: az ERP-oldali
`accounting_document.document_file` (0031) FÁJLRENDSZERRE mutat (`sites/_documents/<év>/…`),
és a 0031 indoklása épp azt mondja, amit a 0030 az ellenkezőjére. **Ezt az ADR NEM oldja fel**
— külön szálra tartozik, a mentési réssel együtt (a `sites/` nincs mentve, a `pg_dump` is csak
migráció előtt fut; 8 éves megőrzés mellett ez a gyengébb láncszem).

**② ÚJ tábla kell az üzenetekhez — a meglévők egyike sem alkalmas.**
- `dunning_event` (0039): csak azt jegyzi, HOGY melyik lépés melyik csatornán ment ki
  (`step`, `channel`, `sent_at`). Tárgy és törzs nincs benne; append-only idempotencia-indexe
  van. Fogyasztóvédelmi audit-nyom, nem postafiók.
- `sms_outbox` (0041): SZÁLLÍTÁSI sor a relay-nek (telefonszám + törzs + kézbesítési állapot).
  Nincs benne tenant, tárgy, és a sikeres küldés után sem a tenant nézőpontját írja le.
- A `getEmailSender().send()` ~10 hívóhelyen elküld és elfelejt (lokálban `outbox/*.eml`).

Ezért `tenant_message`: a TENANT NÉZŐPONTJA („mit mondtunk neki, mikor, melyik csatornán,
elolvasta-e"). A szállítás állapota külön fogalom marad — a napló nem szállít, a sor nem naplóz.

**③ A napló a bekapcsolás napjától él — ezt kimondjuk.** A fül visszamenőleg üres, mert a
korábbi küldésekről nincs adat. Nem gyártunk visszamenőleges sorokat heurisztikából (az
kitalált tartalom lenne a tenant postaládájában — §B.17). A felület üres állapota ezt
őszintén megmondja.

**④ Naplózni CSAK tenant-hez köthető üzenetet szabad.** A hideg megkeresés (outreach) NEM
kerül a naplóba: a címzett akkor még nem ügyfél, és a saját postaládájában sem várná. A
határ: van-e `tenant_id`.

**⑤ A naplózás és a küldés nem ránthatja magával egymást.** A napló-írás hibája nem
bukhatja a küldést (az üzenet fontosabb, mint a nyoma), és a küldés hibája sem hagyhat
„elküldtük" sort. Sorrend: küldés → siker esetén napló; a napló-hiba hangos log, nem dobás.

**⑥ Számla → tenant: nincs `tenant_id` az `invoice`-on.** Az út
`invoice.payment_id → payment.order_intent_id → order_intent.prospect_id →
prospect.lead_id = tenant.lead_id`. A tenant-admin lekérdezés ezen a láncon szűr — és
KIZÁRÓLAG ezen: egy tenant SOHA nem láthatja más bizonylatát.

**⑦ Felület-kötések (a README részletezi).** „Dokumentumok" fül (⛔ nem „Iratok"), oldalcím
„Számlák és dokumentumok"; két aldivat (Számlák/Szerződések); kereső + adatból származó
év-szűrő; az összegző EGYÜTT MOZOG a szűrővel; a PDF az elsődleges művelet, a becsukott
soron; a `failed` számla „Számlázás folyamatban"-ként, PDF nélkül; kereszt-találat jelzés a
másik aldivatba. Üzenetek: postaláda, olvasatlan-jelvény, Mind/E-mail/SMS/Olvasatlan szűrő,
kereső, megnyitás = olvasottá tétel.

**Visszafordíthatóság:** 🔄 a felület és a szűrők szabadon hangolhatók; 🚪 részben egyirányú:
a `tenant_message` tartalma a tenant felé tett kommunikáció rögzített nyoma — ha egyszer
megmutattuk neki a postaládát, a visszavétele funkció-elvétel.
