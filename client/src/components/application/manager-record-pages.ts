type RecordPage<T> = { items: T[]; total: number; page: number; pageSize: number };

// The records table filters and paginates the combined usage/waste ledger locally.
// Fetch every API page first so its count and date range cover the full ledger.
export async function collectRecordPages<T>(fetchPage: (page: number) => Promise<RecordPage<T>>, key?: (item: T) => string): Promise<T[]> {
  const first = await fetchPage(1);
  if (!Number.isInteger(first.pageSize) || first.pageSize < 1 || !Number.isInteger(first.total) || first.total < 0) throw new Error('Invalid record pagination');
  if (first.page !== 1 || first.items.length !== Math.min(first.pageSize, first.total)) throw new Error('Incomplete record list');
  const items = [...first.items];
  const pages = Math.ceil(first.total / first.pageSize);
  if (pages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => fetchPage(i + 2))
    );
    for (let i = 0; i < remainingPages.length; i += 1) {
      const next = remainingPages[i];
      const page = i + 2;
      if (next.page !== page || next.pageSize !== first.pageSize || next.total !== first.total || next.items.length !== Math.min(first.pageSize, first.total - items.length)) throw new Error('Incomplete record list');
      items.push(...next.items);
    }
  }
  if (items.length !== first.total || key && new Set(items.map(key)).size !== items.length) throw new Error('Incomplete record list');
  return items;
}
