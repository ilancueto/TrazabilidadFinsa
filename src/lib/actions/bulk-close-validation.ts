export const BULK_CLOSE_CONFIRMATION = "CERRAR TODAS";
export const BULK_CLOSE_MIN_REASON_LENGTH = 5;

export function validateBulkCloseInput(reason: string, confirmation: string): string | null {
  if (reason.trim().length < BULK_CLOSE_MIN_REASON_LENGTH) {
    return "Escribí un motivo de al menos 5 caracteres";
  }
  if (confirmation.trim() !== BULK_CLOSE_CONFIRMATION) {
    return "Escribí CERRAR TODAS para confirmar";
  }
  return null;
}
