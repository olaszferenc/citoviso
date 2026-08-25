// Views for the plan-approval surface (ADR-0068) — the console replacement for the
// external design app. Mobile-first: the owner reviews plans on his phone, so the
// list is a stack of full-width tap targets and the viewer defaults to the 390px
// frame that decides most of these questions anyway.

import { esc, layout } from "./views.js";
import type { DesignGroup, DesignPick, DesignRef } from "./designRefs.js";
import { ic } from "../ui/icons.js";

/** Widths the viewer can frame a plan in. 390 = the owner's phone (the default). */
const WIDTHS: ReadonlyArray<{ w: number; label: string }> = [
  { w: 390, label: "Telefon" },
  { w: 768, label: "Tábla" },
  { w: 1280, label: "Asztali" },
];

function ago(mtime: number, now: number): string {
  const min = Math.max(0, Math.round((now - mtime) / 60000));
  if (min < 60) return `${min} perce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} órája`;
  const d = Math.round(h / 24);
  return d === 1 ? "tegnap" : `${d} napja`;
}

function pickPill(pick: DesignPick | undefined): string {
  if (!pick) return "";
  return pick.choice === "yes"
    ? `<span class="pill approved">Jóváhagyva</span>`
    : `<span class="pill rejected">Nem jó</span>`;
}

/** The plan list: every HTML under assets/design-refs, grouped by folder. */
export function designIndexPage(
  groups: readonly DesignGroup[],
  picks: Readonly<Record<string, DesignPick>>,
  now: number,
): string {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const rows = (g: DesignGroup): string =>
    `<div class="dsg-list">${g.items
      .map((it) => {
        const fresh = now - it.mtime < 36 * 3600 * 1000;
        return `<a class="dsg-item" href="/design/view?f=${encodeURIComponent(it.rel)}">
          <span class="dsg-item__ic">${ic("design", 20)}</span>
          <span class="dsg-item__txt">
            <strong>${esc(it.title)}</strong>
            <span class="mut small">${esc(ago(it.mtime, now))} · ${esc(it.rel.split("/").pop() ?? it.rel)}</span>
          </span>
          <span class="dsg-item__end">${fresh ? `<span class="pill">új</span>` : ""}${pickPill(picks[it.rel])}</span>
        </a>`;
      })
      .join("")}</div>`;

  const head = (g: DesignGroup): string =>
    `${esc(g.label)} <span class="mut small" style="font-weight:400">${esc(g.hint)}</span>`;

  const body = groups.length
    ? groups
        .map((g) =>
          g.collapsed
            ? `<details class="panel dsg-arch">
                 <summary><span class="dsg-arch__t">${head(g)}</span>
                   <span class="mut small dsg-arch__n">${g.items.length} db</span></summary>
                 ${rows(g)}
               </details>`
            : `<div class="panel"><h2>${head(g)}</h2>${rows(g)}</div>`,
        )
        .join("")
    : `<div class="panel"><h2>Nincs terv</h2>
        <p class="mut">Az <code>assets/design-refs/</code> mappa üres. Ide kerül minden
        jóváhagyásra váró felület-terv, és itt fagy be a jóváhagyott változat is.</p></div>`;

  return layout(
    "Tervek",
    `<div class="dsg-head"><h1>Tervek</h1>
      <p class="mut small">${total} terv a munkafából — amint egy terv felkerül, itt azonnal látszik.
      Nincs feltöltés és nincs frissítés-gomb.</p></div>${body}`,
    { active: "/design" },
  );
}

/** One plan in a device frame, with the verdict form under it. */
export function designViewPage(
  item: DesignRef,
  siblings: readonly DesignRef[],
  pick: DesignPick | undefined,
  width: number,
  saved: boolean,
): string {
  const idx = siblings.findIndex((s) => s.rel === item.rel);
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined;
  const href = (rel: string): string =>
    `/design/view?f=${encodeURIComponent(rel)}&w=${width}`;
  const src = `/design/raw/${item.rel.split("/").map(encodeURIComponent).join("/")}`;

  const tabs = WIDTHS.map(
    (x) =>
      `<a href="/design/view?f=${encodeURIComponent(item.rel)}&w=${x.w}"${
        x.w === width ? ' class="active"' : ""
      }>${esc(x.label)}</a>`,
  ).join("");

  const body = `
    <div class="dsg-head">
      <p class="mut small"><a href="/design">← Tervek</a></p>
      <h1>${esc(item.title)}</h1>
      <p class="mut small">${esc(item.rel)}</p>
    </div>

    <nav class="con-tabs">${tabs}<a href="${esc(src)}" target="_blank" rel="noopener">Külön lapon ▸</a></nav>

    ${saved ? `<div class="row" style="margin:0 0 12px"><span class="pill approved">Elmentve — látom a következő körben.</span></div>` : ""}

    <div class="dsg-stage">
      <iframe class="dsg-frame" style="width:${width}px" src="${esc(src)}" title="${esc(item.title)}"
              loading="lazy" sandbox="allow-same-origin"></iframe>
    </div>

    <div class="panel dsg-verdict">
      <h2>Döntés</h2>
      ${
        pick
          ? `<p class="mut small">Eddigi döntés: ${pick.choice === "yes" ? "jóváhagyva" : "nem jó"}${
              pick.note ? ` — „${esc(pick.note)}"` : ""
            }</p>`
          : ""
      }
      <form method="post" action="/design/pick">
        <input type="hidden" name="f" value="${esc(item.rel)}">
        <input type="hidden" name="w" value="${width}">
        <label for="dsg-note">Megjegyzés (nem kötelező)</label>
        <input id="dsg-note" name="note" value="${esc(pick?.note ?? "")}" placeholder="Mit változtassak rajta?">
        <div class="dsg-btns">
          <button type="submit" name="choice" value="yes">Ezt kérem</button>
          <button type="submit" name="choice" value="no" class="bad">Nem jó</button>
        </div>
      </form>
    </div>

    <nav class="dsg-step">
      ${prev ? `<a href="${esc(href(prev.rel))}">← ${esc(prev.title)}</a>` : `<span></span>`}
      ${next ? `<a href="${esc(href(next.rel))}">${esc(next.title)} →</a>` : `<span></span>`}
    </nav>`;

  return layout(item.title, body, { active: "/design" });
}
