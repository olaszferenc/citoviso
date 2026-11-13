# „Kérdése van?” + egy kattintásos indítás a lead-lapon (JÓVÁHAGYOTT TERV, 2026-11-12)

A tulaj döntése a §2b terv-körben (2026-11-12, a koordinátoron át): a 2. kör **T2** változata (csomagok
KÜLÖN LAPON), a kérdés-rész a C változat (ár a kártyán + kész kérdések harmonikában + EGY szabad kérdés
mező, csevegő NINCS). Döntés: ADR-0440. A terv-körök jelentései: `~/rc-briefs/konverzio-terv/kerdes-inditas-jelentes{,-2}.md`.

Kattintható terv: `plan.html` (önhordó; méret-váltó, korlát-próba gombok, csomag-lap, indítás, rendelés,
mérés-napló). A megvalósítás képei (`megvalositas-*`) a valódi runtime egy valódi dev-mockon (Artemisz
Panzió, dev árlista), a terv képei (`terv-T2-*`) a mock állapot-sorai.

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css` · `src/replies/pageQuestion.ts` · `src/trial/package.ts` · `src/trial/start.ts` · `src/legal.ts` · `src/generator/configurator.ts` · `src/console/server.ts`

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Hely és horgonyok.** A `/p/<token>` lap (hideg lead, nem saját-vásárolt, nem `/folytatas`) a hős után
   egy blokkot kap (`CFG.ask`): `#ar` = az ár-kártya blokkja, `#kerdes` = a „Kérdése van?” rész,
   `#inditas` = a hash az indító lapot nyitja, `?k=<kategória>` (ar, koltseg, benne, utana, lemond, kik,
   nemkerem, beallit) a kész választ nyitja ki — `#ar`-ral együtt is (`?k=ar#ar`). Ezekre épülnek a
   viselkedés-üzenetek (cit3ea34be2) és a tulaj által jóváhagyott válaszok linkjei.
2. **Ár-kártya.** Címke „Ahogy most látja” (a teljes, mindent mutató csomag ára), vagy választás után
   „Az Ön választása: X” + „Alaphelyzet”. Alatta: az első díj a bevezető kedvezménnyel (csak ha él),
   a legkisebb csomag havi ára, 3 tény (csak ami igaz), **EGY fő gomb: „Indítsa el”** („{n} nap ingyen ·
   kártya nélkül”), alatta két másodlagos elem: **„Megrendelem most, próba nélkül”** (link) és
   **„Csomagok és modulok”**. Próba nélkül (kikapcsolva / már volt) a fő gomb „Megrendelem” és a
   rendelő-panelt nyitja. Asztalon (≥ 900 px blokk-szélesség, `@container`) a kártya jobbra ragad, a
   kérdések balra; telefonon a kártya van elöl.
3. **Kérdések.** 8 kész kérdés harmonikában (egyszerre egy nyitva), minden válasz a lap adataiból áll
   össze a lapon: árak (`presets`/`modules`/`pricing`), a próba napszáma, a bevezető %, a szolgáltató
   adatai (`config.legalEntity`, **telefonszám nélkül**). ⛔ Nincs LLM- és API-hívás látogatásonként.
   Minden válasz alatt „Indítsa el” gomb (ha a próba indítható).
4. **Egy szabad kérdés mező** („Más kérdése van? Írja be…”). Kulcsszavas illesztés a kész kategóriákra →
   a válasz a harmonikában nyílik ki; köszönésre udvarias mondat; ami nem illik: „Erre most nem tudunk
   pontos választ adni. Rögzítettük a kérdését…” + a 3 leggyakoribb kérdés. **Csevegő felület nincs.**
5. **Spam-korlát CSAK a szabad kérdés mezőn** (tulaj 2026-11-12: a 20/nap és 60/IP/óra kevés):
   300 karakter · 4 mp két kérdés között (a mező addig zárva, „Egy pillanat… {n} mp”) ·
   **100 kérdés / lead / budapesti nap** · **5 rögzített (illeszthetetlen) kérdés / lead / nap**, a 6.-tól
   „Ma már több kérdést rögzítettünk Öntől…” · **300 kérdés / IP / óra** (minden lead-linken együtt) ·
   link, domain, e-mail-cím vagy telefonszám a szövegben → nem tároljuk, a lap megmondja · ugyanaz a
   kérdés újra → nem számít. A plafon elérése után a mező lezárul, **a kész kérdések működnek tovább**.
   Szerver: `POST /p/<token>/ask` (`src/replies/pageQuestion.ts`), napló: `prospect_question` (0134).
6. **⛔ Automatikus válasz kifelé NINCS.** Az illeszthetetlen kérdés a tulaj jóváhagyó sorába megy
   (`outreach_reply`, `source_key` `page:<id>`, tárgy „Kérdés a terv lapjáról”, a csatorna az a cím, amin
   a leadet elértük: e-mail, különben a mobil). Poe javasolhat, a választ a TULAJ hagyja jóvá (2026-10-27).
   Leiratkozott lead kérdése és a saját nézet (`?sajat=1`) tárolódik, de sosem kerül a sorba.
7. **„Csomagok és modulok” = KÜLÖN LAP (T2).** Telefonon alulról, asztalon középen. A csomagok kártyán
   egymás mellett, tartalommal („Minden az előző csomagból (X), és:”), a mindent mutató csomagon
   „Ahogy most látja”. **„Testre szabom modulonként”** nyitja a modullistát: a legkisebb csomag tételei
   szürkén, mindig benne; a kötelező párok (ADR-0192) bekapcsoláskor maguktól jönnek, kimondva
   (a katalógus `why` mondatával), a levett modul nélkül nem működők is lemennek, kimondva. A kártya ára
   élőben követ. Kilépés: **„Kész, vissza”** vagy **„Indítsa el ezzel”**.
   **Aki nem nyúl hozzá, annak nincs plusz döntés:** az indító lapon „Csomag: ráér” + mit ad a próba.
8. **Egy kattintásos indítás** (az indító lap — a régi próba-űrlap helyén, `.cit-cfg-tsheet`):
   cím „Indítsa el {a/az} {szállás} honlapját”, „Egy gombnyomás, és az oldal azonnal él.”, a saját
   aldomain, 4 tény, a csomag-sor, a kapcsolat **előtöltve** (név = a szállás neve, a lead mobilja, a
   megkeresés e-mail-címe) és csak **„Módosítom”**-ra nyílik mezőkké (hiányzó/rossz előtöltésnél
   eleve nyitva), a gomb **„Indítsa el”**. A mezők szabálya a `POST /p/<t>/trial` szerződése (név ≥ 2,
   e-mail, `PHONE_NORM_JS`), hibánál a mező kinyílik, az üzenet alatta.
   **Választás → a próba AZZAL fut** (tulaj ③): a kérés `modules` mezője; a szerver
   (`trialModulesFromSelection`) csak az eladható, kapcsolós katalógus-modulokat veszi, a gerincet és
   minden kötelező párt hozzáteszi, és pontosan ezt adja `trial_grant`-tal; a folytatás (fizetési link)
   ezt jelöli elő. Választás nélkül a beállított próba-csomag fut.
9. **Click-wrap (tulaj ⑦): EGY mondat a gomb alatt** — `TRIAL_CLICKWRAP_V1`, az ÁSZF és az Adatkezelési
   tájékoztató linkelve; ez áll a két régi pipa (ÁSZF + §A fotó-nyilatkozat) helyén, és szó szerint ez
   kerül a `free_trial.terms_text` / `photo_rights_text` oszlopba (`clickwrap: true`).
10. **A pirula-pár új szerepe a kérdés-oldalon** (próbával): bal **„Indítsa el”** („{n} nap ingyen”,
    platform-cián — a fő lépés), jobb **„Mennyibe kerül?”** („havi X Ft-tól”, sötétkék) → az
    ár-kártyához görget, a panelt NEM nyitja. Amíg a kártya a képernyőn van, a pár (és a telefonos
    sáv) félreáll. A pár helye, kikerülése (ADR-0242/0377/0382/0396) változatlan.
11. **Próba nélküli rendelés (tulaj ②: másodlagos link marad).** „Megrendelem most, próba nélkül” (kártya)
    és „Inkább most megrendelem, próba nélkül” (indító lap) → a MEGLÉVŐ rendelő-panel, a választott
    halmaz előre bepipálva. Az első díj −{p}%, évesnél az egész első éves díjra (tulaj ④ — a meglévő
    `applyOffer` éves díjon így számol).
12. **A cég telefonszáma MINDENHONNAN kimarad** (tulaj ⑧): a válaszokból, a platform-levelek lábléceiből,
    a rendelési levelek kapcsolat-sorából és az ADR-0417 belépés-emlékeztetőből („Ha elakadt, hívjon
    minket” törölve). A jogi oldalak (Impresszum, ÁSZF) nem változtak — lásd ADR-0440 nyitott pont.
13. **SMS ékezet nélkül (GSM-7)** — ebben a körben nem született új SMS-szöveg; a meglévő próba-SMS-ek
    már GSM-7-ek (`src/sms/encoding.ts`).
14. **i18n (§B.18):** minden vevő-oldali felirat `tr("…")`; a magyar névelő ({a/az}) csak magyar lapon.

## Eltérés a tulajnak mutatott T2 mocktól (mérnöki döntés, a jelentésben is)

- **Közvetlen rendelés:** a mock saját egyszerűsített rendelő lapot rajzolt (név, irsz., település,
  utca, adószám → Barion). A megvalósítás a MEGLÉVŐ rendelő-panelt nyitja a választással: a fizetés jogi
  kellékei (vevő-típus, elállási nyilatkozat, ismétlődő terhelés hozzájárulása, VIES, ár-ellenőrzés)
  ott élnek és őrzöttek; egy második checkout két, egymástól elcsúszó igazság volna.
- **E-mail:** a mockban „E-mail-cím (nem kötelező)” állt; **kötelező maradt**, mert a belépés, a számla
  és a próba-értesítők e-mailre épülnek (`tenant_user.contact_email` NOT NULL). Előtöltve jön, ha van.
- **A hős-gomb** („Mennyibe kerül? · havi X Ft-tól · 14 nap ingyen” a sablon hősében) helyett a pirula-pár
  bal tagja viszi ugyanezt — 21 sablon hősébe nem nyúlunk (a hős-cím és -gombok őrei).
- **Az érdeklődés-továbbítás SMS-ben** nem épült (cit3ea34be2-vel egyeztetve); a lap nem ígéri.

## Mérés (mock_event, a meglévő `track()` gerincen)

| esemény | payload | mikor |
|---|---|---|
| `price_open` | `{via:"pill"}` | „Mennyibe kerül?” pirula |
| `ask_q` | `{q, via}` | kész válasz nyílt (faq / text / chip / link) |
| `ask_free` | `{q}` | szabad kérdés (q = kategória vagy null) |
| `ask_blocked` | `{code}` | long / gap / dup / link / day / ip |
| `pkg_open` · `pkg_tier` · `pkg_module` · `pkg_reset` | | csomag-lap |
| `launch_edit_contact` · `launch_go` | `{pkg, via}` | indító lap |
| `order_open` | `{from}` | próba nélküli rendelés |
| `trial_open` / `trial_submit` / … | | a régi próba-események változatlanul |

## Kötő feliratok (contract-drift-check)

**„Kérdése van?”** · **„Indítsa el”** · **„Megrendelem most, próba nélkül”** · **„Csomagok és modulok”** ·
**„Ahogy most látja”** · **„Mennyibe kerül?”** · **„Inkább most megrendelem, próba nélkül”** ·
**„Testre szabom modulonként”** · **„Indítsa el ezzel”** · **„Kész, vissza”** · **„Csomag:”** · **„ráér”** ·
**„Más kérdése van? Írja be…”** · **„Rögzítettük a kérdését, és a válaszaink bővülnek vele. Addig ezek segíthetnek:”** ·
**„Egy pillanat… {n} mp”** · **„Mára elérte a {n} kérdést. A fenti kérdésekre továbbra is azonnal válaszolunk, holnap újra írhat.”** ·
**„Az értesítéseket ide küldjük:”** · **„Kérdés a terv lapjáról”**

## Kötő horgony

- `id="ar"`
- `id="kerdes"`
- `#inditas`
- `cit-ask__go`
- `cit-ask-pk`
- `data-pk="go"`
- `clickwrap: true`
- `trialModulesFromSelection`
- `TRIAL_CLICKWRAP_V1`
- `/ask`

## Képek

`terv-T2-mobil.png` · `terv-T2-asztali.png` (a jóváhagyott mock állapot-sorai) ·
`megvalositas-{mobil,asztali}-{pirulak,ar-kartya,csomagok,indito,elindult}.png` (a runtime egy dev-mockon).
Ellenőrzés: `assets/design-refs/_drafts/kerdes-inditas/impl/click.mts`-mintájú végigkattintás 390 px és
1280 px, JS-hiba 0; szerver: `scripts/page-question-check.mts`, `scripts/free-trial-check.mts` ⑮.
