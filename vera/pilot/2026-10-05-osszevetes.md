# Vera próbafeladat — összevetés: Vera · API-tényőr · Vendég-kritikus · Neo (2026-10-05)

Belső anyag. Forrás:
- Vera jelentése: `~/vera/jelentesek/2026-10-05-pilot20.md`, napló: `~/vera/naplo/2026-10-05.md` (vakon dolgozott, csak `source-pack.json` + mock).
- API-őrök: éles DB, csak olvasva (`~/rc-briefs/vera-pilot-data/`: `pilot.json`, `verdicts.json`, `vk.json`).
- Neo: `~/neo/jelentesek/2026-10-05.md`, „Poe-pilot” szakaszok.

Pilot: 5 lead × 4 mock = 20 mock, ebből 10 az AI-ágról, 10 a Poe-ágról (Poe kézi szövege, API csak az őröké).

## 1. Tábla mockonként

Jelmagyarázat: **Vera** = ítélet (blokkoló / javítandó sorok száma) · **Tényőr** = `factVerdict` (+ `factUnsourced` tételek) · **VK** = vendég-kritikus (`guestCriticVerdict`, blokkoló kifogás) · **Neo** = §7 sor.

| mock | ág | Vera | Tényőr | VK | Neo | eltérés |
|---|---|---|---|---|---|---|
| 1A 8beda440 | ai | **FLAG** 8B/3J: idegen fotók (Fitromax, Park V., Kristály), kitalált „kutyabarát”, kitalált vendég-vélemény | PASS | pass | idegen fotók a leadnél, „egyik ág sem küldhető” | **csak Vera** (a tényőr 0 állítást talált) |
| 1B 139e361b | ai | **FLAG** 11B/4J: idegen fotók képaláírással, kitalált kert + kutya + vendég-idézet | FLAG: Park V. / Kristály nevesítve, „fotó 8” 5 képnél | FLAG: „gondozott kertnél” | kurátor-sor | mindkettő fogja; Vera a kertet, a kutyát és a kitalált véleményt is |
| 1C 7ef225ef | poe | **FLAG** 3B/0J: csak idegen fotók, a szöveg tiszta | FLAG: Park V. / Kristály nevesítve | pass | NE KÜLDJÜK | egyezik (a tényőr a KÉPALÁÍRÁST fogta, Vera magát a képet) |
| 1D 41408330 | poe | **FLAG** 5B/0J: idegen nyitókép + galéria | PASS | pass | idegen NYITÓKÉP, „súlyosabb” | **csak Vera + Neo**: a képaláírás itt a Katica nevét viseli, ezért a tényőr nem látta |
| 2A 7906c337 | poe | PASS 0B/1J | PASS | pass | KÉSZ | — |
| 2B 1168c30a | ai | **FLAG** 1B/1J: kitalált „elégedett, visszatérő vendégek” 3× (0 vélemény a csomagban) | PASS | pass („csendes” J) | ✅ | **csak Vera** |
| 2C 3b81e507 | poe | PASS 0B/2J | PASS | FLAG: „Ingyenes parkoló 10 méterre” | JAVÍTANDÓ, de a parkoló-kifogás „őr-következetlenség” | Vera és Neo szerint a VK-blokk hamis (forrás: „ingyenes, 4 db, 10 m”) |
| 2D 54a6875a | ai | PASS 0B/3J | PASS | pass | ✅ | — |
| 3A e2389b82 | ai | **FLAG** 1B/5J: „Reggeli” | PASS | FLAG: „karnyújtásnyira” | kurátor-sor | Vera a reggelit blokkolja, a „karnyújtásnyit” csak J-nek veszi |
| 3B db392d08 | poe | **FLAG** 1B/3J: „Reggeli” | PASS | pass | KÉSZ (azonosság tisztázásával) | **csak Vera** |
| 3C 702fe5ba | poe | **FLAG** 1B/2J: „Reggeli” | PASS | pass | KÉSZ (azonosság tisztázásával) | **csak Vera** |
| 3D 13b4285e | ai | **FLAG** 1B/2J: „Reggeli és saját konyhás apartmanok” | PASS | pass | ✅ | **csak Vera** |
| 4A 18db9639 | ai | **FLAG** 1B/3J: „negyedórás séta” ↔ forrás: 25 perc | PASS | pass (ugyanez csak J) | ✅ | **csak Vera** blokkol (a VK látta, de javítandónak) |
| 4B f7762a15 | ai | PASS 0B/4J | PASS | pass | ✅ | — |
| 4C dbfa1d41 | poe | PASS 0B/2J | FLAG: „Stúdió 4 fő”, „Stúdió típus”, „leggyakrabban … csendes …” | FLAG: „csendes” ×2 | NE KÜLDJÜK | **csak az őrök + Neo** (lásd 2.3) |
| 4D d3987c68 | poe | PASS 0B/3J | FLAG: „Férőhely 4 fő”, „Stúdió” | FLAG: vélemény mint szolgáltatás | JAVÍTANDÓ | **csak az őrök + Neo** (lásd 2.3) |
| 5A 5e8174bc | ai | **FLAG** 2B/4J: kitalált pékség + „falu közepén”; kád + zuhany → „két fürdőszoba” | PASS | pass | ✅ | **csak Vera** |
| 5B 45197aec | ai | **FLAG** 3B/6J: „Badacsony 10 perc” (a 10 perc a Salföldi kőtengeré), kitalált visszatérő vendégek, „Panoráma” | PASS | pass | ✅ | **csak Vera** |
| 5C 6bba6adb | poe | PASS 0B/2J | PASS | FLAG: leltár-nyitás, „Vendég-vélemények” cím 0 véleménnyel | JAVÍTANDÓ (hős = intró, vélemény-cím) | stílus-kifogás, nem tény: Vera nem az ő dolga |
| 5D a88251a2 | poe | PASS 0B/2J (J: az intró kétszer mondja az erkélyt) | PASS | FLAG: leltár-nyitás, ismétlés | JAVÍTANDÓ (intró-duplázás) | a duplázást Vera is látta, J-ként |

**Összesen:**

| | AI-ág (10) | Poe-ág (10) | össz. |
|---|---|---|---|
| Vera FLAG | 8 | 4 | **12** |
| API-tényőr FLAG | 1 | 3 | **4** |
| VK FLAG | 2 | 5 | 7 |
| mindkettő FLAG (Vera ∩ tényőr) | 1 (1B) | 1 (1C) | 2 |
| csak Vera | 7 | 3 | **10** |
| csak a tényőr | 0 | 2 (4C, 4D) | **2** |

## 2. Mit fogott Vera, amit a tényőr nem, és fordítva

### 2.1 Vera fogta, a tényőr nem (10 mock)
1. **Kitalált vendég-hang vélemény nélkül** (1A, 1B, 2B, 5B): „A vendégek visszatérően … emelik ki”, „Elégedett vendégek térnek vissza évről évre”. Mind a négy leadnél `voice.used` üres, `realStats: null`. A tényőr mind a négyet átengedte, holott ez §B.17 szerint blokkoló (E2). **A legnagyobb hiány.**
2. **Kitalált szolgáltatás / adottság** (1A, 1B: kutyabarát; 1B: gondozott kert; 5A: pékség, „falu közepén”; 5B: panoráma).
3. **Szám–célpont csere** (4A: negyedóra ↔ 25 perc; 5B: a Salföldi kőtenger 10 perce Badacsonyra átírva). A tényőr a számot egyik esetben sem vetette össze a forrással.
4. **Összevonás** (5A: „fürdőkád és zuhanyzó” → „két fürdőszoba”, ADR-0317).
5. **Forrás-csomag hibája, ami kiszivárgott** (3A–3D: a „Reggeli” szolgáltatás a „reggeli után … megmártózzon” mondatból lett, ADR-0328; mind a 4 mock kitette, a tényőr egyiket sem jelezte).
6. **Idegen fotók** (1A, 1D): a tényőr csak a képaláírásban álló idegen nevet fogja, a képet nem nézi. 1D-n a Park Vendégházak képe „Katica Apartman Ajka” alt-tal áll, ezért észrevétlen maradt. Neo ugyanezt látta.

### 2.2 A tényőr fogta, Vera is (2 mock)
1B és 1C: az idegen szállás neve képaláírásként. Vera a képet is azonosította (URL + tartalom), és a csomagban mind a 4 idegen fotót megnevezte (#1, #2, #3, #9).

### 2.3 A tényőr fogta, Vera nem (2 mock: 4C, 4D)
- **„Stúdió · 4 fő” / „Férőhely 4 fő”**: a sablon szobák-moduljából jön, a csomagban a férőhely sehol nincs. Vera a sort látta és jegyzetbe is írta („a 4 fő a csomagban sehol nincs”), de a charter (ONTOLOGIA, U2) szerint a MINTA-jelölt blokkokat nem ítéli tényállításként. **Ez döntés-kérdés, nem vakfolt:** ha a MINTA-sor a vendég szemében tény, U2-t szűkíteni kell. Neo is rendszer-ügynek jelölte.
- **„Vendégeink leggyakrabban a csendes környezetet és a kedves vendéglátást emelik ki”** (4C): a tényőr forrástalannak, a VK forrás nélküli hangulatnak vette. Vera PASS-t adott, két vélemény („Csendes környezetben…”, „tökéletes nyugalom”) és öt „kedves” alapján. A „leggyakrabban” 8 véleményből 2-re épül, ez inkább túlzás (J), mint blokkoló. Itt **Vera engedékenyebb volt**, és a 4C-n a „csendes” is vélemény-alapú nála; a VK kifogása szerintem erősebb.

### 2.4 A VK és Neo, amiben Vera ellentmond
- **2C parkoló:** a VK blokkolta a „10 méterre ingyenes parkoló”-t, holott a forrás szó szerint „Parkoló a közelben (ingyenes, 4 db, 10 m távolságra)”. Vera és Neo egymástól függetlenül is a VK hibájának látja.
- **5C / 5D:** a VK-blokk (leltár-nyitás, üres vélemény-cím) stílus-kifogás. Vera nem ítéli (nem tényhűség), az intró-duplázást J-ként jelezte.

## 3. Mintázat ágonként
- **Poe-ág:** Vera 4 FLAG-je MIND a forrás-csomagból jön (idegen fotók: 1C, 1D; „Reggeli”: 3B, 3C). Poe szövegében Vera **egyetlen saját kitalálást sem** talált. A tényőr 3 Poe-FLAG-jéből 2 (4C, 4D) a sablon szobák-moduljáé, nem Poe szövegéé.
- **AI-ág:** Vera 8 FLAG-je közül 6-ban (1A, 1B, 2B, 4A, 5A, 5B) a szöveg-generátor talált ki tényt; a tényőr ebből egyet fogott (1B, azt is a képaláírás miatt).
- Ez megfordítja Neo délutáni következtetését („Poe kézi szövegét az őrök szigorúbban ítélték”): **tényhűségben** a Poe-ág a tisztább, az őrök az AI-ág kitalálásait engedték át.

## 4. Csomag-hibák, amiket Vera a forrás-csomagban talált (nem a mockon)
- Katica: 22 fotóból 4 idegen (hovamenjek: Fitromax, Park Vendégházak, Kristály Hotel, 18064-es hely).
- Csopaki: 23 fotóból 4 idegen (a község portálja: szőlőhegy, ÓVODA bejárata, nagykonyhás étel, tanösvény-tábla); „Reggeli” és „Garázs” a leírásból (a leírás szerint „Garázs: nincs”); névazonosság nem dönthető (Csopaki Apartman ↔ Apartmanház Strand Csopak ↔ „vadvirág” e-mail).
- Betérő: „Kert” `origin: description` a „Kertek” / „Állatkert” szóból; „Saját parkoló” és „Parkoló a közelben” egyszerre.
- Gólyásház: „Strand” (4 km-re van) és „Panoráma” `origin: description`.
- Minden mockon: „Hungary” a magyar címben (J); csillag a Betérő kép-altjaiban; „… környezete” alt belső képen.

## 5. Idő és költség

### Vera — ELŐFIZETÉSI KERET (nem API-dollár)
- **Idő (napló):** forrásgyűjtés leadenként ~1 perc (összesen 5:35), mock-ítélet 0:26–1:29 (összesen 13:56). **Aktív munka ~19,5 perc, ≈ 58 mp/mock.** Fali idő 15:27:36–16:05:14 = 37,6 perc; a különbség a leadenkénti automatikus tömörítés (+10 perces védőidő a figyelőben) és az indulás.
- **Keret (tok.py, `~/.claude/projects/-home-citoviso-wt-vera`, 2026-10-05T13:15Z–14:15Z):** 157 hívás, opus-5-5, 12,7M cache-olvasás, 0,13M kimenet → **$8,46 API-egyenérték ≈ $0,42/mock API-egyenérték.** Előtte 0, utána $0,08 (záró üzenet).
- Ez **előfizetési keret**, nem kifizetett pénz: 1 API-$ ≈ 2 cent → a 20 mock ≈ **17 cent** valós előfizetési érték (≈ 0,85 cent/mock), a ~$2 275-ös heti keret **0,37%-a**.

### API-őrök — VALÓS API-DOLLÁR (`pilot.json` byStep, ugyanerre a 20 mockra)
| | AI-ág (10) | Poe-ág (10) | össz. | /mock |
|---|---|---|---|---|
| verifyFactuality (tényőr) | $0,694 | $0,671 | **$1,365** | **$0,068** |
| mind a 4 őr-lépés (tény + piac + VK + VK-átírás) | $2,745 | $1,162 | $3,907 | $0,195 |

Összevetve: a tényőr mockonként $0,068 valós API-dollárba kerül, és 12 blokkolós mockból kettőt fogott meg. Vera ugyanerre ~0,85 cent előfizetési értéket használt fel (API-egyenértékben $0,42), és ~1 percet. ⚠️ A két szám nem ugyanaz a mértékegység: az egyik pénz, a másik keret. A keret véges (heti), a 20 mock ennek 0,37%-a.

## 6. Nyitott kérdések a tulajnak (a koordinátoron át)
1. **U2 — MINTA-blokkok:** a sablon szobák-moduljának „Stúdió · 4 fő” sora a vendégnek tény. Ítélje-e Vera? (Ha igen: charter-módosítás. Neo szerint egyébként is rendszer-ügy a sablonban.)
2. **Vera tanulság-javaslata** (E4/E5): minden `origin: description` tételt és minden szám–célpont párt vissza kell keresni a leírásban. Mehet-e a `~/vera/tanulsagok.md`-be szabályként?
3. **Éles Vera-fiók:** még nincs, élesi írás kellene hozzá. Addig Vera a tesztelői fiókkal csak olvas.
4. **2. fázis** (az API-tényőr kiváltása Vera ítéletével): TILOS a tulaj döntéséig. Ehhez ez a tábla a döntési anyag.
