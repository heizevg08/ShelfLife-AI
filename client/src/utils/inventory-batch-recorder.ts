/**
 * Use authoritative name parts for batch attribution; avoid stale display names.
 * @param createdBy - Recorder identity returned with a batch.
 * @returns Full name, or an unavailable marker when either part is absent.
 */
export function inventoryBatchRecorderLabel(createdBy: { id?: string; name?: string; firstName?: string; lastName?: string }): string {
  const firstName = createdBy.firstName?.trim() ?? '';
  const lastName = createdBy.lastName?.trim() ?? '';
  return firstName && lastName ? `${firstName} ${lastName}` : '—';
}
