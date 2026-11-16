// tervvaltas E — the tenant admin's „Kinézet” tab: the site's plans side by side, „Ezt választom”
// → confirmation → done strip with „Visszavonás”. Contract (approved „3.A”, 2026-11-16):
// assets/design-refs/console/tervvalto-admin/README.md.
//
// Server-side states, so every step works without JavaScript (the script only adds the busy
// spinner and fits the preview frames to their box):
//   ?tab=kinezet                 the plans
//   &dev=d|m                     force the Asztali / Telefonos preview (default: by width)
//   &valaszt=<n>                 the confirmation for plan n
//   &nagy=<n>                    the large preview of plan n
//   &valtva=1                    the done strip (after POST /admin/kinezet)
//   &visszavont=<n>              the undo's note
//   &hiba=<code>                 a refused switch
//
// The previews are the plan RENDERED WITH THE OWNER'S CONTENT (GET /admin/kinezet/elonezet,
// renderTenantPlanPreview) — what they would get, not the cold mock. Nothing paid runs.

import { T } from "../i18n/mail.js";
import { icAdmin as ic } from "../ui/icons.js";
import type { TenantPlan } from "../tenant/planSwitch.js";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface LookView {
  readonly plans: readonly TenantPlan[];
  readonly currentArtifactId: string;
  readonly previousArtifactId: string | null;
  /** live = the public site (guests see a switch at once); trial = a running free trial. */
  readonly mode: "live" | "trial" | "other";
  /** The trial's last day, already formatted for `lang` (trial mode only). */
  readonly trialUntil: string | null;
  /** Where „Megnézem az oldalt” goes (the live site or the private preview). */
  readonly siteHref: string | null;
  readonly dev: "d" | "m" | null;
  readonly confirm: number | null;
  readonly big: number | null;
  readonly done: boolean;
  readonly undone: number | null;
  readonly error: string | null;
}

/** One line per template — layout only: the colours and fonts come from the skin, which varies. */
function templateLine(template: string, lang: string): string {
  switch (template) {
    case "parallax":
      return T(lang, "Teljes képernyős képek, amelyek görgetéskor mélységben mozognak, nagy betűs címek.");
    case "horizontal":
      return T(lang, "Teljes képes nyitókép, a szobák oldalra lapozható sorban.");
    case "wordmark-grow":
      return T(lang, "Nyugodt, levegős: a szállás neve nagyban, a nyitókép belőle nő ki, kerek sarkú fotók.");
    case "gate-opening":
      return T(lang, "Nyitáskor kétfelé nyíló kapu a nyitóképen, vékony vonalak, széles sávok.");
    case "fullbleed":
      return T(lang, "Teljes képes nyitókép, a foglalósáv a kép alján lebeg.");
    case "dark-luxury":
      return T(lang, "Sötét, mozis hangulat, oldalra görgethető képsor.");
    case "editorial":
      return T(lang, "Magazinszerű elrendezés, nagy képek és hosszabb szövegek.");
    default:
      return "";
  }
}

function planName(n: number, lang: string): string {
  return T(lang, "{n}. terv", { n });
}

function previewSrc(p: TenantPlan): string {
  return `/admin/kinezet/elonezet?a=${encodeURIComponent(p.artifactId)}`;
}

function href(params: Record<string, string | number | null>): string {
  const q = new URLSearchParams({ tab: "kinezet" });
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== "") q.set(k, String(v));
  return `/admin?${q.toString().replace(/&/g, "&amp;")}`;
}

/** A scaled, non-interactive frame of the plan's page. `kind`: desktop 1280×800 or phone 390×780. */
function frame(p: TenantPlan, kind: "d" | "m", title: string): string {
  const w = kind === "d" ? 1280 : 390;
  const h = kind === "d" ? 800 : 780;
  return (
    `<div class="pls-fr pls-fr--${kind}" data-fit="${w}">` +
    `<iframe src="${esc(previewSrc(p))}" width="${w}" height="${h}" loading="lazy" tabindex="-1" aria-hidden="true" scrolling="no" title="${esc(title)}"></iframe>` +
    `</div>`
  );
}

function devSeg(v: LookView, lang: string, extra: Record<string, string | number | null>): string {
  const cls = (d: "d" | "m") => (v.dev === d ? " is-on" : v.dev ? "" : ` is-auto-${d}`);
  return (
    `<div class="pls-seg" role="group" aria-label="${esc(T(lang, "Előnézet mérete"))}">` +
    `<a class="pls-seg__b${cls("d")}" href="${href({ ...extra, dev: "d" })}">${ic("desktop", 14)}${T(lang, "Asztali nézet")}</a>` +
    `<a class="pls-seg__b${cls("m")}" href="${href({ ...extra, dev: "m" })}">${ic("phone", 14)}${T(lang, "Telefonos nézet")}</a>` +
    `</div>`
  );
}

function planCard(p: TenantPlan, v: LookView, lang: string): string {
  const cur = p.artifactId === v.currentArtifactId;
  const name = planName(p.n, lang);
  const line = templateLine(p.template, lang);
  const curTag = cur ? `<span class="pls-cur">${ic("check", 12)}${T(lang, "Ez látszik most")}</span>` : "";
  const pv =
    (v.dev !== "m" ? `<div class="pls-pv pls-pv--d${v.dev ? "" : " pls-auto-d"}">${curTag}${frame(p, "d", name)}</div>` : "") +
    (v.dev !== "d"
      ? `<div class="pls-pv pls-pv--m${v.dev ? "" : " pls-auto-m"}">${curTag}<div class="pls-phone">${frame(p, "m", name)}</div></div>`
      : "");
  const choose = cur
    ? `<button type="button" class="adm-btn adm-btn--sm" disabled>${ic("check", 14)}${T(lang, "Ezt használja")}</button>`
    : p.available
      ? `<a class="adm-btn adm-btn--sm adm-btn--p pls-choose" href="${href({ valaszt: p.n, dev: v.dev })}" data-choose="${p.n}">${T(lang, "Ezt választom")}</a>`
      : `<span class="pls-na">${T(lang, "Nem választható")}</span>`;
  const big =
    `<a class="adm-btn adm-btn--sm" href="${href({ nagy: p.n, dev: v.dev })}" data-big="${p.n}">${ic("preview", 14)}` +
    `<span class="pls-wide">${T(lang, "Megnézem nagyban")}</span><span class="pls-narrow">${T(lang, "Nagyban")}</span></a>`;
  return (
    `<div class="pls-plan${cur ? " is-cur" : ""}" data-plan="${p.n}">${pv}` +
    `<div class="pls-plan__b"><h3>${esc(name)}</h3>${line ? `<p>${esc(line)}</p>` : ""}` +
    `<div class="pls-plan__acts">${choose}${big}</div></div></div>`
  );
}

function keepBoxes(lang: string): string {
  const keep = [
    T(lang, "Az átírt szövegek (név, szlogen, bemutatkozás, kiemelések)"),
    T(lang, "A feltöltött képek és a sorrendjük, a nyitókép"),
    T(lang, "Elérhetőség, térkép"),
    T(lang, "Modulok és beállításaik, árak, foglalások, üzenetek"),
    T(lang, "Webcím és a próba / előfizetés"),
  ];
  const change = [
    T(lang, "Elrendezés: hol áll a kép, a cím, a gombok"),
    T(lang, "Betűtípusok és színek"),
    T(lang, "A szakaszok sorrendje és formája"),
    T(lang, "Amit nem írt át: a másik terv saját szövege látszik (néhol kicsit eltér)"),
  ];
  return (
    `<div class="pls-keep">` +
    `<div class="adm-card pls-box"><h4>${T(lang, "Váltáskor megmarad")}</h4><ul>${keep.map((x) => `<li>${ic("checkc", 16)}<span>${esc(x)}</span></li>`).join("")}</ul></div>` +
    `<div class="adm-card pls-box pls-box--chg"><h4>${T(lang, "Ami változik")}</h4><ul>${change.map((x) => `<li>${ic("dot", 16)}<span>${esc(x)}</span></li>`).join("")}</ul></div>` +
    `</div>`
  );
}

function doneStrip(v: LookView, lang: string): string {
  if (!v.done) return "";
  const cur = v.plans.find((p) => p.artifactId === v.currentArtifactId);
  const prev = v.previousArtifactId ? v.plans.find((p) => p.artifactId === v.previousArtifactId) : undefined;
  if (!cur) return "";
  const where =
    v.mode === "live"
      ? T(lang, "A vendégek már az új kinézetet látják.")
      : v.mode === "trial"
        ? T(lang, "A próbaoldala már az új kinézettel jelenik meg.")
        : T(lang, "Az oldala már az új kinézettel jelenik meg.");
  return (
    `<div class="pls-done" role="status"><div><b>${T(lang, "Kész — az oldala mostantól a {n}. tervvel látszik.", { n: cur.n })}</b><br>` +
    `${where} ${T(lang, "Az átírt szövegei, a képei és a beállításai megmaradtak.")}</div>` +
    `<div class="pls-done__acts">` +
    (v.siteHref
      ? `<a class="adm-btn adm-btn--sm" href="${esc(v.siteHref)}" target="_blank" rel="noopener">${ic("external", 14)}${T(lang, "Megnézem az oldalt")}</a>`
      : "") +
    (prev
      ? `<form method="post" action="/admin/kinezet" class="pls-inline" data-busy-form><input type="hidden" name="a" value="${esc(prev.artifactId)}"><input type="hidden" name="undo" value="1">` +
        `<button type="submit" class="adm-btn adm-btn--sm">${ic("back", 14)}${T(lang, "Visszavonás ({n}. terv)", { n: prev.n })}</button></form>`
      : "") +
    `</div></div>`
  );
}

function errorNote(code: string | null, lang: string): string {
  if (!code) return "";
  const msg =
    code === "render_failed"
      ? T(lang, "Az oldalt most nem sikerült az új tervvel felépíteni, ezért a régi kinézet maradt. Próbálja újra pár perc múlva.")
      : code === "not_available"
        ? T(lang, "Ez a terv nem választható.")
        : T(lang, "Ezt a tervet nem találtuk az oldalához. Frissítse a lapot, és válasszon a listából.");
  return `<div class="adm-banner adm-banner--bad" role="alert">${ic("alert", 18)} ${esc(msg)}</div>`;
}

/** The confirmation (`?valaszt=n`): rendered open by the server — no script needed to show it. */
function confirmSheet(v: LookView, lang: string): string {
  const to = v.confirm ? v.plans.find((p) => p.n === v.confirm && p.available && p.artifactId !== v.currentArtifactId) : undefined;
  const from = v.plans.find((p) => p.artifactId === v.currentArtifactId);
  if (!to || !from) return "";
  const state =
    v.mode === "live"
      ? `<div class="pls-warn">${ic("alert", 16)}<span>${T(lang, "Az oldala élő: a vendégek azonnal az új tervet látják.")}</span></div>`
      : v.mode === "trial"
        ? `<div class="pls-ok">${ic("checkc", 16)}<p>${
            v.trialUntil
              ? T(lang, "A próbaoldala azonnal az új tervvel jelenik meg. A próba ideje nem változik ({date}).", { date: v.trialUntil })
              : T(lang, "A próbaoldala azonnal az új tervvel jelenik meg. A próba ideje nem változik.")
          }</p></div>`
        : `<div class="pls-ok">${ic("checkc", 16)}<p>${T(lang, "Az oldala azonnal az új tervvel jelenik meg.")}</p></div>`;
  const back = href({ dev: v.dev });
  return (
    `<div class="pls-sheet" data-sheet><a class="pls-sheet__bg" href="${back}" aria-label="${esc(T(lang, "Mégsem"))}"></a>` +
    `<div class="pls-sheet__box" role="dialog" aria-modal="true" aria-labelledby="pls-sh-t">` +
    `<h3 id="pls-sh-t">${T(lang, "Átvált a {n}. tervre?", { n: to.n })}</h3>` +
    `<div class="pls-swap"><figure><div class="pls-th">${frame(from, "d", planName(from.n, lang))}</div>${T(lang, "Most: {n}. terv", { n: from.n })}</figure>` +
    `${ic("fwd", 16)}<figure class="is-to"><div class="pls-th">${frame(to, "d", planName(to.n, lang))}</div>${T(lang, "Új: {n}. terv", { n: to.n })}</figure></div>` +
    state +
    `<div class="pls-ok">${ic("checkc", 16)}<p>${T(lang, "A <b>módosításai megmaradnak</b>: az átírt szövegek, a feltöltött és átrendezett képek, az elérhetőség és a modulok tartalma. Amit nem írt át, ott a másik terv saját szövege látszik — ez néhol kicsit eltér.")}</p></div>` +
    `<div class="pls-ok">${ic("checkc", 16)}<p>${T(lang, "Bármikor visszaválthat az {n}. tervre — ugyanígy, egy kattintással.", { n: from.n })}</p></div>` +
    `<form method="post" action="/admin/kinezet" data-busy-form>` +
    `<input type="hidden" name="a" value="${esc(to.artifactId)}">` +
    `<div class="pls-busy"><span class="pls-spin"></span><span>${T(lang, "Átváltás… az oldala újraépül az új tervvel.")}</span></div>` +
    `<div class="pls-sheet__acts"><a class="adm-btn" href="${back}">${T(lang, "Mégsem")}</a>` +
    `<button type="submit" class="adm-btn adm-btn--p" autofocus>${T(lang, "Átváltok a {n}. tervre", { n: to.n })}</button></div>` +
    `</form></div></div>`
  );
}

/** The large preview (`?nagy=n`): the plan's whole page, scrollable, Asztali / Telefon. */
function bigPreview(v: LookView, lang: string): string {
  const p = v.big ? v.plans.find((x) => x.n === v.big) : undefined;
  if (!p) return "";
  const cur = p.artifactId === v.currentArtifactId;
  const d = v.dev ?? "d";
  const line = templateLine(p.template, lang);
  const segCls = (k: "d" | "m") => (v.dev ? (d === k ? " is-on" : "") : ` is-auto-${k}`);
  return (
    `<div class="pls-big${v.dev ? ` is-${d}` : ""}" role="dialog" aria-modal="true" aria-labelledby="pls-big-t">` +
    `<div class="pls-big__top"><a class="adm-ib adm-ib--ghost" href="${href({ dev: v.dev })}" aria-label="${esc(T(lang, "Vissza"))}">${ic("back", 18)}</a>` +
    `<b id="pls-big-t">${esc(planName(p.n, lang))}${cur ? ` — ${T(lang, "ez látszik most")}` : ""}</b>` +
    `<div class="pls-seg"><a class="pls-seg__b${segCls("d")}" href="${href({ nagy: p.n, dev: "d" })}">${ic("desktop", 14)}${T(lang, "Asztali")}</a>` +
    `<a class="pls-seg__b${segCls("m")}" href="${href({ nagy: p.n, dev: "m" })}">${ic("phone", 14)}${T(lang, "Telefon")}</a></div></div>` +
    `<div class="pls-big__body"><iframe src="${esc(previewSrc(p))}" title="${esc(planName(p.n, lang))}"></iframe></div>` +
    `<div class="pls-big__bar"><div><b>${esc(planName(p.n, lang))}</b>${line ? `<br><span>${esc(line)}</span>` : ""}</div>` +
    (cur
      ? `<span class="pls-cur pls-cur--static">${ic("check", 12)}${T(lang, "Ez látszik most")}</span>`
      : p.available
        ? `<a class="adm-btn adm-btn--p" href="${href({ valaszt: p.n, dev: v.dev })}">${T(lang, "Ezt választom")}</a>`
        : `<span class="pls-na">${T(lang, "Nem választható")}</span>`) +
    `</div></div>`
  );
}

/** The whole Kinézet tab (its own page head, like the Fotók tab). */
export function lookSection(v: LookView, lang: string, helpLinkHtml: string): string {
  const many = v.plans.length >= 2;
  const head =
    `<div class="adm-ph"><h1>${T(lang, "Kinézet")}${helpLinkHtml}</h1><p>${
      many
        ? v.mode === "live"
          ? T(lang, "{n} terv készült az oldalához, az Ön szövegeivel és képeivel. Bármikor válthat köztük — a vendégek mindig azt látják, amelyiket itt kiválasztja.", { n: v.plans.length })
          : T(lang, "{n} terv készült az oldalához, az Ön szövegeivel és képeivel. Bármikor válthat köztük.", { n: v.plans.length })
        : T(lang, "Ehhez az oldalhoz egy terv készült, ezért itt most nincs mire váltani.")
    }</p></div>`;
  const undone = v.undone ? `<div class="adm-saved" role="status">${ic("check", 18)} ${T(lang, "Visszaváltva: {n}. terv.", { n: v.undone })}</div>` : "";
  return (
    LOOK_STYLE +
    `<section class="pls" data-dev="${v.dev ?? ""}">` +
    head +
    errorNote(v.error, lang) +
    undone +
    doneStrip(v, lang) +
    (many ? devSeg(v, lang, {}) : "") +
    `<div class="pls-plans${v.plans.length === 1 ? " pls-plans--one" : ""}">${v.plans.map((p) => planCard(p, v, lang)).join("")}</div>` +
    (many ? keepBoxes(lang) : "") +
    `</section>` +
    confirmSheet(v, lang) +
    bigPreview(v, lang) +
    LOOK_SCRIPT
  );
}

/** The Áttekintés cover card's line + entry (contract ⑧) — only with 2+ plans. */
export function overviewLookTag(n: number, lang: string): string {
  return `<span class="adm-covc__look">${ic("layout", 12)}${T(lang, "Kinézet: {n}. terv", { n })}</span>`;
}
export function overviewLookButton(lang: string): string {
  return `<a class="adm-btn adm-btn--sm" href="/admin?tab=kinezet">${ic("layout", 14)}${T(lang, "Másik terv")}</a>`;
}

// ── styles (tokens only: --citui-*) ────────────────────────────────────────────────────────
const LOOK_STYLE = `<style>
.pls{container-type:inline-size}
.pls-seg{display:inline-flex;border:1px solid var(--citui-line-strong);border-radius:8px;padding:2px;background:var(--citui-field);margin:4px 0 2px}
.pls-seg__b{border:0;border-radius:6px;padding:5px 10px;font-weight:600;font-size:12.5px;color:var(--citui-muted);display:inline-flex;gap:6px;align-items:center;text-decoration:none}
.pls-seg__b.is-on{background:var(--citui-panel);color:var(--citui-ink);box-shadow:0 0 0 1px var(--citui-line)}
.pls-plans{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.pls-plans--one{grid-template-columns:minmax(0,420px)}
.pls-plan{border:1px solid var(--citui-line);border-radius:8px;background:var(--citui-panel);overflow:hidden;display:flex;flex-direction:column}
.pls-plan.is-cur{outline:2px solid var(--citui-ok);outline-offset:-1px}
.pls-pv{position:relative;overflow:hidden;background:var(--citui-field);border-bottom:1px solid var(--citui-line)}
.pls-pv--d{aspect-ratio:16/10}
.pls-pv--m{display:flex;justify-content:center;padding:12px 0 0}
.pls-phone{width:116px;height:200px;border:5px solid var(--citui-navy-900);border-bottom:0;border-radius:18px 18px 0 0;overflow:hidden;background:var(--citui-white)}
.pls-fr{position:relative;width:100%;height:100%;overflow:hidden}
.pls-fr iframe{position:absolute;left:0;top:0;border:0;transform-origin:0 0;transform:scale(var(--s,.3));pointer-events:none;background:var(--citui-white)}
.pls-cur{position:absolute;left:6px;top:6px;z-index:1;display:inline-flex;gap:5px;align-items:center;background:var(--citui-ok-soft);color:var(--citui-ok-ink);border-radius:999px;padding:2px 8px;font-weight:700;font-size:11px}
.pls-cur--static{position:static}
.pls-plan__b{padding:10px;display:flex;flex-direction:column;gap:8px;flex:1}
.pls-plan__b h3{margin:0;font-size:14px}
.pls-plan__b p{margin:0;color:var(--citui-muted);line-height:1.45;font-size:12.5px}
.pls-plan__acts{display:flex;flex-direction:column;gap:6px;margin-top:auto}
.pls-plan__acts .adm-btn{width:100%;justify-content:center}
.pls-na{color:var(--citui-muted);font-size:12.5px;font-weight:600;text-align:center;padding:6px 0}
.pls-wide{display:none}
.pls-auto-d{display:none}
.pls-seg__b.is-auto-m{background:var(--citui-panel);color:var(--citui-ink);box-shadow:0 0 0 1px var(--citui-line)}
.pls-keep{margin-top:16px;display:grid;gap:10px}
.pls-box{padding:12px 14px}
.pls-box h4{margin:0 0 8px;font-size:13.5px}
.pls-box ul{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.pls-box li{display:flex;gap:8px;align-items:flex-start;line-height:1.4}
.pls-box li svg{color:var(--citui-ok-ink);margin-top:1px;flex:none}
.pls-box--chg li svg{color:var(--citui-muted)}
.pls-done{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--citui-ok) 45%,transparent);background:var(--citui-ok-soft);border-radius:8px;margin:0 0 12px;line-height:1.45}
.pls-done b{color:var(--citui-ok-ink)}
.pls-done__acts{display:flex;gap:6px;flex-wrap:wrap}
.pls-inline{display:inline}
@container (min-width:700px){
  .pls-plans{gap:12px}
  .pls-plans:not(.pls-plans--one){grid-template-columns:1fr 1fr}
  .pls-plan__b{padding:12px 14px}
  .pls-plan__b h3{font-size:14.5px}
  .pls-plan__acts{flex-direction:row;flex-wrap:wrap}
  .pls-plan__acts .adm-btn{width:auto}
  .pls-wide{display:inline}.pls-narrow{display:none}
  .pls-auto-d{display:block}.pls-auto-m{display:none}
  .pls-seg__b.is-auto-m{background:none;color:var(--citui-muted);box-shadow:none}
  .pls-seg__b.is-auto-d{background:var(--citui-panel);color:var(--citui-ink);box-shadow:0 0 0 1px var(--citui-line)}
  .pls-phone{width:170px;height:300px;border-width:6px}
  .pls-cur{left:10px;top:10px;font-size:11.5px;padding:3px 9px}
  .pls-keep{grid-template-columns:1fr 1fr}
  .pls-done{flex-direction:row;align-items:center}.pls-done>div:first-child{flex:1}
}
@media (min-width:1100px){.pls-plans:not(.pls-plans--one){grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}}
.pls-sheet{position:fixed;inset:0;z-index:80}
.pls-sheet__bg{position:absolute;inset:0;background:color-mix(in srgb,var(--citui-navy-950) 45%,transparent)}
.pls-sheet__box{position:absolute;left:0;right:0;bottom:0;background:var(--citui-panel);color:var(--citui-ink);border-radius:14px 14px 0 0;padding:18px 16px 16px;display:flex;flex-direction:column;gap:12px;line-height:1.45;max-height:92vh;overflow:auto}
.pls-sheet__box h3{margin:0;font-size:16px}
.pls-sheet__box p{margin:0}
.pls-swap{display:flex;align-items:center;gap:10px}
.pls-swap figure{margin:0;flex:1;text-align:center;font-size:11.5px;color:var(--citui-muted)}
.pls-th{aspect-ratio:16/9;border-radius:6px;overflow:hidden;border:1px solid var(--citui-line);margin-bottom:4px;background:var(--citui-field)}
.pls-swap figure.is-to .pls-th{outline:2px solid var(--citui-cyan-500);outline-offset:-1px}
.pls-warn{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border-radius:7px;background:color-mix(in srgb,var(--citui-warn) 16%,transparent);color:var(--citui-warn-ink);font-weight:600}
.pls-ok{display:flex;gap:8px;align-items:flex-start}
.pls-ok svg,.pls-warn svg{flex:none;margin-top:2px}
.pls-ok svg{color:var(--citui-ok-ink)}
.pls-sheet__acts{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
.pls-sheet__acts .adm-btn{height:40px}
.pls-sheet__acts .adm-btn--p{flex:1}
.pls-busy{display:none;align-items:center;gap:8px;color:var(--citui-muted);margin-bottom:8px}
form.is-busy .pls-busy{display:flex}
.pls-spin{width:16px;height:16px;border-radius:50%;border:2px solid var(--citui-line-strong);border-top-color:var(--citui-cyan-500);animation:pls-sp .8s linear infinite}
@keyframes pls-sp{to{transform:rotate(360deg)}}
@media (min-width:900px){
  .pls-sheet__box{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:520px;border-radius:10px;border:1px solid var(--citui-line)}
  .pls-sheet__acts .adm-btn--p{flex:none}
}
.pls-big{position:fixed;inset:0;z-index:70;background:var(--citui-bg);display:flex;flex-direction:column}
.pls-big__top{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--citui-line);background:var(--citui-panel)}
.pls-big__top b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pls-big__top .pls-seg{margin:0}
.pls-big__body{flex:1;min-height:0;display:flex;justify-content:center;background:var(--citui-field)}
.pls-big__body iframe{border:0;width:100%;height:100%;background:var(--citui-white)}
.pls-big.is-m .pls-big__body iframe{width:390px;max-width:100%}
.pls-big:not(.is-d):not(.is-m) .pls-seg__b.is-auto-m{background:var(--citui-panel);color:var(--citui-ink);box-shadow:0 0 0 1px var(--citui-line)}
.pls-big__bar{display:flex;gap:10px;align-items:center;padding:10px 12px;border-top:1px solid var(--citui-line);background:var(--citui-panel)}
.pls-big__bar>div{flex:1;line-height:1.35;min-width:0}
.pls-big__bar span{color:var(--citui-muted);font-size:12.5px}
@media (min-width:700px){
  .pls-big:not(.is-d):not(.is-m) .pls-seg__b.is-auto-m{background:none;color:var(--citui-muted);box-shadow:none}
  .pls-big:not(.is-d):not(.is-m) .pls-seg__b.is-auto-d{background:var(--citui-panel);color:var(--citui-ink);box-shadow:0 0 0 1px var(--citui-line)}
}
@media (max-width:699px){.pls-big:not(.is-d) .pls-big__body iframe{width:100%}}
</style>`;

// The script only refines what already works without it: fits each frame to its box (the
// no-JS fallback is a fixed 0.3 scale), and shows the busy line while a switch renders.
const LOOK_SCRIPT = `<script>(function(){
function fit(){document.querySelectorAll(".pls-fr[data-fit]").forEach(function(el){var w=el.clientWidth;if(w>0)el.style.setProperty("--s",String(w/Number(el.getAttribute("data-fit"))));});}
fit();if(window.ResizeObserver){var ro=new ResizeObserver(fit);document.querySelectorAll(".pls-fr[data-fit]").forEach(function(el){ro.observe(el);});}else{window.addEventListener("resize",fit);}
document.querySelectorAll("form[data-busy-form]").forEach(function(f){f.addEventListener("submit",function(){f.classList.add("is-busy");f.querySelectorAll("button").forEach(function(b){b.disabled=true;});});});
document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;var x=document.querySelector(".pls-sheet__bg")||document.querySelector(".pls-big__top a");if(x)location.href=x.getAttribute("href");});
})();</script>`;
