## ADR-XXXX — Tenant-admin szakasz-hierarchia: zónák, tartalomjegyzék, tónus-tömbök (az „E” nyelv)

**Dátum:** 2026-10-21 · **Kontextus:** a tulaj képpel (az „Amit kínál” lapról): az admin „annyira plain egyszerű, hogy semennyire nem vezeti a szemét”, minden szekció ugyanúgy néz ki, egy összetett allap „pár görgetés után a szemnek teljes káoszba fullad, nem tudom, mit hogy kell nézni, mi mihez tartozik”. Kikötése: ne legyen csicsa, az egyszerű alap jó, „csak ez így most túl egysíkú”. Két §2b kör: négy szerkezet (A Fejezetek · B Oldal-térkép · C Harmonika · D Tónus-lépcső) → „a B és D hibrid lenne a jó” → három hibrid (E · F · G) → **E**. Kontraktus: `assets/design-refs/tenant-admin/szakasz-hierarchia/`. **Megtartja:** ADR-0224 (Linear: szín csak jelentésre), ADR-0021 ① (tokenek), a season-datepicker és az ellatas kontraktus viselkedését. **Érinti:** ADR-0045 §J / ADR-0220 (a modul-képernyők súgó-képei újralőve).

### Döntés
1. **A modul-képernyő feje a modul neve.** A h1 a modul neve, fölötte a „‹ Vissza a modulokhoz” kicker, alatta egy meta-sor (díj az előfizetés ütemében + „Útmutató ehhez a képernyőhöz”). A fül „Modulok” h1-e nyitott modulnál elmarad. Ez MINDEN modul-képernyőre áll (`moduleSettingsSection`; az Online foglalás a saját navy fejléc-blokkját tartja, booking-screen kontraktus).
2. **Zónák.** Az összetett lap tartalma zónákba rendeződik, a zóna címe kisbetűs, ritkított, hajszálvonallal (`.adm-zone`, `.adm-zone__h`). Az Árak lapon: bevezető doboz · „Szobánkénti árak · N szoba” (csak egyben kiadott háznál „Az egész ház ára”) · „Az egész szállásra” (Ellátás + Szabályok).
3. **A szobák egymás mellett** széles képernyőn (≥ 900 px, `auto-fit minmax(340px,1fr)`), telefonon egymás alatt. Következmény: a kártya űrlapja széles képernyőn is keskeny, ezért a szezon-naptár a folyamban nyílik és egy hónapot mutat — a season-datepicker elve (az űrlap saját szélességét követi) változatlan; a `season-year-price-check` ezt az űrlap méretéről olvassa, nem az ablakéról.
4. **Szakasz-fejléc:** nagy cím (19 px), ikon, alatta egy sor a pillanatnyi értékekkel (szobánál „Alapár {összeg} Ft · {n} időszak” / „Még nincs alapár”), elválasztó vonal nélkül (`.adm-card--sec`, `.adm-card__sum`).
5. **Tónus-tömb alszakaszok** (`.adm-blk`): minden kérdés egy `--citui-surface-2` tömb, kisbetűs tömb-címmel; a mezők a panel színét viselik. Szint: lap → kártya → tömb → mező. A szoba-kártya „Alapár” mezőjének címkéje csak felolvasónak szól (`.adm-vh`), mert a tömb címe mondja ki.
6. **Ragadós tartalomjegyzék** („Ezen a lapon”, `.adm-toc`, szerver-oldalon, zónánként csoportosítva): ≥ 1100 px-en jobb oldali sáv, alatta csipkesor a felső sáv alatt (vízszintesen görgethető, a layoutot nem szélesíti). A képernyőn lévő szakaszt egy kis szkript jelöli (listában + a kártya bal élén cián csík) — ez az egyetlen szín a lapon.
7. **Szín nem változik**, új hue nincs; sötét módban ugyanazok a tokenek.
8. **Hatókör ebben a körben:** az 1. pont minden modul-képernyőn; a 2–6. az Árak lapon. A többi összetett lap (Szobák, Online foglalás, Amit kínál) ugyanezt a CSS-réteget kapja a következő körben, új tulaj-döntés nélkül (a nyelv ugyanaz).

### Kód
`public/assets/ui/citui-admin.css` §12 · `src/server/moduleConfigViews.ts` (`moduleSettingsSection` fej + `RULES_MARK`, `pricingEditor` zónák, `tocNav`/`tocScript`/`roomSummary`, `mealsCard` tömbök) · `src/server/adminViews.ts` (`pageHead`) · a szerkezetre kötött őrök horgonyai: `price-where-check` (a doboz saját attribútumáról vág), `price-on-request-check` (a kártyát a következő `id="ar-"`-ig vágja), `season-year-price-check` (űrlap-szélesség) · `kb/entries/admin-modules-*/assets/hu/*.png` (kb-shot, determinisztikus).

### Visszafordíthatóság
🔄 könnyű: nézet + CSS, adat és séma nem változott; a kicker/fej egy függvényben él.
