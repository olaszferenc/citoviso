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
  (`assets/runtime/cit-runtime.js`) + az első interaktív widget: **booking/érdeklődés**
  (`cit-modules.css` + a runtime), több témájú fixture-rel bizonyítva.
- **Következő modulok:** ugyanez a registry-minta (gallery-lightbox, reviews, map…).
- **Tényhűség a mockban:** a booking-widget NEM hazudik elérhetőséget/árat — érdeklődés/foglalási IGÉNYT állít
  össze (dátum + létszám + üzenet); élő foglalás/fizetés = konverzió utáni Szint 4.
