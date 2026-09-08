// OPERATOR-ONLY "which pattern made this mock?" badge. The stored artifact stays PURE —
// this is injected at serve time on the /mock/:id route (operator, behind the auth gate),
// exactly like the prospect configurator overlay. It must never reach a lead: the buyer
// paths (/configure/, /p/, /site/) serve the file untouched.
//
// Why it exists: ten open mock tabs are indistinguishable — the page shows the property,
// never the pattern that drew it. The human labels already live in the code (TEMPLATES /
// SKINS / ARCHETYPES); this only carries them to the eye that judges the mock.

import { ARCHETYPES } from "../engine/archetypes.js";
import { SKINS } from "../engine/skins.js";
import { TEMPLATES } from "../engine/templates.js";

/** The subset of mock_artifact.inputs this badge reads (both generator paths). */
export interface PatternInputs {
  readonly engine?: string;
  readonly template?: string | null;
  readonly skin?: string;
  readonly archetype?: string;
  readonly recipeSource?: string;
}

/** Short human name = the label's head before the em dash ("Aurora — sötét üveg app" → "Aurora"). */
function short(label: string): string {
  return label.split("—")[0]!.trim();
}

const RECIPE_SOURCE: Record<string, string> = {
  // i18n-exempt: operator-facing (the mock preview badge is never served to a buyer).
  template: "sablon-recept",
  ai: "AI-recept",
  fallback: "tartalék-recept",
};

const ENGINE: Record<string, string> = {
  composition: "kompozíciós motor", // i18n-exempt: operator-facing
  template: "sablon-motor",
  ai: "AI-motor",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Scoped mirror of the design core: the badge renders inside a FOREIGN document that
 *  never loads citui.css and whose :root belongs to the mock's own skin (--cit-* world).
 *  The citui token NAMES are therefore re-declared on the badge root only — inherited by
 *  the badge subtree, invisible to the mock, so nothing of the page is repainted. Values
 *  mirror public/assets/ui/citui.css and must stay in sync with it (design-token-lint ALLOW). */
const CSS = `
.cit-pbadge{
  --citui-navy-950:#0a1f36; --citui-navy-900:#0e2a47; --citui-cyan-400:#35c4e0; --citui-ink-inverse:#eaf3f8;
  --citui-radius-pill:999px; --citui-radius-sm:14px;
  --citui-font-text:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  /* !important is structural, not cosmetic: a template's own CSS can out-specify an
     injected overlay — measured, aurora.ts's "body>*:not(...){position:relative}" drops
     any body-child overlay out of the fixed layer down to the page bottom. */
  position:fixed !important; left:0 !important; right:0 !important; top:0 !important;
  bottom:auto !important; z-index:2147483000 !important; margin:0 !important;
  padding:0 !important; float:none !important; transform:none !important;
  font-family:var(--citui-font-text); color:var(--citui-ink-inverse); line-height:1.35;
  -webkit-font-smoothing:antialiased;}
.cit-pbadge *{box-sizing:border-box; font-family:inherit;}
.cit-pbadge__bar{display:flex; align-items:center; justify-content:center; gap:10px;
  padding:7px 12px; font-size:13px; white-space:nowrap;
  background:color-mix(in srgb, var(--citui-navy-950) 88%, transparent);
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  border-bottom:1px solid color-mix(in srgb, var(--citui-cyan-400) 26%, transparent);
  box-shadow:0 8px 28px rgba(0,0,0,.34);}
.cit-pbadge__dot{width:8px; height:8px; border-radius:50%; background:var(--citui-cyan-400);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--citui-cyan-400) 22%, transparent); flex:none;
  cursor:pointer;}
.cit-pbadge__name{font-weight:600;}
.cit-pbadge__sep{opacity:.42;}
.cit-pbadge__soft{opacity:.78;}
.cit-pbadge__btn{appearance:none; background:transparent; cursor:pointer; font-size:12px;
  color:var(--citui-cyan-400); border-radius:var(--citui-radius-pill); padding:3px 10px;
  border:1px solid color-mix(in srgb, var(--citui-cyan-400) 34%, transparent);}
.cit-pbadge__btn:hover{background:color-mix(in srgb, var(--citui-cyan-400) 14%, transparent);}
.cit-pbadge__x{appearance:none; background:transparent; border:0; cursor:pointer; padding:2px 4px;
  color:var(--citui-ink-inverse); opacity:.6; font-size:16px; line-height:1;}
.cit-pbadge__x:hover{opacity:1;}
.cit-pbadge__panel{display:none; margin:0 auto; padding:12px 14px; font-size:12.5px;
  max-width:min(92vw,440px); border-radius:var(--citui-radius-sm);
  background:color-mix(in srgb, var(--citui-navy-900) 94%, transparent);
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
  border:1px solid color-mix(in srgb, var(--citui-cyan-400) 22%, transparent);
  box-shadow:0 18px 44px rgba(0,0,0,.42);}
.cit-pbadge[data-open="1"] .cit-pbadge__panel{display:block;}
.cit-pbadge__row{display:flex; gap:8px; padding:3px 0;}
.cit-pbadge__k{flex:none; width:96px; opacity:.62;}
.cit-pbadge__v{flex:1; min-width:0;}
.cit-pbadge__id{opacity:.55; font-size:11.5px;}
.cit-pbadge__note{margin-top:8px; padding-top:8px; opacity:.62; font-size:11.5px;
  border-top:1px solid color-mix(in srgb, var(--citui-ink-inverse) 14%, transparent);}
.cit-pbadge[data-hidden="1"]{left:14px !important; right:auto !important; top:14px !important;}
.cit-pbadge[data-hidden="1"] .cit-pbadge__bar{border-radius:var(--citui-radius-pill); padding:6px 8px;
  border:1px solid color-mix(in srgb, var(--citui-cyan-400) 26%, transparent);}
.cit-pbadge[data-hidden="1"] .cit-pbadge__text,
.cit-pbadge[data-hidden="1"] .cit-pbadge__btn,
.cit-pbadge[data-hidden="1"] .cit-pbadge__x,
.cit-pbadge[data-hidden="1"] .cit-pbadge__panel{display:none;}
@media (max-width:520px){
  .cit-pbadge__bar{font-size:12px; padding:6px 10px; gap:7px;}
  .cit-pbadge__text{overflow:hidden; text-overflow:ellipsis;}
}
`;

const JS = `
(function(){
  var b=document.querySelector('.cit-pbadge'); if(!b) return;
  b.addEventListener('click', function(e){
    var t=e.target.closest('[data-act]'); if(!t) return;
    var a=t.getAttribute('data-act');
    if(a==='toggle'){var o=b.getAttribute('data-open')==='1';
      b.setAttribute('data-open',o?'0':'1'); t.textContent=o?'Részletek':'Bezárom';
      t.setAttribute('aria-expanded',o?'false':'true');}
    if(a==='hide'){b.setAttribute('data-hidden','1'); b.setAttribute('data-open','0');}
    if(a==='show'&&b.getAttribute('data-hidden')==='1'){b.setAttribute('data-hidden','0');}
  });
})();
`;

/** The short line the tab title and the bar both carry: "Aurora · Éjkék · sablon-recept". */
export function patternSummary(inputs: PatternInputs): string {
  const parts: string[] = [];
  const tpl = inputs.template ? TEMPLATES[inputs.template] : undefined;
  const skin = inputs.skin ? SKINS[inputs.skin] : undefined;
  // The archetype only SHAPES the page on the non-template path (body.cit-arch-*); on the
  // template path it is stored but inert, so naming it there would be a false claim (§B.17).
  const arch = !inputs.template && inputs.archetype ? ARCHETYPES[inputs.archetype] : undefined;
  if (tpl) parts.push(short(tpl.label));
  else if (arch) parts.push(short(arch.label));
  if (skin) parts.push(short(skin.label));
  if (inputs.recipeSource && RECIPE_SOURCE[inputs.recipeSource]) {
    parts.push(RECIPE_SOURCE[inputs.recipeSource]!);
  }
  return parts.join(" · ");
}

function row(k: string, v: string, sub?: string): string {
  return (
    `<div class="cit-pbadge__row"><span class="cit-pbadge__k">${esc(k)}</span>` +
    `<span class="cit-pbadge__v">${esc(v)}` +
    (sub ? `<br><span class="cit-pbadge__id">${esc(sub)}</span>` : "") +
    `</span></div>`
  );
}

/**
 * Inject the operator pattern badge before </body> and rewrite the tab title so a wall of
 * mock tabs is readable. Idempotent. Returns the html unchanged when nothing is known.
 */
export function injectPatternBadge(
  html: string,
  inputs: PatternInputs,
  opts: { readonly file?: string; readonly generatedAt?: Date } = {},
): string {
  if (html.includes("cit-pbadge")) return html; // already injected
  const summary = patternSummary(inputs);
  if (!summary) return html;

  const tpl = inputs.template ? TEMPLATES[inputs.template] : undefined;
  const skin = inputs.skin ? SKINS[inputs.skin] : undefined;
  const arch = inputs.archetype ? ARCHETYPES[inputs.archetype] : undefined;
  const rows: string[] = [];
  // i18n-exempt block: operator-facing labels (this surface never reaches a buyer).
  if (tpl) rows.push(row("Sablon", tpl.label, tpl.id));
  if (skin) rows.push(row("Színvilág", skin.label, skin.id));
  if (arch && !inputs.template) rows.push(row("Elrendezés", arch.label, arch.id));
  const engineLabel = inputs.engine ? (ENGINE[inputs.engine] ?? inputs.engine) : null;
  const sourceLabel = inputs.recipeSource
    ? (RECIPE_SOURCE[inputs.recipeSource] ?? inputs.recipeSource)
    : null;
  if (engineLabel || sourceLabel) {
    rows.push(row("Recept", [sourceLabel, engineLabel].filter(Boolean).join(" · ")));
  }
  if (opts.file) {
    const when = opts.generatedAt
      ? `készült: ${opts.generatedAt.toISOString().slice(0, 16).replace("T", " ")}`
      : undefined;
    rows.push(row("Fájl", opts.file, when));
  }
  if (arch && inputs.template) {
    rows.push(
      `<div class="cit-pbadge__note">Elrendezés-archetípus (${esc(arch.id)}): ` +
        `nincs hatása ezen az úton — a lapot a sablon rajzolja.</div>`,
    );
  }

  const block =
    `<style data-cit-pbadge>${CSS}</style>\n` +
    `<div class="cit-pbadge" data-open="0" data-hidden="0" role="complementary"\n` +
    `     aria-label="Melyik minta készítette ezt a mockot">\n` +
    `  <div class="cit-pbadge__bar">\n` +
    `    <span class="cit-pbadge__dot" data-act="show" aria-hidden="true"></span>\n` +
    `    <span class="cit-pbadge__text">${esc(summary)}</span>\n` +
    `    <button class="cit-pbadge__btn" type="button" data-act="toggle" aria-expanded="false">Részletek</button>\n` +
    `    <button class="cit-pbadge__x" type="button" data-act="hide" aria-label="Elrejtem">&times;</button>\n` +
    `  </div>\n` +
    `  <div class="cit-pbadge__panel">${rows.join("")}</div>\n` +
    `</div>\n` +
    `<script data-cit-pbadge>${JS}</script>\n`;

  const titled = html.replace(
    /<title>([^<]*)<\/title>/i,
    (_m, t: string) => `<title>${esc(summary)} — ${t}</title>`,
  );
  return /<\/body>/i.test(titled)
    ? titled.replace(/<\/body>/i, `${block}</body>`)
    : titled + "\n" + block;
}
