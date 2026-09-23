## ADR-0206 — A számlázó környezetek szétválasztása: három fiók, két őr, nulla bizalom

**Dátum:** 2026-09-22 · **Státusz:** elfogadva (tulajdonosi utasításra, élesben végrehajtva)

**Kontextus.** A nap három élesítést hozott (Barion Full Pixel, éles POS, éles számlázás), és a
végén derült ki, hogy a számlázó kulcsaink **fel voltak cserélve**. A tulaj vezérlőpultja mutatta
meg a valóságot, amit a konfigból nem lehetett kiolvasni: **három** Számlázz.hu-fiók él —
`Olasz Ferenc (OLASZ)` (régi, megszűnt adószám), `Olasz Ferenc (CITO)` (éles, 92227011-1-33),
és `TESZT OLASZ Ferenc (OV)` (tartós **tesztüzem**). Az éles `.env`-ben a TESZT fiók kulcsa futott,
a devben pedig az ÉLES fiók kulcsa — vagyis a bekapcsolt éles számlázás jogilag nem létező
számlát adott volna, a dev viszont VALÓDIT, egy ~25 szálas gépen.

**Ami a tévedést lehetővé tette.** A kulcs **opálos**: a `zcv8srk7…` alakból semmi nem árulja el,
melyik fiókhoz tartozik, és a hitelesítés-próba sem — mindkét kulcs ugyanazt a „7: ismeretlen
számlaszám" választ adja (a negatív kontroll, egy rossz kulcs, helyesen 3-ast). Mellékhatás-mentes
fiók-azonosító **nincs**: egy számla kiállítása mindkét éles fiókban valódi bizonylatot szülne.
A tényt tehát csak a szolgáltató felülete mondta meg — a mi oldalunkról ez **elvileg mérhetetlen**.

**Döntés.**
1. **Fiók-szerep kötve:** prod = CITO (éles), dev = OV (tesztüzem), a régi OLASZ = **sehol**.
2. **A védelem nem fegyelem, hanem szerkezet** (`src/invoicing/keyGuard.ts`), a **boot-ponton** —
   mert az éles `.env`-t kézzel is szerkesztjük (ma kétszer), és a git-kapukat az env-módosítás
   megkerüli; a bootot semmi.
   - **Denylist** (SHA-256 ujjlenyomat): a régi fiók kulcsa sehol nem indulhat.
   - **Allowlist** dev-en: KIZÁRÓLAG a saját teszt-módú fiókunk kulcsa (vagy `SZAMLAZZ_DEMO=1`)
     építhet szamlazz-providert. ⭐ Allowlist, nem denylist: egy **ismeretlen** kulcs dev-en
     tiltott, így egy véletlenül bemásolt éles kulcs nem gyárthat NAV-hoz beküldött számlát.
   - Kulcs **soha nem kerül a repóba**, csak ujjlenyomat — az azonosít, de nem hatalmaz fel.
3. **A dev valódi teszt-számlát állít ki** (`OV-` sorszám, „minta" vízjel, SAJÁT cégadatokkal),
   tehát fejlesztés után a számla tartalma ellenőrizhető anélkül, hogy bizonylat születne.

**Bizonyíték (mérve, nem feltételezve).** dev → `OV-2026-53`, 20 kB PDF, saját cégadatokkal ·
az ÉLES (CITO) kulcs dev-hoston **blokkolva** · a teszt-kulcs éles hoston **blokkolva** ·
`invoice-key-guard-check` 12 állítás, piros kontrollal mindkét irányban.

**Következmény.** Az „melyik kulcs melyik fiókhoz tartozik?" kérdés a jövőben sem mérhető a
kódból — ezért a **fiók-szerep dokumentált tény**, és minden kulcscsere ujjlenyomat-frissítéssel
jár. Ha egy kulcs ujjlenyomata egyik listán sincs, a rendszer **nem indul el**: ez a helyes
alapértelmezés, mert a néma rossz számla drágább, mint egy hangos leállás.
