export function inventoryBatchRecorderLabel(createdBy: { id?: string; name?: string; firstName?: string; lastName?: string }): string {
  const firstName = createdBy.firstName?.trim() ?? '';
  const lastName = createdBy.lastName?.trim() ?? '';
  return firstName && lastName ? `${firstName} ${lastName}` : '—';
}
