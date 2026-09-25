"use client";

import { useState, useActionState, useTransition } from "react";
import {
  saveClientAction,
  toggleClientStatusAction,
  saveClientAliasAction,
  deleteClientAliasAction,
  type ClientActionState,
} from "@/lib/actions/clients";
import type { Client, ClientAlias } from "@/lib/types";

function getClientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function PencilIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function TrashIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export function ClientManager({
  clients,
  aliases = [],
}: {
  clients: Client[];
  aliases?: ClientAlias[];
}) {
  const [tab, setTab] = useState<"clients" | "aliases">("clients");
  const [filter, setFilter] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [, startTransition] = useTransition();

  // Alias creation form state
  const [newAliasText, setNewAliasText] = useState("");
  const [newAliasClientId, setNewAliasClientId] = useState("");
  const [aliasError, setAliasError] = useState("");
  const [aliasSuccess, setAliasSuccess] = useState("");
  const [isSavingAlias, setIsSavingAlias] = useState(false);

  const [state, action, pending] = useActionState(async (prev: ClientActionState, formData: FormData) => {
    const res = await saveClientAction(prev, formData);
    if (res.success && !res.error) {
      setEditingClient(null);
      setIsCreating(false);
    }
    return res;
  }, {} as ClientActionState);

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase().trim()),
  );

  const filteredAliases = aliases.filter(
    (a) =>
      a.alias.toLowerCase().includes(filter.toLowerCase().trim()) ||
      (a.client_name ?? "").toLowerCase().includes(filter.toLowerCase().trim()),
  );

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.active).length;
  const totalAliases = aliases.length;

  async function handleAddAlias(e: React.FormEvent) {
    e.preventDefault();
    setAliasError("");
    setAliasSuccess("");
    if (!newAliasText.trim() || !newAliasClientId) {
      setAliasError("Completá la razón social en SAP y el cliente asociado.");
      return;
    }
    setIsSavingAlias(true);
    const res = await saveClientAliasAction(newAliasClientId, newAliasText.trim());
    setIsSavingAlias(false);
    if (res.error) {
      setAliasError(res.error);
    } else {
      setAliasSuccess("Equivalencia guardada con éxito.");
      setNewAliasText("");
      setNewAliasClientId("");
      setTimeout(() => setAliasSuccess(""), 3500);
    }
  }

  function handleDeleteAlias(id: string) {
    if (!confirm("¿Eliminar esta regla de equivalencia?")) return;
    startTransition(() => {
      deleteClientAliasAction(id);
    });
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line/80 bg-card/60 p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Clientes</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{totalClients}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cat/10 border border-cat/20 flex items-center justify-center text-cat font-bold">
            🏢
          </div>
        </div>

        <div className="rounded-2xl border border-line/80 bg-card/60 p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Clientes Activos</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-2xl font-black text-foreground">{activeClients}</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
            ✓
          </div>
        </div>

        <div className="rounded-2xl border border-line/80 bg-card/60 p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Reglas SAP</p>
            <p className="text-2xl font-black text-foreground mt-0.5">{totalAliases}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center text-blue font-bold">
            ⚡
          </div>
        </div>
      </div>

      {/* Tabs & Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Modern Pill Tabs */}
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-card border border-line/80 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => {
              setTab("clients");
              setFilter("");
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              tab === "clients"
                ? "bg-cat text-ink shadow-sm"
                : "text-muted hover:text-foreground hover:bg-elevated/40"
            }`}
          >
            <span>Clientes</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                tab === "clients" ? "bg-black/20 text-ink" : "bg-elevated text-muted"
              }`}
            >
              {totalClients}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("aliases");
              setFilter("");
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              tab === "aliases"
                ? "bg-cat text-ink shadow-sm"
                : "text-muted hover:text-foreground hover:bg-elevated/40"
            }`}
          >
            <span>Equivalencias SAP</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                tab === "aliases" ? "bg-black/20 text-ink" : "bg-elevated text-muted"
              }`}
            >
              {totalAliases}
            </span>
          </button>
        </div>

        {/* Action Button for Clientes */}
        {tab === "clients" && (
          <button
            type="button"
            onClick={() => {
              setEditingClient(null);
              setIsCreating(true);
            }}
            className="btn btn-primary inline-flex items-center gap-2 self-start sm:self-auto rounded-xl px-4 py-2 font-bold shadow-cat"
          >
            <PlusIcon />
            <span>Nuevo cliente</span>
          </button>
        )}
      </div>

      {tab === "clients" ? (
        <div className="space-y-4">
          {/* Search Box & Summary Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 border border-line/60 rounded-2xl p-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar por nombre de cliente…"
                className="field pl-9 pr-8 text-sm w-full rounded-xl bg-card border-line/80 focus:border-cat focus:ring-1 focus:ring-cat"
              />
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <p className="text-xs text-muted font-medium px-2">
              {filter.trim()
                ? `${filteredClients.length} de ${totalClients} clientes`
                : `${totalClients} clientes en catálogo`}
            </p>
          </div>

          {/* Modal / Formulario de Creación / Edición */}
          {(isCreating || editingClient) && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Cliente"
            >
              <form
                action={action}
                className="w-full max-w-md bg-card border border-line/90 rounded-2xl p-6 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-line/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cat/10 border border-cat/30 text-cat flex items-center justify-center font-bold text-sm">
                      {editingClient ? "✎" : "+"}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        {editingClient ? "Editar cliente" : "Nuevo cliente"}
                      </h2>
                      <p className="text-xs text-muted">Catálogo maestro de destinos</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingClient(null);
                    }}
                    className="text-muted hover:text-foreground text-lg leading-none p-1"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-muted leading-relaxed">
                  Ingresá el nombre comercial o base de la empresa (ej: &quot;Roque Mocciola&quot;, &quot;Halliburton Añelo&quot;, &quot;AESA&quot;).
                </p>

                {editingClient && <input type="hidden" name="id" value={editingClient.id} />}

                <label className="block space-y-1">
                  <span className="label text-xs font-semibold text-foreground/90">Nombre del cliente</span>
                  <input
                    name="name"
                    required
                    defaultValue={editingClient?.name ?? ""}
                    placeholder="Ej: Roque Mocciola"
                    className="field text-sm font-semibold rounded-xl bg-ink border-line/90 focus:border-cat focus:ring-1 focus:ring-cat w-full"
                    autoFocus
                  />
                </label>

                {state.error ? <p className="banner banner-danger text-xs">{state.error}</p> : null}

                <div className="flex justify-end gap-2.5 pt-3 border-t border-line/70">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setIsCreating(false);
                      setEditingClient(null);
                    }}
                    className="btn btn-ghost text-xs rounded-xl px-4 py-2 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="btn btn-primary text-xs rounded-xl px-4 py-2 font-bold shadow-cat"
                  >
                    {pending ? "Guardando…" : editingClient ? "Guardar cambios" : "Crear cliente"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabla / Lista de Clientes Rediseñada */}
          <div className="rounded-2xl border border-line/80 bg-card/60 backdrop-blur-md overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line/80 bg-elevated/40 text-[11px] font-semibold text-muted tracking-wider uppercase">
                    <th className="py-3 px-4 sm:px-6">Cliente</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-sm">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-muted">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-3xl">🔍</span>
                          <p className="font-semibold text-foreground text-sm">No se encontraron clientes</p>
                          <p className="text-xs text-muted max-w-sm">
                            {filter
                              ? `No hay resultados para la búsqueda "${filter}". Probá con otro término.`
                              : "No hay clientes registrados en el catálogo."}
                          </p>
                          {filter && (
                            <button
                              type="button"
                              onClick={() => setFilter("")}
                              className="btn btn-ghost btn-sm mt-2 text-xs text-cat"
                            >
                              Limpiar búsqueda
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => {
                      const initials = getClientInitials(client.name);
                      return (
                        <tr
                          key={client.id}
                          className={`hover:bg-elevated/40 transition-colors group ${
                            !client.active ? "opacity-60 bg-black/20" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-mono font-bold shrink-0 transition-transform group-hover:scale-105 ${
                                  client.active
                                    ? "bg-cat/10 border border-cat/30 text-cat shadow-sm"
                                    : "bg-elevated border border-line text-muted"
                                }`}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate">{client.name}</p>
                                <p className="text-[11px] text-muted truncate">
                                  {client.active ? "Catálogo bodega" : "Cliente desactivado"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {client.active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                Inactivo
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCreating(false);
                                  setEditingClient(client);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground/80 bg-elevated/60 hover:bg-elevated hover:text-foreground border border-line/80 hover:border-line transition-all"
                              >
                                <PencilIcon />
                                <span>Editar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  startTransition(() => {
                                    toggleClientStatusAction(client.id, !client.active);
                                  });
                                }}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  client.active
                                    ? "text-muted hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/30"
                                    : "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 font-semibold"
                                }`}
                              >
                                {client.active ? "Desactivar" : "Reactivar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Pestaña de Equivalencias SAP */
        <div className="space-y-5">
          {/* Card Formulario Nueva Regla */}
          <form
            onSubmit={handleAddAlias}
            className="rounded-2xl border border-line/80 bg-gradient-to-br from-card via-surface/60 to-card p-5 sm:p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cat/10 border border-cat/30 text-cat flex items-center justify-center font-bold text-sm">
                ⚡
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Nueva regla de equivalencia (&quot;Si en SAP es X ➔ en CAT es Y&quot;)
                </h3>
                <p className="text-xs text-muted">
                  Asociá automáticamente la razón social del reporte SAP con el cliente correcto de bodega.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] gap-3 items-end pt-1">
              <label className="block space-y-1">
                <span className="label text-xs font-semibold text-foreground/90">Razón Social en reporte SAP</span>
                <input
                  type="text"
                  required
                  value={newAliasText}
                  onChange={(e) => setNewAliasText(e.target.value)}
                  placeholder="Ej: Empresa de Construcción Roque Mocciola"
                  className="field text-sm rounded-xl bg-ink border-line/90 focus:border-cat focus:ring-1 focus:ring-cat w-full"
                />
              </label>

              <div className="hidden sm:flex items-center justify-center pb-2 text-muted">
                <ArrowRightIcon className="w-5 h-5 text-cat" />
              </div>

              <label className="block space-y-1">
                <span className="label text-xs font-semibold text-foreground/90">Cliente asignado en CAT</span>
                <select
                  required
                  value={newAliasClientId}
                  onChange={(e) => setNewAliasClientId(e.target.value)}
                  className="field text-sm rounded-xl bg-ink border-line/90 focus:border-cat focus:ring-1 focus:ring-cat w-full"
                >
                  <option value="">-- Seleccionar cliente --</option>
                  {clients
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {aliasError ? <p className="banner banner-danger text-xs">{aliasError}</p> : null}
            {aliasSuccess ? <p className="banner banner-ok text-xs">{aliasSuccess}</p> : null}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingAlias}
                className="btn btn-primary text-xs rounded-xl font-bold px-5 py-2 shadow-cat"
              >
                {isSavingAlias ? "Guardando…" : "+ Guardar regla de equivalencia"}
              </button>
            </div>
          </form>

          {/* Search Box Equivalencias */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 border border-line/60 rounded-2xl p-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar en equivalencias SAP o CAT…"
                className="field pl-9 pr-8 text-sm w-full rounded-xl bg-card border-line/80 focus:border-cat focus:ring-1 focus:ring-cat"
              />
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <p className="text-xs text-muted font-medium px-2">
              {totalAliases} reglas registradas
            </p>
          </div>

          {/* Tabla de Equivalencias SAP */}
          <div className="rounded-2xl border border-line/80 bg-card/60 backdrop-blur-md overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line/80 bg-elevated/40 text-[11px] font-semibold text-muted tracking-wider uppercase">
                    <th className="py-3 px-4 sm:px-6">Razón Social en SAP</th>
                    <th className="py-3 px-4 text-center">Mapeo</th>
                    <th className="py-3 px-4">Cliente en CAT</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-sm">
                  {filteredAliases.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-3xl">⚡</span>
                          <p className="font-semibold text-foreground text-sm">No hay reglas de equivalencia</p>
                          <p className="text-xs text-muted max-w-md">
                            Podés crearlas manualmente arriba o el sistema las aprenderá automáticamente cada vez que cargues un archivo HTML de SAP.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAliases.map((a) => (
                      <tr key={a.id} className="hover:bg-elevated/40 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-semibold text-foreground">
                          {a.alias}
                        </td>
                        <td className="py-3.5 px-4 text-center text-muted">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-elevated text-cat text-xs">
                            ➔
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-cat bg-cat/10 border border-cat/30">
                            {a.client_name ?? "Cliente"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAlias(a.id)}
                            className="inline-flex items-center gap-1 text-muted hover:text-danger hover:bg-danger/10 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-danger/30 text-xs font-medium transition-all"
                            title="Eliminar regla"
                          >
                            <TrashIcon />
                            <span>Quitar</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
