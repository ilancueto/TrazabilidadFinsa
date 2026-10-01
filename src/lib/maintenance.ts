/**
 * Control centralizado para pantalla temporal de fuera de servicio / mantenimiento.
 * Para desactivar y volver a la app normal en cualquier momento:
 * - Cambiar este valor a `false` o definir `NEXT_PUBLIC_MAINTENANCE_MODE="false"`.
 */
export const MAINTENANCE_MODE_ACTIVE =
  process.env.NEXT_PUBLIC_MAINTENANCE_MODE !== undefined
    ? process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true"
    : true;
