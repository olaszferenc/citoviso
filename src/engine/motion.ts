// Scroll-motion layer for art templates (ADR-0111).
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
// THE FAIL-SAFE RULES (each one earned by a real, measured bug — see ADR-0111):
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
/* ---- motion layer (ADR-0111) — progressive enhancement only ---- */
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
   * the whole sequence then runs ~5.8 s.
   */
  readonly speed?: number;
}

/** Markup for the intro overlay. Sits ON TOP of the hero and removes itself. */
export function introHtml(o: IntroOptions): string {
  const upper = o.name.toUpperCase();
  const cut = Math.ceil(upper.length / 2);
  const letters = (t: string) =>
    t
      .split("")
      .map((c) => `<span>${c === " " ? "&nbsp;" : c}</span>`)
      .join("");
  // The wordmark is one non-wrapping line, so the type size must follow the NAME
  // LENGTH — measured: "FORTUNA VENDÉGHÁZ" ran off both edges at a fixed clamp().
  const chars = upper.length + 1; // + the photo slot
  return `<div class="cit-intro" id="cit-intro" aria-hidden="true">
  <div class="cit-intro-word" id="cit-intro-word">
    <div class="cit-intro-name" style="--cit-intro-chars:${chars}"><span class="cit-il">${letters(upper.slice(0, cut))}</span><span class="cit-slot" id="cit-slot"></span><span class="cit-il">${letters(upper.slice(cut))}</span></div>
    <div class="cit-intro-sub">${o.place}</div>
  </div>
  <div class="cit-grow" id="cit-grow" hidden></div>
</div>`;
}

/** CSS for the intro overlay. */
export function introCss(): string {
  return `
/* ---- intro sequence (ADR-0111) ---- */
.cit-intro{position:fixed;inset:0;z-index:9000;pointer-events:none}
/* rule 5: [hidden] loses to any display rule — state it explicitly */
.cit-intro[hidden],.cit-grow[hidden]{display:none !important}
.cit-intro-word{position:absolute;inset:0;display:grid;place-items:center;
  background:var(--cit-bg);padding:0 18px;z-index:1}
.cit-intro-name{font-family:var(--cit-font-display);
  font-size:min(clamp(26px,9.5vw,116px),calc(88vw / var(--cit-intro-chars,10) * 1.5));
  line-height:1;letter-spacing:.02em;color:var(--cit-ink);display:flex;align-items:center;
  justify-content:center;white-space:nowrap}
.cit-il{display:inline-flex}
.cit-il span{display:inline-block;opacity:0;transform:translateY(.16em);
  transition:opacity .5s ease,transform .6s cubic-bezier(.22,.61,.36,1)}
.cit-intro.cit-on .cit-il span{opacity:1;transform:none}
.cit-slot{display:inline-block;width:.66em;height:.82em;margin:0 .05em;vertical-align:middle;
  opacity:0;transition:opacity .45s ease}
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
      nx.style.transition='opacity '+(.5*K)+'s ease';
      grow.appendChild(nx);
      void nx.offsetWidth;                       // rule 6
      requestAnimationFrame(function(){nx.style.opacity='1';});
      at(760,function(){if(cur.parentNode)cur.parentNode.removeChild(cur);cur=nx;});
    }
    at(0,swap);at(760,swap);at(1520,swap);

    at(2200,function(){
      // only the LETTERING fades — the page ground stays until the frame fills
      // the screen, otherwise the finished hero shows through behind it
      var name=word.querySelector('.cit-intro-name'),sub=word.querySelector('.cit-intro-sub');
      name.style.transition=sub.style.transition='opacity '+(.45*K)+'s ease';
      name.style.opacity=sub.style.opacity='0';
      var t=(1.15*K)+'s cubic-bezier(.62,.02,.2,1)';
      grow.style.transition='left '+t+',top '+t+',width '+t+',height '+t+',border-radius '+t;
      grow.style.left='0px';grow.style.top='0px';
      grow.style.width=window.innerWidth+'px';
      grow.style.height=window.innerHeight+'px';
      grow.style.borderRadius='0px';
    });

    at(3500,function(){
      document.documentElement.style.overflow='';
      if(intro.parentNode)intro.parentNode.removeChild(intro);
      var h=document.querySelector('[data-cit-hero-copy]');
      if(h)h.classList.add('cit-in');
    });
  });
})();`;
}
