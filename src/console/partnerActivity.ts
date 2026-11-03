// The partner sheet's „Aktivitás” tab — a SLOT owned by the SUB-D work (tenant activity +
// site visits, brief d-tenant-aktivitas-latogatottsag). The partner page calls this and
// prints whatever it returns; null = not built yet, the page says so.
//
// ⛔ Keep the signature: SUB-D replaces the body with its own render function, the partner
// page does not change.

export interface PartnerActivityInput {
  readonly partnerId: string;
  /** null for a supplier — no tenant, no activity. */
  readonly tenantId: string | null;
}

/** HTML of the activity block, or null while it does not exist yet. */
export async function partnerActivityHtml(_input: PartnerActivityInput): Promise<string | null> {
  return null;
}
