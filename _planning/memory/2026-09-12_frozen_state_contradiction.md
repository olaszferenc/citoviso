# 2026-09-12 — A fagyasztott lap egyszerre mondta, hogy „fel van függesztve” és hogy „nincs teendője”

**Szál:** tulaj-bejelentés (Elek FK-006a/b körök) · **Döntés:** ADR-0119 ·
**Terv-kontraktus:** `assets/design-refs/console/freeze-state/` · **Landolva:** lásd lent ·
**Élesítés:** NINCS (§0.3)

## A lelet — és ami benne a legfontosabb

Az ADR-0080 ⑥ gépezete **végig hibátlanul működött**: T+10-kor a site `suspended` lett, a
vendég 503-at kapott, a tulaj piros bannert és öt dunning-levelet. A hiba az, hogy **a
felület többi része nem tudott az állapotról.** Ez az, amit egy egység-teszt szerkezetileg
nem tud megfogni: minden mondat külön-külön IGAZ, a hiba csak az EGYÜTT-ÁLLÁSUKBAN létezik.

Mérve a renderelt HTML-en (nem a forráson), `tab=modulok`, fagyasztott ELEK-TESZT tenant:

| | mérés |
|---|---|
| ellentmondás | 1× „fel van függesztve” **+** 1× „nincs teendője” **+** 1× „elérhető marad” EGY lapon |
| modulok | **11×** „Aktív az oldalán.” miközben a vendég 503-at kap |
| összeg | a tartozás (99 900 Ft) **sehol**; a látható számok a JÖVŐRE szóltak |
| gomb | az egyetlen nagy, kitöltött fizető-gomb a lap alján egy **ÚJ vásárlásé** volt |
| vendég | két névtelen mondat — se szállásnév, se elérhetőség |
| átfedés | a sötét „Előfizetés” panel **ráfutott** a banner aljára (mobilon fotózva) |
| visszatérés | `status='active'`, `frozen_at=NULL` — **és kész**; a legfrissebb üzenet percekkel a visszatérés után is a „Honlapja felfüggesztve” maradt |
| foglalás | lejáratról **semmilyen** tulaj-értesítés; a sor „döntés: aug. 4.”-et írt arra az egy kimenetelre, ami ÉPP a döntés hiányából állt elő |

## Az ⑤ átfedés valódi oka (szerkezeti, nem kozmetikai)

A fagyás-banner a `.adm-card` **BELSEJÉBEN** volt, a `.adm-card__head` pedig
`margin:-26px -28px 18px`-szal húzza fel magát (teli-szélességű navy sáv). Ez azt
FELTÉTELEZI, hogy ő az első gyerek — bármi, ami elé kerül, alulra kap egy 26px-es
takarást. A javítás ezért nem térköz, hanem hely: a fagyás **saját kártya** lett a
panel FÖLÖTT, és a `past_due` banner is kikerült a kártyából.

## Amit szállítottam (ADR-0119)

1. **Teendő-kártya** (jóváhagyott „A” változat): a tartozás a lap **legnagyobb száma**,
   közvetlenül alatta a rendezés gombja, mellette a T+30 határidő. Az összeg a
   **dunningolt megújulás-order ára** (`renewal_period_start = current_period_end`) —
   ugyanaz a kulcs, amivel a létra dolgozik, nem újraszámolt hasonmás.
2. **A fagyás ÁLLAPOT**: a megbízás-blokk „NEM SIKERÜLT · Az automatikus kártyaterhelés
   elakadt”, a modulok „Szünetel — a felfüggesztés alatt a vendégek nem látják.”, a
   lemondás-zóna nem ígér elérhetőséget.
3. **Vendég-lap**: szállásnév, település, „nézzen vissza holnap”, és a szállás SAJÁT,
   vendégnek szóló elérhetősége. ⛔ Az OKOT nem árulja el.
4. **Visszatérés**: `subscription.restored_at` (0063) + levél + `tenant_message` +
   7 napig zöld kártya.
5. **Lejárt foglalás**: tulaj-értesítés, és „lejárt: {dátum}” a „döntés” helyett.
6. **Őr**: `scripts/frozen-state-check.mts`.

## Amit menet közben magamon fogtam meg (ez a jegyzet értéke)

- ⛔ **A `tenant_legal` NEM a vendég kapcsolata.** A felderítő agent azt ajánlotta a
  vendég-laphoz; az a **számlázási/jogi identitás** (gyakran magáncím, és az ELEK
  tenantnál egyáltalán nincs sora). A helyes forrás a szállás SAJÁT site-adata
  (`mock_artifact.inputs.siteData.contact` + `site.edited_site_data`) — ugyanaz,
  amit a vendég az élő oldalon lát.
- ⛔ **A `hidden` vesztett az inline `display:grid`-del szemben** a C változat kapujában:
  a DOM azt mondta, rejtve van, a pixel mást. A képen láttam meg, nem az assertben —
  ezért a kapu-ellenőrzés **`isVisible()`-re** került, nem attribútum-olvasásra.
- ⛔ **A saját ellenőrzőm a saját magyarázó mondatomra pirosodott** („Korábban itt
  »döntés: aug. 4.« állt”). A lap-szintű `includes` proxy volt; a **SORRA** szűkítve lett
  igaz állítás.
- ⛔ **Ugyanez élesben, az Elek-forgatókönyvben:** a `nem látható "Foglalás"` a vendég-lap
  saját tisztességes mondatára bukott („**Foglalással**, érkezéssel kapcsolatos…”),
  miközben a mérendő tény — hogy a fagyasztott oldal **nem vesz fel foglalást** — soha nem
  volt megmérve. A részszöveg proxy; a `[data-cit-module='booking']` **darabszáma** a tény.
  Ezért kapott a runner `darab` kifejezése `==`/`<=` operátort is.
- ⛔ **A `run-all.mts FK-006a` a végén VISSZAOLVASZT** (a park a következő kört készíti
  elő). Az első ui-shotom ezért az AKTÍV lapot fotózta, bannerrel együtt hiányzó
  fagyással — majdnem „eltűnt a hiba”-következtetést vontam le belőle.
- ⛔ **Az FK-006b olyan állapotot mért, amit a park sosem hozott létre:** a tulaj-értesítés
  csak az `expireStaleRequests()` futásából keletkezik, a SQL-seed előre-lejárt sora csak a
  jelvényt adja. A `bookingexpire` lépés bekerült a parkba.
- ⚠️ **A jóváhagyott terv köti a színt is:** a fizető-gomb a `citui-btn--primary`-vel ciánra
  váltott, a tulaj viszont PIROS gombot hagyott jóvá. A ház stílusa nem írhatja felül
  csendben a képen hozott döntést.
- ⚠️ A `.adm-mand__pill--off` szabályt először a base `.adm-mand__pill` ELÉ tettem —
  azonos specificitásnál a későbbi nyer, tehát a piros háttér elveszett volna.

## Az őr, és hogy miért hihető

`scripts/frozen-state-check.mts` a `modulesSection()` **renderelt kimenetén** mér,
hermetikus fixture-rel (se DB, se szerver, friss klónon is fut). Forrás-scan itt elvileg
alkalmatlan: a mondatok külön ágakból, külön fájlokból jönnek, és a kérdés az, **melyik sül
el EGYÜTT**.

`--self-test` a romlott állapoton **6 sértést** talál, köztük **mind a négy eredetileg
bejelentettet** — és zöld a javítotton. Ha nem talál semmit, a script maga bukik el
(„az őr vak, nem a termék jó”).

## Nyitott

- A tulaj-admin `restored_at` ablaka **7 nap** — mérés nélkül választott szám; ha a
  gyakorlatban zajos vagy rövid, hangolni kell.
- A vendég-lap „nézzen vissza holnap” a saját `Retry-After: 24h`-nkkal egyezik, de **nem
  ígéret**, amit be tudunk tartani (a fizetés a tulajon múlik). Tulajdonosi döntés volt,
  tudatosan.
- Az FK-006 teljes köre a KÖZÖS parkot használja: minden végigsétálás **+1 évet told** az
  előfizetés fordulónapján (most 2031-09-10-nél tart). Más szál ettől fordulónap-ugrást
  láthat — az az én sétám nyoma, nem termék-hiba.
