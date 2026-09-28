"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseSapInput, type ParsedSapDelivery } from "@/lib/sap/parser";
import { bulkCreateDeliveriesAction, type BulkImportResult } from "@/lib/actions/bulk-import";
import { saveClientAction } from "@/lib/actions/clients";
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

  const [createdClients, setCreatedClients] = useState<Client[]>([]);
  const clientList = useMemo(() => {
    const map = new Map<string, Client>();
    for (const c of clients) map.set(c.id, c);
    for (const c of createdClients) map.set(c.id, c);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, createdClients]);

  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<ParsedSapDelivery[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Estado para creación rápida de clientes desde las filas
  const [quickCreateRow, setQuickCreateRow] = useState<{ id: string; number: string; rawCustomer: string } | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientSaveError, setClientSaveError] = useState("");

  function readFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result ?? "");
      setRawText(content);
      processInput(content);
    };
    reader.readAsText(file);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    readFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
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
    const result = parseSapInput(content, existingSet, clientList, aliases);
    setDeliveries(result.deliveries);

    // Seleccionar por defecto todas las que son válidas (no excluidas ni duplicadas)
    const validIds = new Set(
      result.deliveries.filter((d) => !d.isExcluded && !d.isDuplicate).map((d) => d.id),
    );
    setSelectedIds(validIds);
  }

  function openQuickCreate(row: ParsedSapDelivery) {
    setQuickCreateRow({ id: row.id, number: row.number, rawCustomer: row.rawCustomer });
    setNewClientName(row.rawCustomer?.trim() || "");
    setClientSaveError("");
  }

  function closeQuickCreate() {
    setQuickCreateRow(null);
    setNewClientName("");
    setClientSaveError("");
  }

  async function handleCreateClient() {
    const trimmed = newClientName.trim();
    if (!trimmed || trimmed.length < 2) {
      setClientSaveError("Ingresá un nombre de al menos 2 caracteres");
      return;
    }

    setIsSavingClient(true);
    setClientSaveError("");

    const formData = new FormData();
    formData.set("name", trimmed);

    try {
      const res = await saveClientAction({}, formData);
      if (res.error) {
        setClientSaveError(res.error);
        return;
      }

      if (res.clientId) {
        const created: Client = {
          id: res.clientId,
          name: trimmed,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setCreatedClients((prev) => [...prev, created]);

        if (quickCreateRow) {
          const targetCustomerRaw = quickCreateRow.rawCustomer?.trim().toLowerCase();
          setDeliveries((prev) =>
            prev.map((r) => {
              const matchesThis = r.id === quickCreateRow.id;
              const matchesSameRaw = Boolean(
                targetCustomerRaw && r.rawCustomer?.trim().toLowerCase() === targetCustomerRaw,
              );
              if (matchesThis || matchesSameRaw) {
                return {
                  ...r,
                  selectedClientId: res.clientId!,
                  matchedClient: created,
                  saveAliasOnImport: Boolean(r.rawCustomer),
                  matchType: matchesThis ? "exact" : r.matchType,
                };
              }
              return r;
            }),
          );
        }

        closeQuickCreate();
      }
    } catch {
      setClientSaveError("Error al guardar el cliente en catálogo");
    } finally {
      setIsSavingClient(false);
    }
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
        const matched = clientList.find((c) => c.id === clientId) ?? null;
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
    const isFullSuccess = importResult.success && importResult.errorCount === 0;
    const isPartial = importResult.createdCount > 0 && importResult.errorCount > 0;
    const isTotalFailure = importResult.createdCount === 0;

    return (
      <div className="panel p-6 sm:p-8 rounded-2xl border-line/80 max-w-2xl mx-auto space-y-6 text-center">
        {isFullSuccess && (
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-ok/20 border border-ok/40 text-ok text-3xl font-black">
            ✓
          </div>
        )}
        {isPartial && (
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-cat/20 border border-cat/40 text-cat text-3xl font-black">
            ⚠
          </div>
        )}
        {isTotalFailure && (
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-danger/20 border border-danger/40 text-danger text-3xl font-black">
            ✕
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isFullSuccess && `¡${importResult.createdCount} entregas creadas con éxito!`}
            {isPartial && `Importación parcial: ${importResult.createdCount} creadas, ${importResult.errorCount} con error`}
            {isTotalFailure && "Error en la importación"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {isFullSuccess && "Ya están publicadas y disponibles en bodega para que Picking comience la preparación."}
            {isPartial && "Se crearon algunas entregas, pero otras tuvieron problemas. Revisá los errores abajo."}
            {isTotalFailure && "No se pudo crear ninguna entrega. Revisá los errores detectados abajo."}
          </p>
        </div>

        {importResult.errors.length > 0 ? (
          <div className="text-left bg-danger/10 border border-danger/30 rounded-xl p-4 space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs font-bold text-danger uppercase tracking-wider sticky top-0 bg-surface/90 py-1 backdrop-blur-sm">
              Errores detectados ({importResult.errors.length}):
            </p>
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
          {importResult.createdCount > 0 && (
            <Link href="/admin" className="btn btn-primary rounded-xl px-6 font-bold shadow-md shadow-cat/20">
              Ir al Tablero de Entregas →
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setImportResult(null);
              setDeliveries([]);
              setRawText("");
              setFileName(null);
            }}
            className={isTotalFailure ? "btn btn-primary rounded-xl px-6 font-bold" : "btn btn-ghost rounded-xl px-4"}
          >
            {isTotalFailure ? "Reintentar / Cargar otro archivo" : "Cargar otro archivo"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Zona de Carga de Archivo / Pegado con soporte Drag & Drop */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "panel p-5 sm:p-6 rounded-2xl border transition-all duration-200 shadow-sm space-y-4",
          isDragging
            ? "border-cat border-2 border-dashed bg-cat/10 ring-4 ring-cat/20"
            : "border-line/80 bg-gradient-to-br from-card via-surface/60 to-card"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>📄</span>
              <span>Subir archivo HTML de SAP o pegar texto</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Arrastrá y soltá el archivo exportado de SAP directamente acá, o hacé clic en elegir archivo (filtra automáticamente la ruta <code className="text-cat font-mono">ARRETI</code>).
            </p>
          </div>
          <label
            htmlFor={fileInputId}
            className="btn btn-outline btn-sm rounded-xl font-bold cursor-pointer whitespace-nowrap self-start sm:self-auto hover:border-cat hover:text-cat"
          >
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

        {isDragging ? (
          <div className="p-8 border-2 border-dashed border-cat/60 rounded-xl bg-cat/5 text-center flex flex-col items-center justify-center gap-2 pointer-events-none">
            <span className="text-3xl animate-bounce">📥</span>
            <p className="text-sm font-bold text-cat">¡Soltá el archivo acá para procesarlo!</p>
            <p className="text-xs text-muted">Soporta HTML exportado de SAP (.html, .htm, .txt)</p>
          </div>
        ) : fileName ? (
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
                            <div className="flex items-center gap-1.5">
                              <select
                                value={row.selectedClientId ?? ""}
                                onChange={(e) => {
                                  if (e.target.value === "__NEW_CLIENT__") {
                                    openQuickCreate(row);
                                  } else {
                                    updateRowClient(row.id, e.target.value);
                                  }
                                }}
                                aria-label={`Cliente para entrega ${row.number}`}
                                className="field py-1 px-2 text-xs rounded-lg max-w-[200px]"
                              >
                                <option value="">-- Sin cliente asignado --</option>
                                <option value="__NEW_CLIENT__" className="font-bold text-cat">
                                  + Crear nuevo cliente…
                                </option>
                                <optgroup label="Clientes del catálogo">
                                  {clientList.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              {!row.selectedClientId ? (
                                <button
                                  type="button"
                                  onClick={() => openQuickCreate(row)}
                                  className="btn btn-ghost btn-sm py-1 px-2 rounded-lg text-[11px] font-bold text-cat hover:bg-cat/10 whitespace-nowrap"
                                  title="Crear cliente en catálogo con este nombre de SAP"
                                >
                                  + Crear
                                </button>
                              ) : null}
                            </div>

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

      {/* Modal / Diálogo para Crear Cliente desde la Fila */}
      {quickCreateRow ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-client-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQuickCreate();
          }}
        >
          <div className="panel max-w-md w-full p-6 rounded-2xl border-line/90 shadow-2xl bg-card space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div>
                <h3 id="quick-client-title" className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>🏢</span>
                  <span>Nuevo cliente en catálogo</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Para entrega <span className="font-mono font-bold text-foreground">#{quickCreateRow.number}</span>
                  {quickCreateRow.rawCustomer ? ` (${quickCreateRow.rawCustomer})` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeQuickCreate}
                className="text-muted hover:text-foreground text-sm font-bold p-1 rounded-lg hover:bg-surface"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="quick-client-name" className="block text-xs font-semibold text-foreground/90">
                Nombre o Razón Social del Cliente
              </label>
              <input
                id="quick-client-name"
                value={newClientName}
                onChange={(e) => {
                  setNewClientName(e.target.value);
                  setClientSaveError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateClient();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeQuickCreate();
                  }
                }}
                placeholder="Nombre del nuevo cliente…"
                className="field text-sm font-semibold rounded-xl w-full"
                autoFocus
              />
              <p className="text-[11px] text-muted">
                💡 Al crearlo, se asignará automáticamente a todas las entregas del lote con esta razón social y se guardará la equivalencia.
              </p>
              {clientSaveError ? (
                <p className="text-xs font-semibold text-danger">{clientSaveError}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line/60">
              <button
                type="button"
                onClick={closeQuickCreate}
                className="btn btn-ghost btn-sm rounded-xl px-4"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingClient || !newClientName.trim()}
                onClick={handleCreateClient}
                className="btn btn-primary btn-sm rounded-xl px-5 font-bold shadow-md shadow-cat/20"
              >
                {isSavingClient ? "Guardando…" : "Crear y asignar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
