// Tenant asset storage — build-behind-an-interface (ADR-0023 A2). Local filesystem
// for dev/testing; swap to object storage/CDN when hosting exists (env ASSET_STORE).
// Photos live under the tenant's isolated namespace and are served at /uploads/<tenant>/<file>.

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "../config.js";

export interface StoredAsset {
  /** Public URL the rendered site references. */
  url: string;
}

export interface AssetStore {
  save(tenantId: string, ext: string, data: Buffer): Promise<StoredAsset>;
  remove(tenantId: string, url: string): Promise<void>;
}

const UPLOAD_ROOT = "sites"; // sites/<tenantId>/uploads/<file>

class LocalAssetStore implements AssetStore {
  async save(tenantId: string, ext: string, data: Buffer): Promise<StoredAsset> {
    const dir = path.join(UPLOAD_ROOT, tenantId, "uploads");
    await mkdir(path.resolve(process.cwd(), dir), { recursive: true });
    const name = `${randomBytes(8).toString("hex")}.${ext}`;
    await writeFile(path.resolve(process.cwd(), dir, name), data);
    return { url: `/uploads/${tenantId}/${name}` };
  }

  async remove(tenantId: string, url: string): Promise<void> {
    // Only remove URLs that belong to this tenant's upload namespace.
    const prefix = `/uploads/${tenantId}/`;
    if (!url.startsWith(prefix)) return;
    const file = url.slice(prefix.length).replace(/[^a-zA-Z0-9._-]/g, "");
    if (!file) return;
    await unlink(path.resolve(process.cwd(), UPLOAD_ROOT, tenantId, "uploads", file)).catch(() => {});
  }
}

let cached: AssetStore | null = null;
export function getAssetStore(): AssetStore {
  if (cached) return cached;
  // Only 'local' is implemented; the switch is ready for a future CDN/object adapter.
  cached = new LocalAssetStore();
  void config; // reserved: config.assetStore selector when a second adapter lands
  return cached;
}
