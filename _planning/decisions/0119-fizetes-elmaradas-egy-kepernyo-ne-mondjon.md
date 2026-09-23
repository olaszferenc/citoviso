## ADR-0119 — Fizetés-elmaradás: egy képernyő ne mondjon önmagának ellent (fagyasztás és visszakapcsolás)

**Dátum:** 2026-09-11 · **Státusz:** ELFOGADVA (tulajdonosi választás: „A — Teendő-kártya”
változat; a vendég-lapon a „nézzen vissza holnap” szöveg) ·
**Kapcsolódó:** ADR-0080 ⑤⑥ (dunning-létra, freeze ≠ eltűnés), 03-INVARIANTS §B.17
(tényhűség), CLAUDE.md §2b · **Terv-kontraktus:** `assets/design-refs/console/freeze-state/`

**Probléma (mérve, nem tippelve — Elek FK-006a/b, 2026-09-11, a renderelt HTML-en számolva).**
Az ADR-0080 ⑥ gépezete HIBÁTLANUL működött: a site `suspended` lett, a vendég 503-at kapott,
a tulaj piros bannert és öt dunning-levelet. A hiba nem a mechanikában volt, hanem abban,
hogy **a felület többi része nem tudott az állapotról**:

1. A `tab=modulok` EGY lapon állította, hogy a honlap „fel van függesztve”, hogy a tulajnak
   „nincs teendője”, és hogy a honlap „elérhető marad”; **11 modul** azt írta magáról, hogy
   „Aktív az oldalán.”
2. A **fizetendő összeg sehol nem szerepelt**: a látható számok a JÖVŐRE szóltak („Következő
   számla”), a tartozás csak levél-előnézetekben bukkant fel, a lap alján pedig egy ÚJ
   VÁSÁRLÁS gombja volt az egyetlen nagy, kitöltött fizető-gomb.
3. A vendég névtelen zsákutcát kapott: két mondat, se szállásnév, se elérhetőség.
4. A visszakapcsolás **néma** volt: `status='active'`, `frozen_at=NULL`, és kész — a legfrissebb
   üzenet percekkel a visszatérés után is a „Honlapja felfüggesztve” maradt.
5. A lejárt foglalási kérésről a tulaj **semmilyen** értesítést nem kapott, a sor pedig
   „döntés: aug. 4.”-et írt arra az egy kimenetelre, ami ÉPP a döntés hiányából állt elő.

**① A fagyás ÁLLAPOT, nem doboz.** A felfüggesztés minden érintett feliratot átír: a megbízás-blokk
„NEM SIKERÜLT · Az automatikus kártyaterhelés elakadt”, a modulok „Szünetel — a felfüggesztés
alatt a vendégek nem látják.”, a lemondás-zóna nem ígér elérhetőséget. ⛔ A „nincs teendője”,
az „elérhető marad” és az „Aktív az oldalán” felfüggesztés alatt TILOS.

**② Teendő-kártya, a tartozás összegével.** Külön kártya a lap tetején (nem banner a
kártyán BELÜL — ott a `.adm-card__head` −26px-es margója levágta az alját). Benne a
**tartozás a képernyő legnagyobb száma**, közvetlenül alatta a rendezés gombja, mellette a
T+30 határidő. Az összeg forrása a dunningolt megújulás-order ára (`renewal_period_start =
current_period_end`) — ugyanaz a kulcs, amivel a létra dolgozik, nem újraszámolt hasonmás.

**③ A vendég emberi lapot kap.** 503 + `Retry-After` + `noindex` marad, de a lapon szállásnév,
település, „nézzen vissza holnap”, és a szállás SAJÁT, vendégnek szóló elérhetősége
(`mock_artifact.inputs.siteData.contact` + felülírások) — **nem** a `tenant_legal` számlázási
identitás. ⛔ Az OKOT nem árulja el: a „rendezetlen díj” a vendég szeme előtt a szállásadót
járatná le.

**④ A visszatérés legalább olyan hangos, mint a fagyás, és LEZÁRJA a szálat.** Új oszlop:
`subscription.restored_at` (0063) — a `frozen_at`-et épp az az esemény törli, amit meg
akarunk mutatni. A visszakapcsolás levelet és `tenant_message`-et küld (`kind='dunning'`,
tehát abba a szálba sorol, amit lezár), a tulaj-admin pedig 3 napig zöld megerősítést mutat
(tulajdonosi döntés 2026-09-12; az első vágás 7 nap volt).

**⑤ A lejárt foglalásról a tulaj is értesül**, és a sor „lejárt: {dátum}”-ot ír „döntés” helyett,

**⑥ A BOLT ZÁRVA (tulajdonosi rendelet, 2026-09-12, a szállítás utáni körben).** Felfüggesztés
alatt ÚJ modul nem vehető fel: sem a bolt-kártyán, sem az előnézet-overlay lábában, sem az
egyszeri díjas („Többnyelvű honlap") kártyán. Egy tartozás-kártya és egy élő „Hozzáadom" gomb
UGYANAZON a lapon ugyanaz az ellentmondás, pénzben. ⛔ A LEMONDÁS és a lemondás visszavonása
NYITVA MARAD — az kijáratot venne el. A kapu az ÍRÁSON ül (`applyModuleChange`,
`createMultilangOrder`), a gomb csak udvariasság; a bolt LÁTSZIK, de kimondja, hogy zárva van,
különben törött lapnak olvasnák.
a magyarázattal együtt („Nem érkezett válasz… A vendégnek elküldtük az értesítést.”).

**⑦ Gépi kapu:** `scripts/frozen-state-check.mts` — a `modulesSection()` RENDERELT kimenetén mér
(a mondatok külön ágakból jönnek; forrás-scan nem látja, melyik sül el EGYÜTT), hermetikus
fixture-rel, pre-commitban a felület/billing fájlok változásakor. `--self-test` a romlott
állapotra futtatva **6 sértést** talál — köztük mind a négy eredetileg bejelentettet.

**⑧ A SZÓ SZERINTI TŰ NEM ELÉG — AZ ÁLLÍTÁST KELL MÉRNI** (2026-09-14, Elek FK-006a HIBA-1 nyomán).
A ⑦ őr három tűje (`nincs teendője`, `elérhető marad`, `Aktív az oldalán`) **mind ÁTMENT**, miközben
ugyanazon a fagyasztott lapon a többnyelvű kártya azt írta: „Az oldala … **elérhető lesz**”, „a nyelvi
változatok **maguktól megjelennek**”, feljebb pedig „**meg is nézheti a saját oldalán**”. A tű-lista
szerkezetileg csak azt ismeri, amit egyszer már elkaptunk — **más szavakkal ugyanaz az ígéret átcsúszik**.
Ezért az új őr (`scripts/frozen-claim-check.mts`) nem szavakat keres, hanem **állítást**: ALANY (a tulaj
oldala / tartalma / modulja) + ÁLLÍTMÁNY (elérhető · megjelenik · látható · naprakész) + POLARITÁS
(nem tagadott, és nem a fagyás oldja fel). Így az ÚJ megfogalmazás is fennakad rajta. A kártyákat a
**termék katalógusából** rendereli hat többnyelvű állapotban, tehát egy új modul-leírás is a mérés alá esik.
⛔ A termék-leírás kivételei **kimondottak és exact-match**-esek: ha a szöveg változik, a kivétel nem
illeszkedik többé, és az őr pirosra vált — a kivétel nem tud némán tágulni. Önteszt: **19 állítás**.
⚠️ A tagadás-vizsgálat a állítmány ELŐTTI 40 karakteren néz negátort, nem a teljes mondaton: az
„Az oldala elérhető, nem kell tennie semmit” mondatban is ott a „nem”, mégis ígéret.

**Elvetett változatok:** B („állapot-sáv minden fülön”) — kevesebb helyet foglal és mindenhol
látszik, de halkabb; C („rendezés-kapu”) — a legerősebb, de elzárja a tulajt attól, amiért belépett.

**Visszafordíthatóság:** 🔄 a feliratok és a visszatérés-ablak szabadon hangolhatók (7 → 3 nap, 2026-09-12);
🚪 részben egyirányú: a `restored_at` oszlop és a vendégnek kiküldött lap-forma kifelé tett vállalás.
