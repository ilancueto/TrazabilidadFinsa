export function adminDeliveryPath(number: string, suffix = ""): string {
  return `/admin/deliveries/${encodeURIComponent(number)}${suffix}`;
}

export function pickingDeliveryPath(number: string, requirementId?: string): string {
  const base = `/picking/${encodeURIComponent(number)}`;
  return requirementId ? `${base}/${encodeURIComponent(requirementId)}` : base;
}
