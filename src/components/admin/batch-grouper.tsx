"use client";

import { useState, useActionState, useTransition } from "react";
import Link from "next/link";
import { bulkAssignPalletAction, bulkAssignPickerAction } from "@/lib/actions/clients";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { MODALITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { DeliveryListItem, Profile } from "@/lib/types";

export function BatchGrouper({
  deliveries,
  pickers = [],
}: {
  deliveries: DeliveryListItem[];
  pickers?: Profile[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [palletInput, setPalletInput] = useState("");
  const [selectedPickerId, setSelectedPickerId] = useState("");
  const [tabAction, setTabAction] = useState<"pallet" | "picker">("pallet");
  const [, startTransition] = useTransition();

  const [state, action, pending] = useActionState(
    async (prev: { error?: string; success?: string }, formData: FormData) => {
      const isPicker = formData.get("intent") === "picker";
      const res = isPicker
        ? await bulkAssignPickerAction(prev, formData)
        : await bulkAssignPalletAction(prev, formData);

      if (res.success && !res.error) {
        setSelectedIds(new Set());
        setPalletInput("");
      }
      return res;
    },
    {} as { error?: string; success?: string },
  );

  const filtered = deliveries.filter((d) => {
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    return (
      d.number.toLowerCase().includes(q) ||
      d.destination.toLowerCase().includes(q) ||
      (d.client_name && d.client_name.toLowerCase().includes(q)) ||
      (d.pallet_code && d.pallet_code.toLowerCase().includes(q)) ||
      (d.assignee_name && d.assignee_name.toLowerCase().includes(q))
    );
  });

  const allSelected = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((d) => d.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  // Lotes existentes únicos para sugerencias rápidas
  const existingPallets = Array.from(
    new Set(deliveries.map((d) => d.pallet_code).filter(Boolean)),
  ) as string[];

  return (
    <div className="space-y-4">
      {/* Barra de Búsqueda y Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por número, cliente, responsable o lote…"
          className="field max-w-sm"
        />
        <div className="text-xs text-muted">
          Mostrando {filtered.length} de {deliveries.length} entregas activas
        </div>
      </div>

      {state.error ? <p className="banner banner-danger">{state.error}</p> : null}
      {state.success ? <p className="banner banner-ok">{state.success}</p> : null}

      {/* Toolbar flotante / superior cuando hay seleccionadas */}
      <form action={action} className="panel sticky top-2 z-20 space-y-3 p-4 shadow-xl border-cat/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cat text-sm font-extrabold text-black">
              {selectedIds.size}
            </span>
            <strong className="text-sm">
              {selectedIds.size === 1 ? "1 entrega seleccionada" : `${selectedIds.size} entregas seleccionadas`}
            </strong>
          </div>

          <div className="inline-flex rounded border border-line bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTabAction("pallet")}
              className={`rounded px-3 py-1 font-semibold transition ${
                tabAction === "pallet" ? "bg-cat text-black" : "text-muted hover:text-foreground"
              }`}
            >
              📦 Asignar Lote / Pallet
            </button>
            <button
              type="button"
              onClick={() => setTabAction("picker")}
              className={`rounded px-3 py-1 font-semibold transition ${
                tabAction === "picker" ? "bg-cat text-black" : "text-muted hover:text-foreground"
              }`}
            >
              👤 Asignar Responsable
            </button>
          </div>
        </div>

        {/* Inputs ocultos con los IDs seleccionados */}
        {Array.from(selectedIds).map((id) => (
          <input key={id} type="hidden" name="deliveryId" value={id} />
        ))}
        <input type="hidden" name="intent" value={tabAction} />

        {tabAction === "pallet" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                name="palletCode"
                value={palletInput}
                onChange={(e) => setPalletInput(e.target.value)}
                placeholder="Ej: Pallet 1, Bulto 3, OC-9841..."
                className="field w-56 font-mono text-sm"
                disabled={selectedIds.size === 0 || pending}
              />

              <button
                type="submit"
                disabled={selectedIds.size === 0 || !palletInput.trim() || pending}
                className="btn btn-primary"
              >
                {pending ? "Guardando…" : "📦 Agrupar en lote"}
              </button>

              <button
                type="button"
                disabled={selectedIds.size === 0 || pending}
                onClick={() => {
                  const formData = new FormData();
                  formData.set("intent", "pallet");
                  formData.set("palletCode", "");
                  for (const id of selectedIds) {
                    formData.append("deliveryId", id);
                  }
                  startTransition(async () => {
                    await action(formData);
                  });
                }}
                className="btn btn-ghost text-xs"
                title="Quitar el lote de las entregas seleccionadas"
              >
                ✕ Desagrupar
              </button>
            </div>

            {/* Sugerencias de lotes ya existentes */}
            {existingPallets.length > 0 && selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>Lotes activos:</span>
                {existingPallets.slice(0, 6).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPalletInput(p)}
                    className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-foreground hover:border-cat hover:text-cat"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              name="assigneeId"
              value={selectedPickerId}
              onChange={(e) => setSelectedPickerId(e.target.value)}
              disabled={selectedIds.size === 0 || pending}
              className="field w-56 text-sm"
            >
              <option value="">Seleccionar operario…</option>
              <option value="NONE">Sin asignar (desasignar)</option>
              {pickers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={selectedIds.size === 0 || !selectedPickerId || pending}
              className="btn btn-primary"
            >
              {pending ? "Asignando…" : "👤 Asignar responsable"}
            </button>
          </div>
        )}
      </form>

      {/* Tabla de Entregas Seleccionables */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Seleccionar todas"
                    className="h-4 w-4 rounded"
                  />
                </th>
                <th>Entrega</th>
                <th>Lote / Pallet actual</th>
                <th>Responsable</th>
                <th>Cliente / Destino</th>
                <th>Modalidad</th>
                <th>Estado</th>
                <th>Bultos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No se encontraron entregas.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => toggleOne(row.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? "bg-cat/10 font-semibold" : "hover:bg-surface/50"
                      }`}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Seleccionar entrega ${row.number}`}
                          className="h-4 w-4 rounded"
                        />
                      </td>
                      <td className="font-mono">
                        <Link
                          href={adminDeliveryPath(row.number)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {row.number}
                        </Link>
                      </td>
                      <td>
                        {row.pallet_code ? (
                          <span className="inline-block rounded border border-cat/40 bg-cat/10 px-2 py-0.5 font-mono text-xs font-bold text-cat">
                            📦 {row.pallet_code}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">Sin asignar</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {row.assignee_name ? (
                          <span className="font-medium text-foreground">👤 {row.assignee_name}</span>
                        ) : (
                          <span className="text-muted">Sin asignar</span>
                        )}
                      </td>
                      <td>
                        <p className="font-medium text-foreground">{row.client_name || row.destination}</p>
                        {row.client_name && row.destination !== row.client_name ? (
                          <p className="text-xs text-muted">{row.destination}</p>
                        ) : null}
                      </td>
                      <td className="text-xs text-muted">{MODALITY_LABEL[row.modality]}</td>
                      <td className="text-xs">{STATUS_LABEL[row.status] || row.status}</td>
                      <td className="text-xs">{row.packages}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
