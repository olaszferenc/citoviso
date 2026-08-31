# 2026-08-30/31 — Tenant-admin „Dokumentumok" + „Üzenetek" fül, majd a mentés-doktrína

**ADR-0084** (fülek + üzenetnapló) és **ADR-0086** (mentés + tárolási szabály + PDF-pótlás).
Mindkettő LEZÁRVA és LANDOLVA. Élesítve NINCS — az külön, kimondott engedély (§0.3).

---

## A kiváltó kérés

> „a tenant admin felületén kell lenni egy alszekciónak a számlák bizonylatok dokumentumoknak
> (egyébként hol tároljuk fizikailag a számlákat amiket a számlázz.hu-ról állítunk ki?)
> Illetve a kommunikációnak: beérkező rendszerüzenetek (email, sms) egy helyen látható legyen."

## Amit a feltárás hozott (a válasz a zárójeles kérdésre)

- A kiállított PDF **base64-ként a Postgres `invoice.pdf_base64` oszlopában** él (0030), NEM
  fájlként. A `szamlaLetoltes=true` óta az Agent API válasza hozza, a `payment/service.ts` írja be.
- ⛔ **A kiküldött üzenetekről SEMMI nem tárolódott.** A `dunning_event` csak azt jegyzi, HOGY
  melyik lépés ment ki (tárgy/törzs nélkül); az `sms_outbox` (0041) szállítási sor. Ezért kellett
  új tábla — a napló nem szállít, a sor nem naplóz.
- Az `invoice`-on **nincs `tenant_id`**: `invoice → payment → order_intent → prospect.lead_id =
  tenant.lead_id`.

## §2b terv-kör

Két működő mock (Iratrendező / Idővonal), mobil+desktop, méret-váltóval. A tulaj az **„A"**-t
választotta, majd két körben pontosított: ① „lehessen keresni és szűrni is", ② „magyarul nem
iratok hanem Számlák / dokumentumok". Kontraktus befagyasztva:
`assets/design-refs/tenant-admin/dokumentumok-uzenetek-a*` (HTML + 6 kép + README).

⭐ **A terv-kör két valódi hibát fogott meg, még kód előtt:** a B változatban a PDF két
koppintásra volt (az elsődleges műveletnek jár a felület), és a B asztali olvasópanelja üresen
kongott. A megvalósítás közben pedig a KÉP mutatta meg, amit a mérés nem: a nav-felirat
`overflow-wrap:anywhere`-rel kettétört („Dokumentu-mok"), és egy számla nélküli tenantnál
„Nincs a KERESÉSNEK megfelelő számla" állt ott, holott nem is keresett.

## Amit építettünk

**ADR-0084** — `0044_tenant_message` (csatorna/tárgy/törzs/olvasottság; a tenant NÉZŐPONTJA),
8 küldő hívóhely bekötve. ⛔ A 2 VENDÉGNEK szóló levél és a 3 hideg outreach szándékosan
kimarad: ez a tenant postaládája, nem a vendégé. „Dokumentumok" fül (számlák + nyilatkozatok,
kereső, adatból származó év-szűrő, a szűrővel EGYÜTT MOZGÓ összegző, kereszt-találat jelzés a
másik aldivatba, `failed` → „Számlázás folyamatban" PDF nélkül) és „Üzenetek" fül (postaláda,
olvasatlan-jelvény, Mind/E-mail/SMS/Olvasatlan, keresés, megnyitás = olvasottá tétel).

**ADR-0086** — a tulaj kérdésére („a számla a Számlázz.hu-n él, mi csak tároljuk — mi a
legjobb?") a mérés **áthelyezte a kérdést**: nem a tárolás helye a kockázat, hanem hogy
**NEM VOLT MENTÉS**. Nulla ütemezett mentés; az egyetlen dump akkor készült, ha épp futott egy
migráció — az utolsó 4 napos volt, közben 419 lead, az élő tenant és a bizonylatok egyetlen
lemezen. → `scripts/backup-pull.sh` + `citoviso-backup.timer` (03:00, PULL-modell, teljes
visszaállítás-ellenőrzéssel, 14 napi + 12 havi). A tárolási szabály kimondva: generált+kicsi →
DB, feltöltött+nagy → fájl, ~1 GB küszöb (a 0030 és 0031 így nem két ellentmondó doktrína).
Plusz a Számlázz.hu-újraletöltés (`fetchIssuedInvoicePdf`, önjavító letöltés-út + tömeges
backfill) — a szolgáltatónál CSAK OLVASÁS.

## Mérések (nem tippek)

- **Bérlő-izoláció:** az `OV-2026-5` pontosan egy tenantnál látszik; idegen bérlő id-jére a
  PDF-route `null`/404, és idegen nem tudja olvasottá tenni más üzenetét. A pótló ág sem
  kerüli meg.
- **Számlázz-újraletöltés élesen:** `OV-2026-5` 693 ms alatt, valódi `%PDF`, **karakterre
  azonos** a tárolt példánnyal (sha256 egyezik). Ismeretlen szám → 7-es hibakód, `null`, nem dobás.
- **Mentés:** első futás 964 KB, 38 tábla, minden sorszám egyezik; **magától lefutott** 03:00:01-kor
  8 mp alatt. Pirosra tesztelve: csonka dump / hamis sorszám / hiányzó `sites/` → mind bukik.
- **Nav 390px-en:** „Dokumentumok" 97px a 103px-es cellában, egyik felirat sem vágódik le,
  tap-magasság 53px.

## Tanulságok (a gépi memóriába is)

1. ⛔ **Tagadó állítást ne vonj le szűk grepből.** Kijelentettem, hogy nincs SMS-csatorna —
   közben `gammu-smsd` + GSM-modem ÉL (ADR-0080 ⑦). A hibás tagadás MUNKÁT SZÜL (újraépítem,
   ami megvan). Domain-szinonimákra is keress, és előbb a DECISIONS.md-ben, mint a kódban.
2. ⛔ **A DB kollációja `C`** → `lower('PRÓBA')` = `'prÓba'`, az SQL-oldali ILIKE NÉMÁN elveszti
   az ékezetes nagybetűs találatokat. A ház megoldása JS-fold (`src/text/fold.ts`); a `kb.ts`
   duplikátuma is erre állt.
3. ⭐ **A hatókör legyen származtatott, ne felsorolt.** A mentés kézi tábla-listája az első
   futáson elhasalt (a dev előrébb járt egy táblával) — és a fordított esetben NÉMÁN hagyott
   volna ki egy új, sosem mentett táblát. Most az élesből jön.
4. ⭐ **Az őr csak akkor ér valamit, ha tud bukni.** A mentést szándékos rontásokkal
   pirosra futtattam, mielőtt zöldnek fogadtam volna el.

## Nyitott

- **Élesítés** (ADR-0084 + 0086): `scripts/deploy-prod.sh <commit> --go`, a 0044 migráció miatt
  `pg_dump` fut előtte. KÜLÖN engedély kell.
- Az éles fán két elfelejtett ideiglenes szkript (`duplicates.ts`, `tmp-dup.mts`) — szemét, nem
  kód-eltérés; törléshez engedély kell.
- A `sites/_documents/` (ERP-bizonylatok) most már mentve van, de a fájlos ág írása még csak a
  konzolban létezik — ha nő, a ~1 GB küszöb szerint a kimenő ág is költözik.
