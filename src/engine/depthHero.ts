// DEPTH HERO ("térhatású borítókép", ADR-0472) — the cover photo moves in depth.
//
// WHAT IT IS. A depth map (grayscale PNG, near = white) is computed once per cover photo
// (Depth Anything V2 Small, ONNX) and a tiny WebGL shader shifts the photo's own pixels by it,
// so the camera seems to drift. No video file, nothing invented (§B.17): only the photo moves.
// Owner-tuned on 2026-11-23 against real sent mocks: speed 1.5×, strength 2× of the first
// (14 s cycle, 0.022 offset) draft — "very slow, barely visible" at 1×; 3× ghosts thin objects.
//
// HOW A TEMPLATE USES IT. One attribute on the hero photo element, one script before </body>:
//   <img ${depthHeroAttr(data, hero.url)} src="…">         (an <img> hero)
//   <header ${depthHeroAttr(data, heroUrl)} style="background-image:…">   (a CSS-background hero)
//   <script>${depthHeroJs(data, heroUrl)}</script>
// The runtime inserts a canvas right after the <img> (inside its container) or as the first
// child of the background element, so every overlay the template paints later stays on top.
//
// INERT BY DEFAULT. Both helpers return "" unless `data.heroDepth` is set AND belongs to the
// photo the template is about to show (`source` === hero URL) — a stale map from a previous
// cover never animates a different photo. Without it the rendered page is byte-identical.
//
// FAIL-SAFES (ADR-0115 rules apply):
//   · prefers-reduced-motion, data-cit-no-motion (screenshot tooling, rule 9), no WebGL, a
//     texture that cannot be read (cross-origin without CORS → tainted) → nothing happens, the
//     static photo the template rendered stays. The canvas is only inserted once BOTH textures
//     uploaded, so a failure never leaves an empty frame.
//   · An intro that grows INTO the hero (wordmark-grow `#cit-intro`) is waited out; a hero
//     image that settles with its own CSS animation is waited out via `data-cit-depth-delay`.
//   · The motion eases in over 1.5 s from zoom 1 / offset 0, so the canvas fades in exactly over
//     the static photo — no visible jump when it takes over.
//   · Off-screen → the loop stops drawing; the canvas backing store is capped in pixels.
//
// WHY `img` IS A SEPARATE URL from the photo `src`: WebGL can only read a same-origin or
// CORS-enabled image. Portal photos are neither, so the texture comes from our own route
// (the ADR-0341 photo path or the tenant's /uploads), while the visible <img>/background keeps
// whatever transport the page already uses.

import type { SiteData } from "./recipe.js";
import { esc } from "./templateKit.js";

/** Owner-approved motion parameters (2026-11-23), relative to the first draft. Strength 2 → 1.5
 *  the same day (owner: „a finomított animáció”; at 2 the foreground edges smeared — Elek A3). */
export const DEPTH_HERO_SPEED = 1.5;
export const DEPTH_HERO_STRENGTH = 1.5;

/** The depth data for the hero, if it is valid for the photo being rendered. */
function activeDepth(data: SiteData, heroUrl: string | undefined): NonNullable<SiteData["heroDepth"]> | null {
  const d = data.heroDepth;
  if (!d || !heroUrl || !d.depth || !d.img) return null;
  return d.source === heroUrl ? d : null;
}

/** True when the page will carry the depth hero (the template's hero photo has a valid map). */
export function hasDepthHero(data: SiteData, heroUrl: string | undefined): boolean {
  return activeDepth(data, heroUrl) !== null;
}

/**
 * The attribute string for the hero photo element (leading space included), or "".
 * `delayMs`: wait this long before showing the canvas (a hero with its own settle animation).
 */
export function depthHeroAttr(data: SiteData, heroUrl: string | undefined, opts: { delayMs?: number } = {}): string {
  const d = activeDepth(data, heroUrl);
  if (!d) return "";
  const delay = opts.delayMs ? ` data-cit-depth-delay="${Math.round(opts.delayMs)}"` : "";
  return ` data-cit-depth="${esc(d.depth)}" data-cit-depth-img="${esc(d.img)}"${delay}`;
}

/** The bare runtime, for a surface that wires its own element (the tenant admin's preview card). */
export function depthHeroRuntime(): string {
  return DEPTH_HERO_JS;
}

/** The runtime, or "" when the page has no depth hero. Emit once, before </body>. */
export function depthHeroJs(data: SiteData, heroUrl: string | undefined): string {
  return activeDepth(data, heroUrl) ? DEPTH_HERO_JS : "";
}

// The runtime. Plain ES5-ish, no dependencies; ~3 KB. One string, so every template emits
// the identical code.
const DEPTH_HERO_JS = `(function(){
var el=document.querySelector('[data-cit-depth]');if(!el)return;
var root=document.documentElement;
try{if(root.hasAttribute('data-cit-no-motion')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;}catch(e){return;}
var SPEED=${DEPTH_HERO_SPEED},AMP=${DEPTH_HERO_STRENGTH},MAXPX=2600000;
var isImg=el.tagName==='IMG',host=isImg?el.parentElement:el;if(!host)return;
var cv=document.createElement('canvas');cv.setAttribute('aria-hidden','true');cv.className='cit-depth';
cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .6s ease;pointer-events:none';
var gl;try{gl=cv.getContext('webgl',{premultipliedAlpha:false});}catch(e){}
if(!gl)return;
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o;}
var pr=gl.createProgram();
gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;uv.y=1.0-uv.y;gl_Position=vec4(p,0.,1.);}'));
gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 uv;uniform sampler2D img,dep;uniform vec2 off,cover,sh;uniform float zoom;void main(){vec2 c=(uv-0.5)*cover/zoom+0.5+sh;vec2 q=c;for(int i=0;i<4;i++){float d=texture2D(dep,q).r;q=c+off*(d-0.45);}gl_FragColor=texture2D(img,clamp(q,0.001,0.999));}'));
gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return;gl.useProgram(pr);
gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
var loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
function U(n){return gl.getUniformLocation(pr,n);}
gl.uniform1i(U('img'),0);gl.uniform1i(U('dep'),1);
var iw=1,ih=1,ready=0,dead=false,visible=true,phase=0,last=0,t0=0,mx=0,my=0,shown=false;
function tex(unit,src,cb){var im=new Image();im.crossOrigin='anonymous';im.decoding='async';
im.onload=function(){if(dead)return;try{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);}catch(e){dead=true;return;}
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);if(cb)cb(im);if(++ready===2)go();};
im.onerror=function(){dead=true;};im.src=src;}
function size(){var r=host.getBoundingClientRect();if(!r.width||!r.height)return;
var dpr=Math.min(2,window.devicePixelRatio||1),w=r.width*dpr,h=r.height*dpr,k=Math.min(1,Math.sqrt(MAXPX/(w*h)));
w=Math.round(w*k);h=Math.round(h*k);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;gl.viewport(0,0,w,h);}
var ca=r.width/r.height,ia=iw/ih,cx=ca>ia?1:ca/ia,cy=ca>ia?ia/ca:1;gl.uniform2f(U('cover'),cx,cy);
// the photo's focus point (--cit-hero-fx, photoKind.photoFocusX; vertically the upper third, 35 %, where the house
// stands — 11-26: a centred wide crop zoomed on Alexandra's gate bars and cut the roof) — the canvas crops where the CSS photo does
var fx=parseFloat(getComputedStyle(el).getPropertyValue('--cit-hero-fx'));fx=isNaN(fx)?0.5:fx/100;gl.uniform2f(U('sh'),(fx-0.5)*(1-cx),(0.35-0.5)*(1-cy));}
function draw(now){if(dead)return;if(!t0)t0=now;if(last)phase+=(now-last)/1000*SPEED;last=now;
if(visible){size();var t=phase,a=AMP,e=Math.min(1,(now-t0)/1500);e=e*e*(3-2*e);
gl.uniform2f(U('off'),e*(Math.sin(t*2*Math.PI/14)*0.022*a+mx*0.02*a),e*(Math.cos(t*2*Math.PI/14)*0.010*a+my*0.012*a));
gl.uniform1f(U('zoom'),1+e*(0.04+0.03*a+0.04*a*(0.5+0.5*Math.sin(t*2*Math.PI/28))));
gl.drawArrays(gl.TRIANGLE_STRIP,0,4);if(!shown){shown=true;cv.style.opacity='1';}}
requestAnimationFrame(draw);}
function go(){var delay=+el.getAttribute('data-cit-depth-delay')||0;
(function wait(){if(document.getElementById('cit-intro')){setTimeout(wait,300);return;}
setTimeout(function(){if(dead)return;if(isImg)host.insertBefore(cv,el.nextSibling);else host.insertBefore(cv,host.firstChild);requestAnimationFrame(draw);},delay);})();}
if('IntersectionObserver' in window)new IntersectionObserver(function(e){visible=e[0].isIntersecting;}).observe(host);
host.addEventListener('pointermove',function(e){if(e.pointerType!=='mouse')return;var r=host.getBoundingClientRect();mx=(e.clientX-r.left)/r.width-0.5;my=(e.clientY-r.top)/r.height-0.5;});
host.addEventListener('pointerleave',function(){mx=my=0;});
tex(0,el.getAttribute('data-cit-depth-img'),function(im){iw=im.naturalWidth;ih=im.naturalHeight;});
tex(1,el.getAttribute('data-cit-depth'));
})();`;
