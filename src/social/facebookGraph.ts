// Facebook Graph API client for Page publishing (RESEARCH-2026-11-facebook-modul §2.4).
//
// Publishing runs on a Business-portfolio SYSTEM USER token — nobody's personal account.
// The system user token is exchanged for the Page's own access token
// (GET /{page-id}?fields=access_token), and every publish call uses that Page token.
//
// Tokens never appear in errors or logs: `redact()` strips them from every message we
// throw, because a thrown Graph error often echoes the request URL.

import { readFileSync, statSync } from "node:fs";

export const GRAPH_VERSION = process.env.FB_GRAPH_VERSION ?? "v26.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const RUPLOAD = `https://rupload.facebook.com/video-upload/${GRAPH_VERSION}`;

export interface GraphError {
  readonly status: number;
  readonly code?: number;
  readonly subcode?: number;
  readonly type?: string;
  readonly message: string;
}

export class FacebookGraphError extends Error {
  constructor(readonly detail: GraphError) {
    super(`Graph ${detail.status}${detail.code ? ` #${detail.code}` : ""}: ${detail.message}`);
  }
}

const secrets = new Set<string>();
function redact(s: string): string {
  let out = s;
  for (const t of secrets) if (t) out = out.split(t).join("«token»");
  return out.replace(/access_token=[^&\s"]+/g, "access_token=«token»");
}

async function graphFetch(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  const err = body.error as Record<string, unknown> | undefined;
  if (!res.ok || err) {
    throw new FacebookGraphError({
      status: res.status,
      code: typeof err?.code === "number" ? err.code : undefined,
      subcode: typeof err?.error_subcode === "number" ? err.error_subcode : undefined,
      type: typeof err?.type === "string" ? err.type : undefined,
      message: redact(String(err?.message ?? body.raw ?? res.statusText)),
    });
  }
  return body;
}

function form(fields: Record<string, string | undefined>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) p.set(k, v);
  return p;
}

/** What a token is and what it may do (GET /debug_token, inspected with itself). */
export interface TokenInfo {
  readonly type: string | null;
  readonly appId: string | null;
  readonly valid: boolean;
  readonly expiresAt: number | null;
  readonly scopes: string[];
  readonly granularScopes: { scope: string; targetIds: string[] }[];
}

export async function inspectToken(token: string): Promise<TokenInfo> {
  secrets.add(token);
  const b = await graphFetch(`${GRAPH}/debug_token?${form({ input_token: token, access_token: token })}`);
  const d = (b.data ?? {}) as Record<string, unknown>;
  const gs = (d.granular_scopes ?? []) as { scope: string; target_ids?: string[] }[];
  return {
    type: typeof d.type === "string" ? d.type : null,
    appId: typeof d.app_id === "string" ? d.app_id : null,
    valid: d.is_valid === true,
    expiresAt: typeof d.expires_at === "number" && d.expires_at > 0 ? d.expires_at : null,
    scopes: Array.isArray(d.scopes) ? (d.scopes as string[]) : [],
    granularScopes: gs.map((g) => ({ scope: g.scope, targetIds: g.target_ids ?? [] })),
  };
}

/** The Pages a (system) user token can manage, with each Page's own token. */
export async function managedPages(userToken: string): Promise<{ id: string; name: string; token: string; tasks: string[] }[]> {
  secrets.add(userToken);
  const b = await graphFetch(`${GRAPH}/me/accounts?${form({ fields: "id,name,access_token,tasks", access_token: userToken })}`);
  const rows = (b.data ?? []) as { id: string; name: string; access_token?: string; tasks?: string[] }[];
  return rows.map((r) => {
    if (r.access_token) secrets.add(r.access_token);
    return { id: r.id, name: r.name, token: r.access_token ?? "", tasks: r.tasks ?? [] };
  });
}

/** One Page's access token, derived from a system user token assigned to that Page. */
export async function pageToken(pageId: string, userToken: string): Promise<string> {
  secrets.add(userToken);
  const b = await graphFetch(`${GRAPH}/${pageId}?${form({ fields: "access_token", access_token: userToken })}`);
  const t = typeof b.access_token === "string" ? b.access_token : "";
  if (!t) throw new Error("a rendszerfelhasználó ehhez az oldalhoz nem kapott oldal-tokent (nincs hozzárendelve?)");
  secrets.add(t);
  return t;
}

/** A text (+ optional link) post on the Page feed. */
export async function postText(pageId: string, token: string, message: string, link?: string): Promise<string> {
  const b = await graphFetch(`${GRAPH}/${pageId}/feed`, {
    method: "POST",
    body: form({ message, link, access_token: token }),
  });
  return String(b.id);
}

/** A photo post with caption. `image` is a local file path (uploaded as multipart). */
export async function postPhoto(pageId: string, token: string, image: string, caption: string): Promise<string> {
  const fd = new FormData();
  fd.set("source", new Blob([readFileSync(image)]), image.split("/").pop() ?? "photo.jpg");
  fd.set("caption", caption);
  fd.set("published", "true");
  fd.set("access_token", token);
  const b = await graphFetch(`${GRAPH}/${pageId}/photos`, { method: "POST", body: fd });
  return String(b.post_id ?? b.id);
}

/**
 * A Reel, in the Reels Publishing API's three phases: start (get a video id), upload
 * the bytes to rupload, finish with PUBLISHED. Returns the video id; the Reel becomes
 * visible after Meta's processing (`reelStatus`).
 */
export async function publishReel(pageId: string, token: string, mp4: string, description: string): Promise<string> {
  const start = await graphFetch(`${GRAPH}/${pageId}/video_reels`, {
    method: "POST",
    body: form({ upload_phase: "start", access_token: token }),
  });
  const videoId = String(start.video_id);
  const size = statSync(mp4).size;
  await graphFetch(`${RUPLOAD}/${videoId}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(size) },
    body: readFileSync(mp4),
  });
  await graphFetch(`${GRAPH}/${pageId}/video_reels`, {
    method: "POST",
    body: form({ upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description, access_token: token }),
  });
  return videoId;
}

export async function reelStatus(videoId: string, token: string): Promise<Record<string, unknown>> {
  const b = await graphFetch(`${GRAPH}/${videoId}?${form({ fields: "status,permalink_url", access_token: token })}`);
  return b;
}

/** Remove a post (the pilot cleans up after itself on request). */
export async function deleteObject(id: string, token: string): Promise<boolean> {
  const b = await graphFetch(`${GRAPH}/${id}?${form({ access_token: token })}`, { method: "DELETE" });
  return b.success === true;
}
