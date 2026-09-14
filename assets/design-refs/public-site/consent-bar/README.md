# Süti-hozzájárulás sáv — BEFAGYASZTOTT TERV (A változat)

*Jóváhagyva: 2026-09-11, tulajdonosi választás két kattintható változat és mobil+desktop
kép után. Ez a megvalósítás KONTRAKTUSA, nem stílus-javaslat.*

**Hatókör:** `public/assets/runtime/cit-consent.js` · `public/assets/runtime/cit-consent.css`
(`#cit-consent` szabályok — 2026-09-14 óta itt, NEM a `home.css`-ben) ·
`src/server/public.ts` (a sáv beillesztése + `PAGE_AUDIENCE`, a címzett-hatókör)

---

## Miért létezik ez a felület

Az oldalunk 2026-09-11-ig **mérten 0 sütit** tett le, és pont ezért **nem volt süti-sávunk**
(ADR-0110: a kérdés akkor átfordult — hazugság lett volna tájékoztatni valamiről, ami nem
történik). A Barion Pixel viszont KÖVETŐ szkript, a kártyás elfogadóhely jóváhagyásának
feltétele. Vele a „0 süti" állapot megszűnik, tehát a sáv innentől kötelezettség.

## Amit a terv KÖT

1. **Alsó, teljes szélességű sáv**, sötét navy háttéren, a lap aljára rögzítve. Nem
   sarok-kártya, nem modális ablak.
2. **Két gomb, ebben a sorrendben:** **„Csak a szükségeseket"** (másodlagos, keretes) és
   **„Elfogadom"** (elsődleges, cián). Az elutasítás NEM lehet nehezebben elérhető vagy
   kevésbé látható, mint az elfogadás.
3. **Mobilon (≤560px konténer-szélesség) a próza a gombok FÖLÉ kerül, a két gomb pedig egy
   teljes szélességű sort oszt meg egyenlő arányban** — `@container` query, nem `@media`
   (a sáv szűkebb dobozban is helyesen kell rendeződjön). Asztalin a gombok
   tartalom-szélességűek (a hosszabb „Csak a szükségeseket" szélesebb).
   ⚠️ *Pontosítva 2026-09-14:* itt korábban „a gombok egymás alá kerülnek, teljes szélességben"
   állt, a jóváhagyott `mobile.png` és az `approved.html` viszont **fél-fél szélességű gombpárt**
   mutat EGY sorban (`.cbar__b{width:100%}` + `button{flex:1}`). A kód mindig a KÉPET követte;
   a prózát igazítottuk hozzá, mert a `consent-style-check` őrt épp ez a mondat vezette félre —
   **a jóváhagyott kép a mérce, nem ez a bekezdés.**
4. A szövegben szerepel, hogy **a Barion csalásmegelőző sütikről van szó**, és hogy
   **enélkül is működik az oldal**, valamint egy link az **Adatkezelési tájékoztatóra**.

## Amit a VISELKEDÉS köt (ez nem kinézeti kérdés — nem alkudható)

- ⛔ **A Pixel KIZÁRÓLAG az „Elfogadom" után tölthet be.** Hozzájárulás előtt egyetlen
  külső szkript sem indulhat — különben a sáv díszlet, nem védelem.
- ⛔ **Az elutasítás nem írhat le sütit.** A döntést `localStorage`-ban tartjuk.
- ⛔ **Azonosító nélkül (`BARION_PIXEL_ID` üres) a sáv MEG SEM JELENIK.** Nem kérünk
  hozzájárulást olyan követésre, ami meg sem történik (§B.17).
- ⛔ **Csak a saját oldalunkon (citoviso.com).** A generált tenant-oldalakra NEM kerül: ott
  a vendég nem nálunk fizet, semmi nem indokolná a szállás látogatóinak követését.
  ⚠️ *Pontosítva 2026-09-14 (ADR-0151):* a „saját" azt jelenti, hogy **NEKÜNK szól**, nem azt,
  hogy **mi adjuk ki**. A határ a lap CÍMZETTJE: a tenant VENDÉGÉNEK szóló lapokra akkor sem
  kerül, ha a mi szerverünk és a mi domainünk adja ki őket — ide tartozik a generált
  szállás-oldal MINDEN kiszolgálási útja (`<slug>.citoviso.com`, `/t/<slug>`,
  `/site/<preview_token>`), a mock-előnézet (`/m/<token>`) és a vendég lemondó lapjai
  (`/foglalas/<token>/lemondom`, GET és POST). A tulajnak (a mi ügyfelünknek) szóló lapok —
  köztük a levélből nyíló egy-kattintásos döntés-lapok — a határ MÁSIK oldalán vannak.
- A döntés után a sáv eltűnik, és többé nem kérdezünk.

## Őr

`scripts/consent-check.mts` — a fenti négy tiltást méri, negatívan is.

`scripts/consent-style-check.mts` — azt méri, hogy a sávnak **VAN-E TÉNYLEGES STÍLUSA** ott,
ahol megjelenik (számított stílus + `elementFromPoint` + kontraszt, 390px ÉS asztali, önteszttel),
**és hogy a CÍMZETT-hatókör áll** — a vendég-lapokon nincs sáv/Pixel, a sajátjainkon van
(pozitív kontroll), a kettő pedig együtt mozog.

> ⛔ **Miért kellett a második őr (2026-09-14).** A `#cit-consent` szabályok a `home.css`-ben
> éltek, azt viszont egyedül a `public/index.html` tölti be — a sávot ellenben a szerver közös
> kimenete MINDEN saját lapunkra kiteszi. Mérve: **12 felületből 11 csupasz, natív gombos sávot
> kapott** (`position: static`, a lap aljára vágva), és a `/` landing volt az EGYETLEN, ahol jól
> festett — épp az, amit a `consent-check` megnyit. A stílus ezért a sáv mellé került
> (`public/assets/runtime/cit-consent.css`, tartalom-ujjlenyomattal hivatkozva), és **minden
> szabálya `#cit-consent`-tel kezdődik**: a jogi lapokon a `citui-console.css`
> `.con button{background:var(--citui-white)}` szabálya (0,1,1) különben VERI a gomb saját
> színét (0,1,0) — mérve fehér „Elfogadom" és 1,12-es kontraszt.
