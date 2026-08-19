export function sanitizeDeliverySearch(raw: string): string {
  return raw
    .replace(/[,()%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function deliveryTextSearchOr(raw: string): string | null {
  const q = sanitizeDeliverySearch(raw);
  if (!q) return null;
  return `number.ilike.%${q}%,destination.ilike.%${q}%,pallet_code.ilike.%${q}%`;
}

export function deliveryMatchesQuery(
  row: {
    number: string;
    destination: string;
    pallet_code?: string | null;
    client_name?: string | null;
    assignee_name?: string | null;
  },
  raw: string,
): boolean {
  const q = sanitizeDeliverySearch(raw).toLowerCase();
  if (!q) return true;
  return [row.number, row.destination, row.pallet_code, row.client_name, row.assignee_name]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(q));
}
