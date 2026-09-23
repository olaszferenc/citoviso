## ADR-0145 — A sáv stílusa ott legyen, ahol a sáv; és a hozzájárulás-kérdés ne tegye elérhetetlenné a navigációt (2026-09-14)

- **Kiváltó (Elek, 2026-09-13, három külön kör):** FK-005b H-1 „a süti-sáv stílus nélkül, a
  képernyő bal szélére tapadva, MINDEN admin-lapon" · FK-006b HIBA-2 „a gombjai stílus nélküli,
  natív böngésző-gombok" · FK-007 H2 „a vendég-oldalon is".
- **A mért gyökér-ok:** a `#cit-consent` szabályok a `home.css`-ben éltek, azt viszont **egyedül a
  `public/index.html` tölti be** — a sávot ellenben a szerver **közös kimenete**
  (`send()` → `consentSnippet()`) teszi ki minden saját lapunkra. 14 felület végigmérve:
  **12-ből 11 csupasz sávot kapott**, és a `/` landing volt az egyetlen jó — pont az, amit a
  meglévő `consent-check.mts` megnyit. A hiba egy zöld kapu mögött ült.
- **Döntés ① — a stílus a SÁVVAL EGYÜTT utazik.** Új `public/assets/runtime/cit-consent.css`,
  amit ugyanaz az egy pont hivatkoz, amelyik a sávot kiteszi (tartalom-ujjlenyomattal). Egy
  jövőbeli saját lap nem tudja „elfelejteni" behúzni. ⚠️ **Miért nem a dizájn-magba:** a
  `withAssetVersions` MÉRTEN csak a honlapra fut, a jogi/belépés/admin lapok `citui.css`-e
  verzió NÉLKÜL hivatkozódik → a CDN 4 órás cache-e mögött a javítás nem ért volna ki. Új
  URL-nek nincs cache-bejegyzése. A `home.css`-ből a szabályok KIKERÜLTEK (egy szabály két
  példányban két igazság).
- **Döntés ② — az injektált réteg nyerjen a gazdalap CSS-e ellen.** Minden szabály
  `#cit-consent`-horgonyt kapott: a jogi lapok `citui-console.css`-ében a
  `.con button{background:var(--citui-white)}` (0,1,1) **verte** a `.cit-consent__yes` (0,1,0)-ét
  → az „Elfogadom" fehér volt a cián helyett, a másik gomb felirata **1,12-es kontraszttal**.
  (Ugyanez a csapda vitte el korábban a `.con a`-val a fizetés-gomb színét.)
- **Döntés ③ — a sáv MARAD a tenant-adminon.** A premisszát megmértem: a Pixel-betöltő
  ugyanezen a közös kimeneten kerül ki, tehát a követés ott IS megtörténne — „vegyük ki a sávot,
  de hagyjuk a Pixelt" jogszerűtlen volna, „vegyük ki mindkettőt" pedig a modul-vásárlás útjáról
  vinné el a csalásmegelőző jelzést (a vásárlás az adminból indul).
- **Döntés ④ (TULAJ, választott változat) — a hozzájárulás-kérdés NEM teheti elérhetetlenné a
  navigációt.** A helyes (fixed) sáv MÉRTEN eltakarta a tenant-admin navigációját: mobilon a
  fül-sáv alsó sorát, **11 fülből 6-ot** (Webcím, Forgalom, Dokumentumok, Üzenetek, Fiók, Súgó),
  asztalin az oldalsáv **„Kilépés"** gombját. ⚠️ **Ezt a javítás hozta be:** előtte a csupasz sáv
  `position: static` volt, tehát nem takart semmit — a §2b terv a PUBLIKUS lapra készült, és egy
  jóváhagyott terv más felületen más következménnyel jár. Megvalósítás **két irányban, egyik sem
  kitalált konstans a sávban**: a gazdalap deklarálja a fenntartott helyet
  (`--citui-consent-bottom`), a sáv pedig publikálja a saját MÉRT magasságát
  (`--citui-consent-h`, a döntés után törli), amiből az admin oldalsáv a „Kilépés"-nek tart
  helyet. **A sáv nem tud a gazdalap bútorzatáról — csak magáról közöl tényt.**
- **Hatókör-rés (a mérés közben derült ki):** az `OWN_PAGE` jelölő a `/t/<slug>` dev-ág ELŐTT
  került ki, ezért a **vendég-oldal azon az úton megkapta a sávot és a Pixelt** — amit a
  befagyasztott terv kizár. A `consent-check` ④ szabálya csak a host-utat mérte, a dev-út a
  vakfoltjában ült — és Elek a vendég-oldalt épp ezen az úton látja. A jelölő a dev-ág UTÁN
  került, a szabály mostantól **mindkét utat** méri.
- **Őr:** `scripts/consent-style-check.mts` — a RENDERELT lapon, 390px ÉS asztali: token-PROBE-hoz
  mért háttér és gomb-szín (egyszerre bizonyítja, hogy a szabály hatályos ÉS hogy a token
  feloldódott), `elementFromPoint` görgetés nélkül, kontraszt ≥ 4,5 alfa-kompozitálva,
  `@container` hatályossága, **és hogy a sáv EGYETLEN fület sem takar el**. Önteszt: 115 piros;
  a helyfoglalást visszarontva megnevezi a 6 mobil fült és az asztali „Kilépés"-t. Bekötve
  pre-commitba; a `design-token-lint` lánca is megkapta az új CSS-t.
- ⛔ **Három saját hiba, mind mérés közben:** a kontraszt-számolóm összemosta a
  `color(srgb 0..1)` és az `rgb() 0..255` formátumot (a jó prózát 1,22-vel „bukónak" mondta) ·
  a README PRÓZÁJÁBÓL mértem a mobil elrendezést, nem a jóváhagyott KÉPBŐL (a doksi „egymás alá"-t
  írt, a kép fél-fél szélességű gombpárt mutat — a README-t igazítottam a képhez, mert **a kép a
  mérce**) · a ui-shotot `--public` nélkül a KONZOL lapjára lőttem, ahol nincs is sáv.
- **Visszafordíthatóság:** 🔄 additív CSS + egy jelölő-sor áthelyezése.
- **Státusz:** ELFOGADVA (tulaj, 2026-09-14, három opcióból választva). Élesítés NINCS (§0.3).
- ⚠️ **Sorszám:** két PÁRHUZAMOS szál `0143`/`0144`-et tartott a közös fa indexében landolás
  előtt, ezért ez a blokk `0145`. Ha azok nem landolnak, a sorszám hézagos marad — ez
  ártalmatlan; az ütközés nem lett volna.
