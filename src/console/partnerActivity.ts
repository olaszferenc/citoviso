// The partner sheet's „Aktivitás” tab — a SLOT owned by the SUB-D work (tenant activity +
// site visits, brief d-tenant-aktivitas-latogatottsag). The partner page calls this and
// prints whatever it returns; null = nothing to show (the page says so).
//
// Frozen plan: assets/design-refs/console/tenant-aktivitas/ (1A, owner decision 2026-11-04).
// ⛔ Keep the signature: the partner page does not change.

import { getTenantActivity } from "./tenantActivityData.js";
import { tenantActivityBlock } from "./tenantActivityViews.js";

export interface PartnerActivityInput {
  readonly partnerId: string;
  /** null for a supplier — no tenant, no activity. */
  readonly tenantId: string | null;
}

/** HTML of the activity block, or null for a supplier / an unknown tenant. */
export async function partnerActivityHtml(input: PartnerActivityInput): Promise<string | null> {
  if (!input.tenantId) return null;
  const a = await getTenantActivity(input.tenantId);
  return a ? tenantActivityBlock(a) : null;
}
