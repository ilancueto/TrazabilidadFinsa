import { adminDeliveryPath, pickingDeliveryPath } from "@/lib/deliveries/paths";
import type { DeliveryListItem } from "@/lib/types";

export type OperationalAlert = {
  id: string;
  number: string;
  label: string;
  href: string;
};

export function buildOperationalAlerts(
  deliveries: DeliveryListItem[],
  now = new Date(),
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  for (const row of deliveries) {
    const href = adminDeliveryPath(row.number);
    if (
      row.priority === "URGENT" &&
      (row.status === "PUBLISHED" || row.status === "IN_PICKING") &&
      row.progress.pendingRequired > 0
    ) {
      const started = row.published_at ?? row.created_at;
      if (now.getTime() - new Date(started).getTime() >= 30 * 60 * 1000) {
        alerts.push({
          id: `${row.id}-urgent`,
          number: row.number,
          label: "Urgente sin foto",
          href,
        });
      }
    }
    if (row.status === "READY" && row.progress.pendingDispatch > 0) {
      alerts.push({
        id: `${row.id}-labels`,
        number: row.number,
        label: `Falta etiqueta: ${row.progress.pendingDispatchLabels.join(", ")}`,
        href,
      });
    } else if (row.status === "READY" && row.ready_at) {
      if (now.getTime() - new Date(row.ready_at).getTime() >= 2 * 60 * 60 * 1000) {
        alerts.push({
          id: `${row.id}-ready`,
          number: row.number,
          label: "Lista sin cerrar",
          href: adminDeliveryPath(row.number, "/revisar"),
        });
      }
    }
    if (
      (row.status === "PUBLISHED" || row.status === "IN_PICKING") &&
      row.progress.pendingRequired > 0 &&
      now.getTime() - new Date(row.updated_at).getTime() >= 30 * 60 * 1000
    ) {
      alerts.push({
        id: `${row.id}-stuck`,
        number: row.number,
        label: "Sin movimiento",
        href,
      });
    }
    if (row.has_open_observation && row.status !== "CLOSED") {
      alerts.push({
        id: `${row.id}-obs`,
        number: row.number,
        label: "Observación abierta",
        href,
      });
    }
  }
  return alerts;
}

export function buildPickingAlerts(
  deliveries: DeliveryListItem[],
  userId: string,
  now = new Date(),
): OperationalAlert[] {
  return buildOperationalAlerts(deliveries, now)
    .filter((alert) => {
      const row = deliveries.find((item) => alert.id.startsWith(`${item.id}-`));
      if (!row) return false;
      if (row.assignee_id && row.assignee_id !== userId) return false;
      return true;
    })
    .map((alert) => {
      const row = deliveries.find((item) => alert.id.startsWith(`${item.id}-`));
      return {
        ...alert,
        href: row ? pickingDeliveryPath(row.number) : alert.href,
      };
    });
}
