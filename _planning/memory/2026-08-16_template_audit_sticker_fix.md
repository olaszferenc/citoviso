# 2026-08-14→16 — Sablon-audit: dopamine matrica-átfedés + dark-luxury szél-levágás (éles fix)

## Mi történt
- **Tulaj-riport (screenshot):** az élő `sport-udulo.citoviso.com` hero-címébe belelógott a lebegő
  „Balaton északi part" matrica (dopamine sablon).
- **Gyökérok:** a `.t-s1/.t-s2` matricák fix `top:15%/29%` pozíción ültek — ez pont a (változó
  magasságú) címsor sávja, széles címnél garantált ütközés.
- **Fix (dopamine):** a matricák a címsor-sávon KÍVÜLI horgonyra kerültek —
  fotós hero: a hero-fotó felső sarkai (új `.t-heroimgwrap` relatív wrapper);
  flat hero (live fotó-politika = nincs kép): az üres alsó sáv (`bottom`, a sub/CTA alatt).
- **Audit mind a 7 sablonra** (éles sport-inputokból renderelve, 1500px + 390px):
  **dark-luxury BUG:** `.t-heroin{width:100%}` felülírta a `t-wrap` `min(1200px,92%)` korlátját →
  a cím a viewport bal széléig folyt és a betűk levágódtak — a `width:100%` törölve.
  A többi 5 sablon (fullbleed, card-sidebar, editorial, parallax, brutalism) tiszta.

## Éles deploy (tulaj scope-olt engedélyével)
- `src/engine/templates/{dopamine,darkLuxury}.ts` scp → `/opt/citoviso/app` (root-owned, 644);
  `citoviso-console` + `citoviso-public` restart.
- Sport-udulo snapshot újrarender **a kanonikus úton**: szerver-oldali egyszeri tsx-script hívta a
  `rerenderTenantSnapshot(tenantId)`-t (megőrzi az `edited_site_data` tulaj-szerkesztéseket + a
  §A live fotó-politikát). Élő URL-en screenshot-tal verifikálva.
- Lokál commit `336fcc3`, GitHubra pusholva.

## Hasznos minta (újrafelhasználható)
- **Éles hiba hű reprodukciója mutálás nélkül:** a prod `mock_artifact.inputs` (recipe+siteData)
  read-only kiolvasása → lokál `renderSite(...)+injectRuntime(...)` a javított sablonnal →
  `scripts/engine-shot.ts` screenshot. A lokál dev-DB üres, de nem is kell hozzá.
- Prod séma-tájolás: `site.path` = snapshot (`sites/<tenant_id>/index.html`), services:
  `citoviso-console`/`citoviso-public` (User=citoviso, WorkingDirectory=/opt/citoviso/app).

## Új backlog-tétel (tulaj-rendelet)
- **Hiba-ticketing rendszer** (`_planning/BACKLOG.md` → Működés/skálázás): észlelt hibák
  strukturált beküldése → **kurátori jóváhagyás** → **AI-feldolgozás**;
  ⛔ kemény korlát: az AI az **alap strukturális kódhoz nem nyúlhat** — a „strukturális mag"
  határa (mely fájlok/rétegek) külön definiálandó, ADR-be, MIELŐTT a rendszer épül.

## Nyitott / következő
- Ticketing: első lépés a strukturális mag definíciója + minimál ticket-séma (később).
