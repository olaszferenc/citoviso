-- 0040 RECURRENCE TRACE — a Barion 3DS-kompatibilis token-fizetés (ADR-0080 ⑤)
-- második fele. A sandbox mérte ki (UpgradeTo3DS): a token önmagában nem elég —
-- a kártyatársasági TraceId az indító, 3DS-hitelesített fizetésből származik, és
-- minden későbbi merchant-initiated terhelésen VISSZA KELL adni, különben a
-- kibocsátó elutasít. A token (RecurrenceId) a MI azonosítónk; a TraceId a
-- kártyaséma nyoma — kettő együtt a terhelési képesség.
ALTER TABLE subscription
  ADD COLUMN recurrence_trace_id text;

COMMENT ON COLUMN subscription.recurrence_trace_id IS
  'ADR-0080 ⑤: a token-regisztráló fizetés TraceId-je (GetPaymentState) — minden MIT terhelésen kötelező visszajátszani (3DS).';
