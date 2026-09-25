export type CreateBultoResult = {
  error?: string;
  success?: string;
  count?: number;
};

export function validateBultoInput(
  bultoCode: string,
  deliveryIds: string[],
): string | null {
  const clean = bultoCode.trim();
  if (!clean || clean.length < 2) {
    return "El código de bulto debe tener al menos 2 caracteres (ej: BULTO-1, B-01)";
  }
  if (!deliveryIds || deliveryIds.length === 0) {
    return "Debes seleccionar al menos una entrega para armar el bulto";
  }
  return null;
}
