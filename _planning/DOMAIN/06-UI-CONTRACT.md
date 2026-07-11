# 06 — UI-KONTRAKTUS (modul-megjelenítés archetípus-függetlenül)

> **A probléma:** ha lesz ~100 archetípus és N modul, a modul-UI-t NEM fejlesztjük le 100×N-szer kézzel
> (az a halál). **A megoldás:** a modul két rétegre bomlik, és egyik sem skálázódik a szorzattal →
> a rendszer költsége **O(archetípus) + O(modul)**, nem O(archetípus × modul). Kapcsolódó: ADR-0011,
> [05-MODULES.md](05-MODULES.md), `assets/runtime/` (élő runtime + widget), `src/generator/*` (promptok).

## A modul két rétege
1. **Viselkedés/logika** — egyszer megírva, standard (nem UI). Egy hidratáló runtime csatolja.
2. **Megjelenés** — kétféleképp, modul-jelleg szerint:
   - **statikus/egyszerű** (galéria, felszereltség, USP, vélemény-lista, hely): a **generátor írja in-skin**
     archetípusonként (az LLM ingyen, tökéletes illeszkedéssel).
   - **komplex/interaktív/szabályozott** (foglalás/érdeklődés, fizetés, élő elérhetőség): **egy** szabvány,
     **token-témázott widget** egy slotba mountolva (egyszer megépítve, mindenhol az archetípus skinjét veszi fel).

## Két kontraktus köti össze

### A) Téma-kontraktus (design tokenek) — a „skin mint adat"
Minden archetípus KÖTELEZŐEN kiadja ezeket a `:root`-ban. A megosztott CSS + a widgetek CSAK ezekből
öltöznek (fallbackkel) → egy widget minden archetípusban natívan néz ki. Új archetípus = kiadja a tokeneket.

| Token | Jelentés |
|---|---|
| `--cit-accent` / `--cit-on-accent` | brand-akcent + rá írt szöveg színe |
| `--cit-ink` / `--cit-muted` | fő + másodlagos szövegszín |
| `--cit-bg` / `--cit-surface` | oldal-háttér + panel/kártya-háttér |
| `--cit-line` | vonal/keret szín |
| `--cit-radius` | sarok-lekerekítés |
| `--cit-font-display` / `--cit-font-body` | címsor + törzs betűcsalád |
| `--cit-shadow` | emelkedés/árnyék |

### B) Modul-kontraktus (viselkedés-horgok) — a „forma szabad, a kapocs fix"
A modul-slot markupját az archetípus adja (LLM in-skin), DE stabil horgokkal, amikre a runtime csatol:
- `data-cit-module="<típus>"` — a slot típusa (`booking`, `gallery`, `reviews`, …). A runtime ezt keresi.
- `data-cit-variant="<forma>"` — elrendezés-variáns (pl. `bar` | `card`), hogy a widget az archetípushoz üljön.
- modul-specifikus dat-attribútumok (pl. booking: `data-cit-name`, `data-cit-email`) — a viselkedés inputja.
- A runtime idempotens: egy slotot egyszer hidratál (`data-cit-ready`).

## A számla
- **Új archetípus ≈ O(1):** kiadja a tokeneket + a modul-slotokat a horgokkal; az LLM in-skin megírja a statikus modulokat.
- **Új modul ≈ O(1):** egy viselkedés-handler a registryben + (ha komplex) egy token-témázott widget + a generátor tanítása.
- **Nincs 100×N.** A drága rész (archetípusonként testre szabott markup) a statikus moduloknál az LLM dolga (ingyen), a komplexnél egy témázott widget veszi át.

## Állapot
- **Kész (élő, kredit nélkül validált):** téma-kontraktus + modul-kontraktus + hidratáló runtime
  (`assets/runtime/cit-runtime.js`) + interaktív widgetek:
  - **booking/érdeklődés** (`cit-modules.css` + a runtime) — több témájú fixture-rel bizonyítva.
  - **gallery/lightbox** (2026-07-11) — PROGRESSZÍV FEJLESZTÉS: a valós `<img>`-ek in-skin maradnak
    (JS nélkül is látszanak → nincs üres sáv), a runtime a `data-cit-module="gallery"` horgon
    csatol egy megosztott, token-témázott lightboxot (klikk/Enter nyit, ◄►/nyilak lépnek, Esc/scrim zár,
    fókusz-visszaadás). Fixture: `assets/runtime/fixtures/gallery.html`.
  - **map/location** (2026-07-11) — PE + ADATVÉDELEM: az in-skin cím + „Útvonaltervezés" link marad
    (JS nélkül működik); a `data-cit-module="map" data-cit-query="<valós cím|lat,lng>"` horgon a runtime
    egy „kattintásra betöltő" facade-ot ad, a Google-embed iframe CSAK opt-in után töltődik. Nincs query → nincs modul.
  - **reviews/carousel** (2026-07-11) — TÉNYHŰSÉG: csak a generátor által in-skin megírt VALÓS
    vélemény-kártyák; a `data-cit-module="reviews"` slot `[data-cit-track]`-je ≥2 kártyánál snap-carousellé
    válik (prev/next + pontok). JS nélkül görgethető/egymás alatti lista. Fixture: `map-reviews.html`.
- **No-JS üres-sáv védelem (QA-fix, 2026-07-11) — RÉTEGES**, a `src/generator/runtime.ts::injectRuntime`-ban:
  1. **Booking-slot fallback:** az ÜRES `data-cit-module="booking"` slotba determinisztikusan témázott statikus
     érdeklődés-kártya (mailto, ha van valós email). JS-sel a runtime `slot.textContent=""`-tal lecseréli az interaktív widgetre.
  2. **Scroll-reveal háló:** a `<head>`-be (a) egy szinkron script, ami a `cit-anim` osztályt teszi a `<html>`-re
     az archetípus-CSS előtt, és (b) egy `<noscript>` háló, ami a hide-by-default reveal-tartalmat (`[class*="reveal|fade|
     inview|appear|animate"]`, inline `opacity:0`) láthatóvá kényszeríti JS nélkül. Kiváltó: a `vertical-timeline-scroll`
     archetípus JS nélkül 76%-ban láthatatlan volt (email-kliens = üres mock). Fix után: 0%.
  - **Scroll-reveal = RUNTIME-viselkedés (nem per-archetípus):** a runtime `initReveal()` figyeli a `.reveal`
    elemeket és `.in`-t tesz rájuk scrollnál (IntersectionObserver), + felteszi a `cit-anim`-ot. **Miért kellett:**
    a per-archetípus IO törékeny — ha az LLM a gated CSS-t megírja (`.cit-anim .reveal{opacity:0}`) DE az observert
    elfelejti, a tartalom JS-sel ÖRÖKRE rejtett marad (valós mobilon üres sáv; a no-JS teszt ezt NEM fogja el,
    mert ott nincs `cit-anim`). 2026-07-11 GRANDIS-eset bizonyította.
  - **Forrás-szabály (mindkét prompt):** a scroll-reveal KÖTELEZŐEN progresszív fejlesztés — a tartalom alapból látszik,
    a rejtendő elem `.reveal` osztályt kap, a rejtés a `.cit-anim` mögött; **a `.cit-anim`-ot ÉS a `.in` felszabadítást a
    runtime végzi — az archetípus NE írjon saját IntersectionObserver-t.** A szekciók simuljanak a tartalomhoz
    (nincs fix/nagy vh/min-height, ami űrt hagy — főleg mobilon).
- **Következő modulok:** `reviews` valódi Google-review-enrichmenthez kötése (ma ritkán van adat);
  további interaktív modulok ugyanezen registry-minta szerint.
- **Tényhűség a mockban:** a booking-widget NEM hazudik elérhetőséget/árat — érdeklődés/foglalási IGÉNYT állít
  össze (dátum + létszám + üzenet); élő foglalás/fizetés = konverzió utáni Szint 4.
