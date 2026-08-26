// ADR-0067 ③ — the console's per-REQUEST language context.
//
// WHY NOT a `lang` parameter on every view: the console has ~53 render functions
// that call each other freely. Threading a parameter through all of them means
// touching every signature AND every call site, where one missed hand-off renders
// that fragment in Hungarian — silently, and only for the foreign operator who is
// not in the room. (Exactly that bug already happened once on the tenant side:
// `renderField` had the parameter and the caller never passed it.)
//
// WHY NOT a module-level "current language": a request may await between resolving
// the operator and rendering, and a second request would overwrite it. That is a
// race that shows up as one operator seeing another's language — rare, confusing,
// and untestable.
//
// AsyncLocalStorage is the tool that fits: the value belongs to the REQUEST, it
// survives awaits, and it cannot leak between concurrent requests. Views read it
// with `const lang = consoleLang();` — one line, no call-site plumbing.

import { AsyncLocalStorage } from "node:async_hooks";

import { DEFAULT_LANG } from "../i18n/lang.js";

/** Mutable holder: the request enters the context BEFORE the operator (and thus
 *  their language) is known, and `currentOperator` fills it in when it loads. */
export interface ConsoleLangCtx {
  lang: string;
}

const store = new AsyncLocalStorage<ConsoleLangCtx>();

/** Run one request inside a fresh language context. */
export function runWithConsoleLang<T>(fn: (ctx: ConsoleLangCtx) => T): T {
  return store.run({ lang: DEFAULT_LANG }, () => fn(store.getStore()!));
}

/** Set the language for the CURRENT request (no-op outside one). */
export function setConsoleLang(lang: string): void {
  const ctx = store.getStore();
  if (ctx && lang) ctx.lang = lang;
}

/**
 * The current request's console language. Falls back to Hungarian outside a
 * request (scripts, tests, screenshot tooling) — a deliberate, visible default
 * rather than a crash.
 */
export function consoleLang(): string {
  return store.getStore()?.lang ?? DEFAULT_LANG;
}
