import { describe, expect, it } from "vitest";
import { buildOperationalAlerts, buildPickingAlerts } from "@/lib/deliveries/alerts";
import type { DeliveryListItem } from "@/lib/types";

function row(partial: Partial<DeliveryListItem>): DeliveryListItem {
  return {
    id: "d1",
    number: "8001",
    modality: "DESPACHO",
    carrier: "ANDREANI",
    destination: "Neuquén",
    packages: 1,
    priority: "NORMAL",
    status: "IN_PICKING",
    assignee_id: "u1",
    created_by: "a1",
    observations: null,
    has_open_observation: false,
    published_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    ready_at: null,
    due_at: null,
    closed_at: null,
    closed_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    assignee_name: "Emilio",
    progress: {
      complete: 0,
      total: 4,
      pendingRequired: 2,
      pendingCriticalLabels: ["Remito"],
      pendingDispatch: 1,
      pendingDispatchLabels: ["Etiquetas Andreani"],
      dispatchComplete: 0,
      dispatchTotal: 1,
    },
    ...partial,
  };
}

describe("alerts", () => {
  it("marca entregas de piso sin movimiento", () => {
    const alerts = buildOperationalAlerts([row({})]);
    expect(alerts.some((alert) => alert.label === "Sin movimiento")).toBe(true);
  });

  it("en picking sólo muestra las mías o libres", () => {
    const mine = buildPickingAlerts([row({ assignee_id: "u1" })], "u1");
    const others = buildPickingAlerts([row({ assignee_id: "u2" })], "u1");
    expect(mine.length).toBeGreaterThan(0);
    expect(others).toHaveLength(0);
  });

  it("lista sin etiqueta no es lista para cerrar", () => {
    const alerts = buildOperationalAlerts([
      row({
        status: "READY",
        ready_at: new Date().toISOString(),
        progress: {
          complete: 4,
          total: 4,
          pendingRequired: 0,
          pendingCriticalLabels: [],
          pendingDispatch: 1,
          pendingDispatchLabels: ["Etiquetas Andreani"],
          dispatchComplete: 0,
          dispatchTotal: 1,
        },
      }),
    ]);
    expect(alerts.some((alert) => alert.label.includes("Falta etiqueta"))).toBe(true);
  });
});
