"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { bulkAssignPickerAction } from "@/lib/actions/clients";
import { createBultoAction, dismantleBultoAction } from "@/lib/actions/bultos";
import { adminDeliveryPath } from "@/lib/deliveries/paths";
import { MODALITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { canBulkAssignPallet } from "@/lib/deliveries/permissions";
import type { DeliveryListItem, Profile, UserRole } from "@/lib/types";

export function BatchGrouper({
  deliveries,
  pickers = [],
  role,
}: {
  deliveries: DeliveryListItem[];
  pickers?: Profile[];
  role: UserRole;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [bultoInput, setBultoInput] = useState("");
  const [quickNumbersInput, setQuickNumbersInput] = useState("");
  const [selectedPickerId, setSelectedPickerId] = useState("");
  const allowPallet = canBulkAssignPallet(role);
  const [activeTab, setActiveTab] = useState<"armar" | "activos" | "picker">("armar");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: "ok" | "danger" } | null>(null);

  // Entregas seleccionadas
  const selectedDeliveries = deliveries.filter((d) => selectedIds.has(d.id));

  // Detección automática del cliente común
  const detectedClients = Array.from(
    new Set(selectedDeliveries.map((d) => d.client_name?.trim() || d.destination?.trim()).filter(Boolean)),
  );

  // Mapa de bultos activos agrupados por pallet_code
  const bultosMap = new Map<string, DeliveryListItem[]>();
  deliveries.forEach((d) => {
    if (d.pallet_code) {
      const list = bultosMap.get(d.pallet_code) ?? [];
      list.push(d);
      bultosMap.set(d.pallet_code, list);
    }
  });

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

  function canSelect(status: DeliveryListItem["status"]) {
    return activeTab !== "picker" || (status !== "DRAFT" && status !== "CLOSED");
  }

  const selectable = filtered.filter((d) => canSelect(d.status));
  const allSelected = selectable.length > 0 && selectable.every((d) => selectedIds.has(d.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((d) => d.id)));
    }
  }

  function toggleOne(id: string, status: DeliveryListItem["status"]) {
    if (!canSelect(status)) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      // Si el código de bulto está vacío, sugerir automáticamente uno basado en la entrega
      if (!bultoInput.trim()) {
        const item = deliveries.find((d) => d.id === id);
        if (item) {
          setBultoInput(`BULTO-${item.number}`);
        }
      }
    }
    setSelectedIds(next);
  }

  // Agregar entregas tipeadas/pegadas en el input rápido
  function handleQuickAddNumbers() {
    const rawTokens = quickNumbersInput
      .split(/[\s,;]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length >= 3);

    if (rawTokens.length === 0) return;

    const matchedIds = new Set(selectedIds);
    let matchedCount = 0;

    deliveries.forEach((d) => {
      const numUpper = d.number.toUpperCase();
      if (rawTokens.some((token) => numUpper === token || numUpper.endsWith(token))) {
        matchedIds.add(d.id);
        matchedCount++;
      }
    });

    setSelectedIds(matchedIds);
    setQuickNumbersInput("");

    if (matchedCount > 0) {
      setMessage({
        type: "ok",
        text: `Se agregaron ${matchedCount} entregas a la selección.`,
      });
      if (!bultoInput.trim() && rawTokens[0]) {
        setBultoInput(`BULTO-${rawTokens[0]}`);
      }
    } else {
      setMessage({
        type: "danger",
        text: "No se encontraron entregas activas con esos números.",
      });
    }
  }

  // Acción para crear el bulto
  function handleCreateBulto() {
    if (selectedIds.size === 0 || !bultoInput.trim()) return;
    startTransition(async () => {
      const res = await createBultoAction(Array.from(selectedIds), bultoInput);
      if (res.error) {
        setMessage({ type: "danger", text: res.error });
      } else {
        setMessage({ type: "ok", text: res.success || "Bulto creado con éxito" });
        setSelectedIds(new Set());
        setBultoInput("");
      }
    });
  }

  // Acción para desarmar un bulto
  function handleDismantle(bultoCode: string) {
    if (!confirm(`¿Estás seguro de desarmar el bulto "${bultoCode}"? Las entregas volverán a quedar sueltas.`)) {
      return;
    }
    startTransition(async () => {
      const res = await dismantleBultoAction(bultoCode);
      if (res.error) {
        setMessage({ type: "danger", text: res.error });
      } else {
        setMessage({ type: "ok", text: res.success || "Bulto desarmado" });
      }
    });
  }

  // Acción para asignar picker
  function handleAssignPicker(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedIds.size === 0 || !selectedPickerId) return;

    const formData = new FormData();
    formData.set("intent", "picker");
    formData.set("assigneeId", selectedPickerId);
    selectedIds.forEach((id) => formData.append("deliveryId", id));

    startTransition(async () => {
      const res = await bulkAssignPickerAction({}, formData);
      if (res.error) {
        setMessage({ type: "danger", text: res.error });
      } else {
        setMessage({ type: "ok", text: res.success || "Responsable asignado con éxito" });
        setSelectedIds(new Set());
        setSelectedPickerId("");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Navegación por pestañas de la sección */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("armar")}
            className={`btn btn-sm rounded-xl font-bold transition-all ${
              activeTab === "armar"
                ? "bg-cat text-black shadow-md shadow-cat/20"
                : "btn-ghost text-muted hover:text-foreground"
            }`}
          >
            📦 Armar Bulto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activos")}
            className={`btn btn-sm rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "activos"
                ? "bg-cat text-black shadow-md shadow-cat/20"
                : "btn-ghost text-muted hover:text-foreground"
            }`}
          >
            <span>📋 Bultos Activos</span>
            <span className="rounded-full bg-surface px-1.5 py-0.2 text-xs font-mono font-bold">
              {bultosMap.size}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("picker")}
            className={`btn btn-sm rounded-xl font-bold transition-all ${
              activeTab === "picker"
                ? "bg-cat text-black shadow-md shadow-cat/20"
                : "btn-ghost text-muted hover:text-foreground"
            }`}
          >
            👤 Asignar Picker
          </button>
        </div>

        <div className="text-xs text-muted">
          {deliveries.length} entregas activas
        </div>
      </div>

      {message ? (
        <div
          className={`banner ${
            message.type === "ok" ? "banner-ok" : "banner-danger"
          } flex items-center justify-between rounded-xl`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs font-bold underline opacity-80 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      ) : null}

      {/* PESTAÑA 1: ARMAR BULTO */}
      {activeTab === "armar" && allowPallet ? (
        <div className="space-y-4">
          {/* Panel de Creación Rápida */}
          <div className="panel p-5 rounded-2xl border-line/90 bg-elevated shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <span>📦</span>
                  <span>Nuevo Bulto Consolidado</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Las entregas asignadas a este bulto compartirán automáticamente el <strong>Remito de Andreani</strong> y las <strong>Etiquetas</strong> en Picking.
                </p>
              </div>

              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="btn btn-ghost btn-sm text-xs"
                >
                  ✕ Limpiar selección ({selectedIds.size})
                </button>
              ) : null}
            </div>

            {/* Input rápido por número de entrega */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={quickNumbersInput}
                onChange={(e) => setQuickNumbersInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickAddNumbers();
                  }
                }}
                placeholder="Pegá o escribí números 806... (separados por coma o espacio)"
                className="field flex-1 font-mono text-sm"
              />
              <button
                type="button"
                onClick={handleQuickAddNumbers}
                disabled={!quickNumbersInput.trim()}
                className="btn btn-outline btn-sm rounded-xl font-bold"
              >
                ＋ Cargar al bulto
              </button>
            </div>

            {/* Resumen de entregas seleccionadas y Cliente detectado */}
            {selectedIds.size > 0 ? (
              <div className="rounded-xl border border-line bg-surface/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cat text-xs font-black text-black">
                      {selectedIds.size}
                    </span>
                    <strong className="text-sm">
                      {selectedIds.size === 1
                        ? "1 entrega en este bulto"
                        : `${selectedIds.size} entregas en este bulto`}
                    </strong>
                  </div>

                  {/* Detección de Cliente */}
                  {detectedClients.length === 1 ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-ok/30 bg-ok/10 px-2.5 py-1 text-xs font-bold text-ok">
                      <span>🏢 Cliente detectado:</span>
                      <span className="text-foreground">{detectedClients[0]}</span>
                    </div>
                  ) : detectedClients.length > 1 ? (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
                      <span>⚠️ Clientes distintos:</span>
                      <span>{detectedClients.join(", ")}</span>
                    </div>
                  ) : null}
                </div>

                {/* Chips de entregas agregadas */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedDeliveries.map((d) => (
                    <span
                      key={d.id}
                      className="inline-flex items-center gap-1 rounded-md border border-line bg-elevated px-2 py-0.5 font-mono text-xs font-medium text-foreground"
                    >
                      <span>{d.number}</span>
                      {d.pallet_code ? (
                        <span className="text-[10px] text-cat" title={`Ya estaba en el bulto ${d.pallet_code}`}>
                          (era {d.pallet_code})
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleOne(d.id, d.status)}
                        className="text-muted hover:text-danger ml-0.5 text-xs font-bold"
                        title="Quitar de la selección"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                {/* Formulario de confirmación del bulto */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="bulto-code-input" className="text-xs font-bold text-muted whitespace-nowrap">
                      Identificador de Bulto:
                    </label>
                    <input
                      id="bulto-code-input"
                      value={bultoInput}
                      onChange={(e) => setBultoInput(e.target.value)}
                      placeholder="Ej: BULTO-1, B-01..."
                      className="field w-48 font-mono text-sm"
                      disabled={isPending}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateBulto}
                    disabled={isPending || selectedIds.size === 0 || !bultoInput.trim()}
                    className="btn btn-primary rounded-xl font-bold shadow-md shadow-cat/20 flex items-center gap-1.5"
                  >
                    <span>{isPending ? "Guardando…" : "📦 Confirmar y Armar Bulto"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted italic">
                Tip: Tildá entregas de la tabla de abajo o pegá sus números arriba para unirlas en el mismo bulto.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* PESTAÑA 2: BULTOS ACTIVOS */}
      {activeTab === "activos" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground">
              Bultos actualmente en preparación ({bultosMap.size})
            </h3>
            <p className="text-xs text-muted">
              Al completarse el remito o etiqueta de una entrega, se actualizan las demás del mismo bulto.
            </p>
          </div>

          {bultosMap.size === 0 ? (
            <div className="panel p-8 text-center text-muted rounded-2xl">
              No hay bultos consolidados activos en este momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from(bultosMap.entries()).map(([bultoCode, items]) => {
                const clientName = items[0]?.client_name || items[0]?.destination || "Varios";
                const totalPackages = items.reduce((sum, item) => sum + item.packages, 0);
                return (
                  <div
                    key={bultoCode}
                    className="panel p-4 rounded-2xl border-line/80 bg-surface shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 border-b border-line/60 pb-2.5">
                        <div>
                          <span className="inline-flex items-center gap-1 font-mono text-sm font-black text-cat border border-cat/30 bg-cat/10 px-2.5 py-0.5 rounded-lg">
                            📦 {bultoCode}
                          </span>
                          <p className="text-xs font-bold text-foreground mt-1.5">
                            {clientName}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-muted bg-elevated px-2 py-0.5 rounded-md border border-line/60">
                          {items.length} {items.length === 1 ? "entrega" : "entregas"} · {totalPackages} bultos
                        </span>
                      </div>

                      {/* Lista de entregas del bulto */}
                      <ul className="mt-3 space-y-1.5 text-xs">
                        {items.map((it) => (
                          <li
                            key={it.id}
                            className="flex items-center justify-between rounded-lg bg-elevated/70 px-2.5 py-1.5 border border-line/50 font-mono"
                          >
                            <Link
                              href={adminDeliveryPath(it.number)}
                              className="font-bold text-foreground hover:text-cat transition-colors"
                            >
                              {it.number}
                            </Link>
                            <span className="text-[11px] text-muted">
                              {STATUS_LABEL[it.status] || it.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2 border-t border-line/50 flex justify-end">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDismantle(bultoCode)}
                        className="btn btn-ghost btn-sm text-xs text-muted hover:text-danger font-semibold"
                        title="Quita este bulto de todas sus entregas"
                      >
                        ✕ Desarmar bulto
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* PESTAÑA 3: ASIGNAR RESPONSABLE DE PICKING */}
      {activeTab === "picker" ? (
        <form onSubmit={handleAssignPicker} className="panel p-4 rounded-2xl bg-elevated shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-foreground">Asignar Responsable de Picking en Lote</h3>
              <p className="text-xs text-muted">
                Seleccioná las entregas en la tabla de abajo y elegí el operario para asignarlas a todas juntas.
              </p>
            </div>
            <span className="text-xs font-bold text-foreground bg-cat px-2.5 py-1 rounded-md text-black">
              {selectedIds.size} seleccionadas
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <select
              value={selectedPickerId}
              onChange={(e) => setSelectedPickerId(e.target.value)}
              disabled={selectedIds.size === 0 || isPending}
              className="field w-64 text-sm"
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
              disabled={selectedIds.size === 0 || !selectedPickerId || isPending}
              className="btn btn-primary rounded-xl font-bold"
            >
              {isPending ? "Asignando…" : "👤 Asignar a seleccionadas"}
            </button>
          </div>
        </form>
      ) : null}

      {/* TABLA DE ENTREGAS DISPONIBLES */}
      <div className="panel overflow-hidden rounded-2xl border-line/80 shadow-sm">
        {/* Buscador de entregas */}
        <div className="p-3.5 border-b border-line flex flex-wrap items-center justify-between gap-3 bg-surface/50">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por número, cliente, destino o bulto…"
            className="field max-w-sm text-sm"
          />
          <span className="text-xs text-muted">
            Mostrando {filtered.length} de {deliveries.length} entregas activas
          </span>
        </div>

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
                <th>Bulto actual</th>
                <th>Cliente / Destino</th>
                <th>Responsable</th>
                <th>Modalidad</th>
                <th>Estado</th>
                <th>Piezas</th>
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
                  const selectableRow = canSelect(row.status);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => toggleOne(row.id, row.status)}
                      className={`transition-colors ${
                        selectableRow ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      } ${isSelected ? "bg-cat/15 font-semibold" : selectableRow ? "hover:bg-surface/60" : ""}`}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!selectableRow}
                          onChange={() => toggleOne(row.id, row.status)}
                          aria-label={`Seleccionar entrega ${row.number}`}
                          className="h-4 w-4 rounded"
                        />
                      </td>
                      <td className="font-mono">
                        <Link
                          href={adminDeliveryPath(row.number)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline font-bold text-foreground"
                        >
                          {row.number}
                        </Link>
                      </td>
                      <td>
                        {row.pallet_code ? (
                          <span className="inline-block rounded-md border border-cat/40 bg-cat/10 px-2 py-0.5 font-mono text-xs font-bold text-cat">
                            📦 {row.pallet_code}
                          </span>
                        ) : (
                          <span className="text-xs text-muted italic">Suelto</span>
                        )}
                      </td>
                      <td>
                        <p className="font-medium text-foreground">{row.client_name || row.destination}</p>
                        {row.client_name && row.destination !== row.client_name ? (
                          <p className="text-xs text-muted">{row.destination}</p>
                        ) : null}
                      </td>
                      <td className="text-xs">
                        {row.assignee_name ? (
                          <span className="font-medium text-foreground">👤 {row.assignee_name}</span>
                        ) : (
                          <span className="text-muted">Sin asignar</span>
                        )}
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
