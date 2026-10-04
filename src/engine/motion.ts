// Scroll-motion layer for art templates (ADR-0115).
//
// WHY THIS EXISTS. Measured on the 16 templates that predate it: seven carried a
// single decorative @keyframes, and scroll-driven reveal existed NOWHERE (the one
// IntersectionObserver in parallax.ts drives dot navigation, not motion). Every
// high-end reference the owner brought in — lasalaplazahotel.com, palazzosogni.com,
// thebendclub.com — earns much of its perceived quality from motion, not layout.
//
// WHAT IT IS. A DECLARATIVE contract: markup carries `data-cit-motion` hooks, one
// small engine drives them. A template author writes `${mo("up", 120)}` on an
// element; it needs to know nothing about observers or timing. That is what makes
// this generator-friendly — the hook is data, not code.
//
// THE FAIL-SAFE RULES (each one earned by a real, measured bug — see ADR-0115):
//   1. The hiding CSS lives under html.cit-motion, which JS adds. No JS → nothing
//      is ever hidden. The reference site fails this: with reduced-motion set,
//      16 of 23 measured elements stay invisible FOREVER.
//   2. prefers-reduced-motion: reduce → everything visible, no transitions.
//   3. A motion hook must never sit on an element that carries its own transform:
//      the reveal's `transform:none` silently wipes the design's rotate().
//   4. An observed element must keep a non-zero painted box. `clip-path:inset(100%)`
//      collapses it and Chromium's IntersectionObserver then reports
//      isIntersecting:false forever — the hiding blocks its own reveal.
//   5. Never combine [hidden] with a display rule: [hidden] is a zero-specificity
//      UA rule and ANY display declaration beats it.
//   6. Force a style flush (offsetWidth) between start and end state, or the
//      browser coalesces them into one frame and no transition runs at all.
//   7. Full-screen `filter: blur()` costs frames (measured 44 fps, 67 ms hitches).
//      Use a 40px twin stretched to size instead — visually identical, 60 fps.
//   8. FLIP maths: absolute positioning is relative to the PADDING box while
//      getBoundingClientRect() returns border-box coordinates. Subtract the border.
//   9. Screenshot tooling must set data-cit-no-motion (and data-cit-no-intro): a
//      full-page capture happens before any scroll, so reveal-pending elements are
//      photographed hidden — the preview lightbox showed empty photo frames.

/** Motion intensity. `calm` is the default; `film` is the same choreography, larger. */
export type MotionLevel = "calm" | "film";

/** Reveal kinds a template may hang on an element. */
export type MotionKind = "up" | "rise" | "in" | "side" | "arch";

/**
 * The markup hook. Put it on a WRAPPER when the element itself is transformed
 * (rule 3) — e.g. a tilted figure gets an inner div carrying the hook.
 */
export function mo(kind: MotionKind, delayMs = 0): string {
  return `data-cit-motion="${kind}"${delayMs ? ` data-cit-motion-delay="${delayMs}"` : ""}`;
}

/** Parallax hook: the layer drifts slower than the scroll. `speed` scales the base rate. */
export function parallax(speed = 1): string {
  return `class="cit-par" data-cit-par="${speed}"`;
}

/** CSS for the reveal + parallax layer. Emitted once per page, inside the template's <style>. */
export function motionCss(level: MotionLevel = "calm"): string {
  const bold = level === "film";
  const dist = bold ? 42 : 20;
  const rise = bold ? 64 : 26;
  const side = bold ? 46 : 22;
  const dur = bold ? "1.05s" : ".85s";
  const durT = bold ? "1.15s" : ".9s";
  return `
/* ---- motion layer (ADR-0115) — progressive enhancement only ---- */
.cit-motion [data-cit-motion]{opacity:0;
  transition:opacity ${dur} cubic-bezier(.22,.61,.36,1),
             transform ${durT} cubic-bezier(.22,.61,.36,1)}
.cit-motion [data-cit-motion="up"]{transform:translateY(${dist}px)}
.cit-motion [data-cit-motion="rise"]{transform:translateY(${rise}px) scale(.988)}
.cit-motion [data-cit-motion="side"]{transform:translateX(${side}px)}
.cit-motion [data-cit-motion="in"]{transform:none}
.cit-motion [data-cit-motion].cit-in{opacity:1;transform:none}
/* rule 4: the clip lives on the inner image, never on the observed box */
.cit-motion [data-cit-motion="arch"]{opacity:1}
.cit-motion [data-cit-motion="arch"] img{clip-path:inset(100% 0 0 0);
  transition:clip-path ${bold ? "1.4s" : "1s"} cubic-bezier(.4,.1,.2,1)}
.cit-motion [data-cit-motion="arch"].cit-in img{clip-path:inset(0 0 0 0)}
/* word-by-word headline reveal */
.cit-motion .cit-words span{display:inline-block;opacity:0;transform:translateY(.36em);
  transition:opacity .7s ease,transform .8s cubic-bezier(.22,.61,.36,1)}
.cit-motion .cit-words.cit-in span{opacity:1;transform:none}
.cit-par{will-change:transform}

/* rule 2 — the reference site gets this wrong and hides content permanently */
@media (prefers-reduced-motion:reduce){
  .cit-motion [data-cit-motion],
  .cit-motion [data-cit-motion="arch"] img,
  .cit-motion .cit-words span{
    opacity:1 !important;transform:none !important;clip-path:none !important;transition:none !important}
  .cit-par{transform:none !important}
}`;
}

/** JS for the reveal + parallax layer. Emitted once per page, before </body>. */
export function motionJs(): string {
  return `(function(){
  var root=document.documentElement;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){return;}
  // Explicit opt-out for tooling. A full-page screenshot captures the page BEFORE
  // any scrolling, so every not-yet-revealed element would be photographed hidden
  // (measured: the preview lightbox showed empty arch frames). Without the class
  // nothing is ever hidden — same fail-safe path as "no JS".
  if(root.hasAttribute('data-cit-no-motion')){return;}
  root.classList.add('cit-motion');
  var io=null;
  function sweep(){
    if(!('IntersectionObserver' in window)){
      [].forEach.call(document.querySelectorAll('[data-cit-motion],.cit-words'),function(e){e.classList.add('cit-in');});
      return;
    }
    io=new IntersectionObserver(function(es){
      es.forEach(function(en){
        if(!en.isIntersecting)return;
        var el=en.target,d=Number(el.getAttribute('data-cit-motion-delay')||0);
        setTimeout(function(){el.classList.add('cit-in');},d);
        io.unobserve(el);
      });
    },{rootMargin:'0px 0px -10% 0px',threshold:.1});
    [].forEach.call(document.querySelectorAll('[data-cit-motion]:not(.cit-in),.cit-words:not(.cit-in)'),function(e){io.observe(e);});
  }
  var layers=[].slice.call(document.querySelectorAll('.cit-par'));
  var ticking=false;
  function drift(){
    if(ticking)return;ticking=true;
    requestAnimationFrame(function(){
      var vh=window.innerHeight;
      layers.forEach(function(l){
        var r=l.getBoundingClientRect();
        var mid=r.top+r.height/2-vh/2;
        var s=Number(l.getAttribute('data-cit-par')||1);
        l.style.transform='translate3d(0,'+(-mid*0.06*s).toFixed(1)+'px,0)';
      });
      ticking=false;
    });
  }
  window.addEventListener('scroll',drift,{passive:true});
  window.addEventListener('resize',drift,{passive:true});
  sweep();drift();
})();`;
}

/** Words wrapped for the word-by-word headline reveal. Caller escapes the text. */
export function words(escapedText: string): string {
  return `<span class="cit-words">${escapedText
    .split(" ")
    .map((w) => `<span>${w}</span>`)
    .join(" ")}</span>`;
}

/**
 * SCROLL STORY (ADR-0304, the walk-through template's „séta”): a sticky photo panel beside
 * (desktop) or behind (phone) a list of steps; as the guest scrolls, the panel's pictures
 * dissolve into each other and a thin rail fills. Declarative like the rest of this layer:
 *
 *   [data-cit-story]          the wrapper — gets `cit-story` when the story mode runs
 *   [data-cit-story-stage]    the (empty) sticky panel the step photos are cloned into
 *   [data-cit-story-rail]     the progress bar (scaleY)
 *   [data-cit-story-step]     one step: its own <figure> (the photo) + its text
 *
 * Fail-safe, by the rules above: without JS, under reduced motion, with data-cit-no-motion
 * (tooling) or without IntersectionObserver NOTHING changes — the steps stay photo+text
 * pairs, every picture visible (rule 1/2/9). Only transform/opacity animate; no scroll
 * listener (an observer per step). The active step/shot carries `cit-on`; a step's own
 * figure is hidden by the TEMPLATE's CSS under `.cit-story` once its clone is on stage.
 * Cloned images lose loading="lazy": a stacked, transparent shot never "scrolls into view"
 * and would otherwise never load (rule 10's cousin).
 */
export function storyCss(): string {
  return `
[data-cit-story] [data-cit-story-stage]{pointer-events:none}`;
}

export function storyJs(): string {
  return `(function(){
  var root=document.documentElement;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){return;}
  if(root.hasAttribute('data-cit-no-motion')||!('IntersectionObserver' in window)){return;}
  [].forEach.call(document.querySelectorAll('[data-cit-story]'),function(box){
    var stage=box.querySelector('[data-cit-story-stage]'),rail=box.querySelector('[data-cit-story-rail]');
    var steps=[].slice.call(box.querySelectorAll('[data-cit-story-step]'));
    if(!stage||steps.length<2)return;
    var shots=steps.map(function(st,i){
      var f=st.querySelector('figure');if(!f)return null;
      var c=f.cloneNode(true),im=c.querySelector('img');
      if(im)im.removeAttribute('loading');
      if(i===0)c.classList.add('cit-on');
      stage.appendChild(c);
      return c;
    });
    box.classList.add('cit-story');
    steps[0].classList.add('cit-on');
    function show(k){
      steps.forEach(function(s,j){s.classList.toggle('cit-on',j===k);if(shots[j])shots[j].classList.toggle('cit-on',j===k);});
      if(rail)rail.style.transform='scaleY('+((k+1)/steps.length)+')';
    }
    show(0);
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting)show(steps.indexOf(e.target));});
    },{rootMargin:'-45% 0px -45% 0px',threshold:0});
    steps.forEach(function(s){io.observe(s);});
  });
})();`;
}

/**
 * The intro sequence (owner's pick, thebendclub.com direction): the wordmark
 * draws in with a small photo frame set INSIDE it, photos cycle in that frame,
 * then the frame grows into the hero and the name appears over the finished photo.
 */
export interface IntroOptions {
  /** Property name, already escaped by the caller. */
  readonly name: string;
  /** Small line under the wordmark (place), already escaped. */
  readonly place: string;
  /** Photos cycled in the frame. The first is also the hero. */
  readonly photos: readonly string[];
  /**
   * Playback speed. The owner picked 0.6 after comparing 1 / 0.8 / 0.6 / 0.4:
   * the whole sequence then ran ~5.8 s; since the slower grow (2026-10-03) ~7.5 s.
   */
  readonly speed?: number;
}


/**
 * The quiet opening (palazzo line): the wordmark rises on the page's own ground,
 * holds, and fades — no photo frame, nothing grows. Same fail-safes as the other
 * one: first session view only, never under reduced motion, never with JS off.
 */
export function fadeIntroHtml(o: { name: string; place: string }): string {
  return `<div class="cit-fintro" id="cit-fintro" aria-hidden="true">
  <div class="cit-fintro-name">${o.name}</div>
  ${o.place ? `<div class="cit-fintro-sub">${o.place}</div>` : ""}
</div>`;
}

export function fadeIntroCss(): string {
  return `
/* ---- quiet intro (ADR-0115) ---- */
.cit-fintro{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;align-content:center;
  gap:14px;background:var(--cit-bg);pointer-events:none;text-align:center;padding:0 20px}
.cit-fintro[hidden]{display:none !important}
.cit-fintro-name{font-family:var(--cit-font-display);font-style:italic;
  font-size:clamp(32px,7vw,84px);line-height:1.04;color:var(--cit-ink);
  opacity:0;transform:translateY(14px);
  transition:opacity 1s ease,transform 1.1s cubic-bezier(.22,.61,.36,1)}
.cit-fintro-sub{font-size:11px;letter-spacing:.42em;text-transform:uppercase;color:var(--cit-muted);
  opacity:0;transition:opacity 1s ease .25s}
.cit-fintro.cit-on .cit-fintro-name{opacity:1;transform:none}
.cit-fintro.cit-on .cit-fintro-sub{opacity:1}
.cit-fintro.cit-off{opacity:0;transition:opacity .9s ease}
@media (prefers-reduced-motion:reduce){.cit-fintro{display:none}}`;
}

export function fadeIntroJs(speed = 0.6): string {
  const k = 1 / speed;
  return `(function(){
  var el=document.getElementById('cit-fintro');
  if(!el)return;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen=false;try{seen=sessionStorage.getItem('citIntro')==='1';}catch(e){}
  var off=document.documentElement.hasAttribute('data-cit-no-intro');
  if(reduce||seen||off){el.parentNode.removeChild(el);return;}
  try{sessionStorage.setItem('citIntro','1');}catch(e){}
  var K=${k.toFixed(4)};
  document.documentElement.style.overflow='hidden';
  requestAnimationFrame(function(){el.classList.add('cit-on');});
  setTimeout(function(){el.classList.add('cit-off');},1900*K);
  setTimeout(function(){
    document.documentElement.style.overflow='';
    if(el.parentNode)el.parentNode.removeChild(el);
    var h=document.querySelector('[data-cit-hero-copy]');
    if(h)h.classList.add('cit-in');
  },2800*K);
})();`;
}


/** Markup for the intro overlay. Sits ON TOP of the hero and removes itself. */
export function introHtml(o: IntroOptions): string {
  const upper = o.name.toUpperCase();
  // ⛔ Never split a word: "Rozé Fogadó" became "Rozé F▣ogadó" with a naive
  // midpoint cut. Prefer the space nearest the middle; with a single-word name
  // the frame goes after the word, not inside it.
  const spaces = [...upper].map((c, i) => (c === " " ? i : -1)).filter((i) => i >= 0);
  const mid = upper.length / 2;
  const cut = spaces.length
    ? spaces.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a)) + 1
    : upper.length;
  const letters = (t: string) =>
    t
      .split("")
      .map((c) => `<span>${c === " " ? "&nbsp;" : c}</span>`)
      .join("");
  // The wordmark is one non-wrapping line, so the type size must follow the NAME
  // LENGTH — measured: "FORTUNA VENDÉGHÁZ" ran off both edges at a fixed clamp().
  const chars = upper.length + 1; // + the photo slot
  // On a portrait screen the two halves stack around the frame (owner, 2026-10-03: the
  // frame was "nagyon kicsi" — 14×18 px in one line on a phone), so there the type
  // follows the LONGER half.
  const half = Math.max(cut, upper.length - cut, 1);
  return `<div class="cit-intro" id="cit-intro" aria-hidden="true">
  <div class="cit-intro-word" id="cit-intro-word">
    <div class="cit-intro-name" style="--cit-intro-chars:${chars};--cit-intro-half:${half}"><span class="cit-il">${letters(upper.slice(0, cut))}</span><span class="cit-slot" id="cit-slot"></span><span class="cit-il">${letters(upper.slice(cut))}</span></div>
    <div class="cit-intro-sub">${o.place}</div>
  </div>
  <div class="cit-grow" id="cit-grow" hidden></div>
</div>`;
}

/** CSS for the intro overlay. */
export function introCss(): string {
  return `
/* ---- intro sequence (ADR-0115) ---- */
.cit-intro{position:fixed;inset:0;z-index:9000;pointer-events:none}
/* rule 5: [hidden] loses to any display rule — state it explicitly */
.cit-intro[hidden],.cit-grow[hidden]{display:none !important}
.cit-intro-word{position:absolute;inset:0;display:grid;place-items:center;
  background:var(--cit-bg);padding:0 18px;z-index:1}
/* The frame the photo grows from is sized by the SCREEN, not by a letter (owner,
   2026-10-03: "nagyon kicsi a kép amiből kinő" — measured 70×86 px on a 1440×900
   desktop, 14×18 px on a 390 phone). The type shrinks to leave it room on the line. */
.cit-intro-name{--cit-slot-h:min(34vh,24vw);font-family:var(--cit-font-display);
  font-size:min(clamp(26px,9.5vw,116px),calc((88vw - var(--cit-slot-h) * .8) / var(--cit-intro-chars,10) * 1.5));
  line-height:1;letter-spacing:.02em;color:var(--cit-ink);display:flex;align-items:center;
  justify-content:center;white-space:nowrap}
.cit-il{display:inline-flex}
.cit-il span{display:inline-block;opacity:0;transform:translateY(.16em);
  transition:opacity .5s ease,transform .6s cubic-bezier(.22,.61,.36,1)}
.cit-intro.cit-on .cit-il span{opacity:1;transform:none}
.cit-slot{display:inline-block;flex:none;width:calc(var(--cit-slot-h) * .8);height:var(--cit-slot-h);
  margin:0 .16em;vertical-align:middle;opacity:0;transition:opacity .45s ease}
/* portrait: name half / frame / name half, stacked — one line left no room for a frame */
@media (max-aspect-ratio:4/5){
  .cit-intro-name{--cit-slot-h:min(56vw,40vh);flex-direction:column;gap:.22em;
    font-size:min(clamp(26px,9.5vw,116px),calc(88vw / var(--cit-intro-half,10) * 1.5))}
  .cit-slot{margin:0}
  .cit-il:empty{display:none}
}
.cit-intro.cit-on .cit-slot{opacity:1}
.cit-intro-sub{position:absolute;left:0;right:0;bottom:16%;text-align:center;
  font-size:clamp(9px,1.2vw,12px);letter-spacing:.42em;text-transform:uppercase;
  color:var(--cit-muted);opacity:0;transition:opacity .6s ease}
.cit-intro.cit-on .cit-intro-sub{opacity:1}
.cit-grow{position:absolute;z-index:2;overflow:hidden;border-radius:3px;
  box-shadow:var(--cit-shadow)}
.cit-grow img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
@media (prefers-reduced-motion:reduce){.cit-intro{display:none}}`;
}

/**
 * JS for the intro. Runs only on the FIRST view of a session — a returning
 * visitor should not have to sit through it again.
 */
export function introJs(o: IntroOptions): string {
  const k = 1 / (o.speed ?? 0.6);
  const shots = JSON.stringify(o.photos);
  return `(function(){
  var intro=document.getElementById('cit-intro');
  if(!intro)return;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen=false;
  try{seen=sessionStorage.getItem('citIntro')==='1';}catch(e){}
  // Explicit opt-out for tooling (preview shots, tenant-admin preview): sessionStorage
  // is UNAVAILABLE on an opaque origin (setContent/about:blank throws SecurityError),
  // so a storage-based skip silently fails there and the shot catches the overlay.
  var off=document.documentElement.hasAttribute('data-cit-no-intro');
  if(reduce||seen||off){intro.parentNode.removeChild(intro);return;}
  try{sessionStorage.setItem('citIntro','1');}catch(e){}

  var K=${k.toFixed(4)};
  var SHOTS=${shots};
  var word=document.getElementById('cit-intro-word');
  var slot=document.getElementById('cit-slot');
  var grow=document.getElementById('cit-grow');
  function at(ms,fn){setTimeout(fn,ms*K);}

  document.documentElement.style.overflow='hidden';
  requestAnimationFrame(function(){intro.classList.add('cit-on');});

  at(700,function(){
    var r=slot.getBoundingClientRect();
    grow.hidden=false;
    // rule 8: absolute offsets are padding-box based; rect is border-box
    grow.style.left=(r.left-intro.clientLeft)+'px';
    grow.style.top=(r.top-intro.clientTop)+'px';
    grow.style.width=r.width+'px';
    grow.style.height=r.height+'px';
    var idx=0,cur=document.createElement('img');
    cur.src=SHOTS[0];cur.alt='';grow.appendChild(cur);

    function swap(){
      idx=(idx+1)%SHOTS.length;
      var nx=document.createElement('img');
      nx.src=SHOTS[idx];nx.alt='';nx.style.opacity='0';
      // the approved transition: DEFOCUS. Rule 7 bans a full-screen blur, but this
      // frame is one letter wide — the filter costs nothing at this size.
      nx.style.filter='blur(10px)';
      nx.style.transition='opacity '+(.5*K)+'s ease, filter '+(.6*K)+'s ease';
      grow.appendChild(nx);
      void nx.offsetWidth;                       // rule 6
      requestAnimationFrame(function(){nx.style.opacity='1';nx.style.filter='none';});
      at(760,function(){if(cur.parentNode)cur.parentNode.removeChild(cur);cur=nx;});
    }
    at(0,swap);at(760,swap);at(1520,swap);

    at(2200,function(){
      // only the LETTERING fades — the page ground stays until the frame fills
      // the screen, otherwise the finished hero shows through behind it
      var name=word.querySelector('.cit-intro-name'),sub=word.querySelector('.cit-intro-sub');
      name.style.transition=sub.style.transition='opacity '+(.45*K)+'s ease';
      name.style.opacity=sub.style.opacity='0';
      // Owner, 2026-10-03: "a transition a fix képpé túl gyors". The grow was 1.15
      // (1.9 s at 0.6×) and ended on the FULL WINDOW, so removing the overlay snapped
      // the picture into the smaller hero box under the nav. Now: 1.8 (3.0 s), and
      // the frame grows into the hero's OWN box, then the overlay fades instead of
      // vanishing — the photo never jumps.
      var heroImg=document.querySelector('[data-cit-hero-img]');
      var box=heroImg&&heroImg.parentElement?heroImg.parentElement.getBoundingClientRect():null;
      if(!box||box.height<40)box={left:0,top:0,width:window.innerWidth,height:window.innerHeight};
      var t=(1.8*K)+'s cubic-bezier(.62,.02,.2,1)';
      grow.style.transition='left '+t+',top '+t+',width '+t+',height '+t+',border-radius '+t;
      grow.style.left=(box.left-intro.clientLeft)+'px';grow.style.top=(box.top-intro.clientTop)+'px';
      grow.style.width=box.width+'px';
      grow.style.height=box.height+'px';
      grow.style.borderRadius='0px';
    });

    at(4050,function(){
      document.documentElement.style.overflow='';
      // hand the grown photo over to the hero BEFORE the overlay fades
      var heroImg=document.querySelector('[data-cit-hero-img]');
      if(heroImg&&cur&&cur.src)heroImg.src=cur.src;
      var h=document.querySelector('[data-cit-hero-copy]');
      if(h)h.classList.add('cit-in');
      intro.style.transition='opacity '+(.45*K)+'s ease';
      intro.style.opacity='0';
      at(450,function(){if(intro.parentNode)intro.parentNode.removeChild(intro);});
    });
  });
})();`;
}
