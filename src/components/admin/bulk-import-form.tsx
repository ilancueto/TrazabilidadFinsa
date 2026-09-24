"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseSapInput, type ParsedSapDelivery } from "@/lib/sap/parser";
import { bulkCreateDeliveriesAction, type BulkImportResult } from "@/lib/actions/bulk-import";
import type { Client, ClientAlias } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BulkImportForm({
  clients,
  aliases,
  existingNumbers,
}: {
  clients: Client[];
  aliases: ClientAlias[];
  existingNumbers: string[];
}) {
  const router = useRouter();
  const fileInputId = useId();
  const existingSet = useMemo(() => new Set(existingNumbers.map((n) => n.toLowerCase())), [existingNumbers]);

  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<ParsedSapDelivery[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result ?? "");
      setRawText(content);
      processInput(content);
    };
    reader.readAsText(file);
  }

  function handleTextChange(text: string) {
    setRawText(text);
    processInput(text);
  }

  function processInput(content: string) {
    if (!content.trim()) {
      setDeliveries([]);
      setSelectedIds(new Set());
      return;
    }
    const result = parseSapInput(content, existingSet, clients, aliases);
    setDeliveries(result.deliveries);

    // Seleccionar por defecto todas las que son válidas (no excluidas ni duplicadas)
    const validIds = new Set(
      result.deliveries.filter((d) => !d.isExcluded && !d.isDuplicate).map((d) => d.id),
    );
    setSelectedIds(validIds);
  }

  function toggleSelectAll() {
    const validRows = deliveries.filter((d) => !d.isExcluded && !d.isDuplicate);
    if (selectedIds.size === validRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(validRows.map((d) => d.id)));
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateRowClient(id: string, clientId: string) {
    setDeliveries((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const matched = clients.find((c) => c.id === clientId) ?? null;
        return {
          ...row,
          selectedClientId: clientId || null,
          matchedClient: matched,
          saveAliasOnImport: Boolean(row.rawCustomer && clientId),
        };
      }),
    );
  }

  function updateRowSaveAlias(id: string, save: boolean) {
    setDeliveries((prev) =>
      prev.map((row) => (row.id === id ? { ...row, saveAliasOnImport: save } : row)),
    );
  }

  function handleBatchSubmit() {
    const itemsToCreate = deliveries
      .filter((d) => selectedIds.has(d.id))
      .map((d) => ({
        number: d.number,
        destination: d.rawDestination || d.rawCustomer || "Neuquén",
        packages: d.packages,
        clientId: d.selectedClientId,
        saveAlias:
          d.saveAliasOnImport && d.rawCustomer && d.selectedClientId
            ? { alias: d.rawCustomer, clientId: d.selectedClientId }
            : null,
      }));

    if (itemsToCreate.length === 0) return;

    startTransition(async () => {
      const res = await bulkCreateDeliveriesAction(itemsToCreate);
      setImportResult(res);
      if (res.success && res.errorCount === 0) {
        setTimeout(() => {
          router.push("/admin");
        }, 2500);
      }
    });
  }

  const validCount = deliveries.filter((d) => !d.isExcluded && !d.isDuplicate).length;
  const excludedCount = deliveries.filter((d) => d.isExcluded).length;
  const duplicateCount = deliveries.filter((d) => d.isDuplicate).length;

  if (importResult) {
    return (
      <div className="panel p-6 sm:p-8 rounded-2xl border-line/80 max-w-2xl mx-auto space-y-6 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-ok/20 text-ok text-3xl font-black">
          ✓
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {importResult.success ? `¡${importResult.createdCount} entregas creadas con éxito!` : "Error en la importación"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {importResult.success
              ? "Ya están publicadas y disponibles en bodega para que Picking comience la preparación."
              : "Ocurrió un error al procesar las entregas."}
          </p>
        </div>

        {importResult.errors.length > 0 ? (
          <div className="text-left bg-danger/10 border border-danger/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-danger uppercase tracking-wider">Errores detectados ({importResult.errors.length}):</p>
            <ul className="text-xs text-foreground/90 space-y-1 list-disc pl-4">
              {importResult.errors.map((err) => (
                <li key={`${err.number}-${err.error}`}>
                  <strong>{err.number}:</strong> {err.error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-center gap-3 pt-4">
          <Link href="/admin" className="btn btn-primary rounded-xl px-6 font-bold shadow-md shadow-cat/20">
            Ir al Tablero de Entregas →
          </Link>
          <button
            type="button"
            onClick={() => {
              setImportResult(null);
              setDeliveries([]);
              setRawText("");
              setFileName(null);
            }}
            className="btn btn-ghost rounded-xl px-4"
          >
            Cargar otro archivo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Zona de Carga de Archivo / Pegado */}
      <div className="panel p-5 sm:p-6 rounded-2xl border-line/80 shadow-sm bg-gradient-to-br from-card via-surface/60 to-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>📄</span>
              <span>Subir archivo HTML de SAP o pegar texto</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Arrastrá el archivo exportado de SAP (filtra automáticamente la ruta <code className="text-cat font-mono">ARRETI</code>).
            </p>
          </div>
          <label htmlFor={fileInputId} className="btn btn-outline btn-sm rounded-xl font-bold cursor-pointer whitespace-nowrap self-start sm:self-auto">
            <span>📎 Elegir archivo HTML</span>
            <input
              id={fileInputId}
              type="file"
              accept=".html,.htm,.txt,.csv"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        </div>

        {fileName ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-elevated/70 border border-line text-xs font-semibold">
            <span className="flex items-center gap-2 text-foreground">
              <span>✓ Archivo cargado:</span>
              <strong className="font-mono text-cat">{fileName}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setFileName(null);
                setRawText("");
                setDeliveries([]);
              }}
              className="text-muted hover:text-danger text-xs font-bold"
            >
              Quitar ✕
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="O pegá acá el HTML copiado de SAP o una lista de números de remito..."
              className="field font-mono text-xs min-h-24 rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Resumen de Detección */}
      {deliveries.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="panel p-4 rounded-xl border-line/80 bg-surface/80">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Total detectadas</p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-extrabold text-foreground">{deliveries.length}</p>
          </div>
          <div className="panel p-4 rounded-xl border-ok/40 bg-ok/5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-ok">Listas para crear</p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-extrabold text-ok">{validCount}</p>
          </div>
          <div className="panel p-4 rounded-xl border-danger/40 bg-danger/5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-danger">Omitidas (ARRETI)</p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-extrabold text-danger">{excludedCount}</p>
          </div>
          <div className="panel p-4 rounded-xl border-line/80 bg-surface/80">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Ya existen</p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-extrabold text-muted">{duplicateCount}</p>
          </div>
        </div>
      ) : null}

      {/* Tabla de Previsualización y Mapeo */}
      {deliveries.length > 0 ? (
        <div className="panel rounded-2xl border-line/80 shadow-sm overflow-hidden bg-card space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>📋</span>
                <span>Previsualización de entregas ({selectedIds.size} seleccionadas)</span>
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Verificá las razones sociales y clientes asignados antes de crear el lote.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="btn btn-ghost btn-sm rounded-xl text-xs"
              >
                {selectedIds.size === validCount ? "Deseleccionar todo" : "Seleccionar válidas"}
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0 || isPending}
                onClick={handleBatchSubmit}
                className="btn btn-primary rounded-xl font-bold shadow-md shadow-cat/20 active:scale-[0.98] px-5"
              >
                {isPending ? "Creando entregas…" : `✓ Crear ${selectedIds.size} entregas`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th className="w-10">
                    <span className="sr-only">Seleccionar</span>
                  </th>
                  <th>Entrega</th>
                  <th>Ruta SAP</th>
                  <th>Razón Social SAP</th>
                  <th>Cliente asignado en CAT</th>
                  <th>Bultos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  const isBlocked = row.isExcluded || row.isDuplicate;

                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        isBlocked && "opacity-50 bg-black/20",
                        isSelected && "bg-cat/5",
                      )}
                    >
                      <td>
                        <input
                          type="checkbox"
                          disabled={isBlocked}
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Seleccionar entrega ${row.number}`}
                          className="h-4 w-4 rounded accent-cat cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="font-mono font-bold text-sm text-cat">
                        {row.number}
                      </td>
                      <td>
                        {row.rawRoute ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                              row.isExcluded
                                ? "bg-danger/20 text-danger border border-danger/40"
                                : "bg-elevated text-muted border border-line",
                            )}
                          >
                            {row.rawRoute}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate font-medium text-foreground/90" title={row.rawCustomer}>
                        {row.rawCustomer || <span className="text-muted italic">Sin nombre en reporte</span>}
                      </td>
                      <td>
                        {isBlocked ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={row.selectedClientId ?? ""}
                              onChange={(e) => updateRowClient(row.id, e.target.value)}
                              aria-label={`Cliente para entrega ${row.number}`}
                              className="field py-1 px-2 text-xs rounded-lg max-w-[220px]"
                            >
                              <option value="">-- Sin cliente asignado --</option>
                              {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-2">
                              {row.matchType === "alias" ? (
                                <span className="text-[10px] font-bold text-ok bg-ok/10 px-1.5 py-0.5 rounded border border-ok/30">
                                  ✓ Regla guardada
                                </span>
                              ) : row.matchType === "exact" ? (
                                <span className="text-[10px] font-bold text-blue bg-blue/10 px-1.5 py-0.5 rounded border border-blue/30">
                                  ✓ Nombre exacto
                                </span>
                              ) : row.matchType === "fuzzy" ? (
                                <span className="text-[10px] font-bold text-cat bg-cat/10 px-1.5 py-0.5 rounded border border-cat/30">
                                  ✓ Coincidencia auto
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted italic">No mapeado</span>
                              )}

                              {row.rawCustomer && row.selectedClientId && row.matchType !== "alias" ? (
                                <label className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-foreground cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={row.saveAliasOnImport}
                                    onChange={(e) => updateRowSaveAlias(row.id, e.target.checked)}
                                    className="h-3 w-3 accent-cat rounded"
                                  />
                                  <span>Recordar alias</span>
                                </label>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="font-mono">{row.packages}</td>
                      <td>
                        {row.isExcluded ? (
                          <span className="inline-flex items-center rounded-full bg-danger/15 px-2.5 py-0.5 text-[10px] font-extrabold text-danger border border-danger/30">
                            {row.excludeReason}
                          </span>
                        ) : row.isDuplicate ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                            Ya existe en bodega
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-ok/15 px-2.5 py-0.5 text-[10px] font-extrabold text-ok border border-ok/30">
                            Lista para crear
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
