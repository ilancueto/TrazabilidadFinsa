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
      setTimeout(() => setAliasSuccess(""), 3000);
    }
  }

  function handleDeleteAlias(id: string) {
    if (!confirm("¿Eliminar esta regla de equivalencia?")) return;
    startTransition(() => {
      deleteClientAliasAction(id);
    });
  }

  return (
    <div className="space-y-4">
      {/* Pestañas */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          type="button"
          onClick={() => {
            setTab("clients");
            setFilter("");
          }}
          className={`tab ${tab === "clients" ? "tab-on" : ""}`}
        >
          Clientes ({clients.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("aliases");
            setFilter("");
          }}
          className={`tab ${tab === "aliases" ? "tab-on" : ""}`}
        >
          Equivalencias SAP ({aliases.length})
        </button>
      </div>

      {tab === "clients" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar cliente…"
              className="field max-w-xs"
            />
            <button
              type="button"
              onClick={() => {
                setEditingClient(null);
                setIsCreating(true);
              }}
              className="btn btn-primary"
            >
              + Nuevo cliente
            </button>
          </div>

          {/* Modal / Formulario de Creación / Edición */}
          {(isCreating || editingClient) && (
            <div className="dialog-back" role="dialog" aria-modal="true" aria-label="Cliente">
              <form
                action={action}
                className="panel w-full max-w-md space-y-4 p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="panel-title">
                  {editingClient ? `Editar cliente: ${editingClient.name}` : "Nuevo cliente"}
                </h2>
                <p className="text-xs text-muted">
                  Ingresá el nombre comercial o base de la empresa (ej: &quot;Roque Mocciola&quot;, &quot;Halliburton Añelo&quot;).
                </p>

                {editingClient && <input type="hidden" name="id" value={editingClient.id} />}

                <label className="block">
                  <span className="label">Nombre del cliente</span>
                  <input
                    name="name"
                    required
                    defaultValue={editingClient?.name ?? ""}
                    placeholder="Ej: Roque Mocciola"
                    className="field text-base font-semibold"
                    autoFocus
                  />
                </label>

                {state.error ? <p className="banner banner-danger text-xs">{state.error}</p> : null}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setIsCreating(false);
                      setEditingClient(null);
                    }}
                    className="btn btn-ghost"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={pending} className="btn btn-primary">
                    {pending ? "Guardando…" : editingClient ? "Guardar cambios" : "Crear cliente"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabla de Clientes */}
          <div className="panel overflow-hidden">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Nombre del cliente</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted">
                      No se encontraron clientes.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.id} className={!client.active ? "opacity-60" : ""}>
                      <td className="font-semibold">{client.name}</td>
                      <td>
                        {client.active ? (
                          <span className="badge badge-ok">Activo</span>
                        ) : (
                          <span className="badge badge-muted">Inactivo</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreating(false);
                              setEditingClient(client);
                            }}
                            className="btn btn-ghost btn-sm"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              startTransition(() => {
                                toggleClientStatusAction(client.id, !client.active);
                              });
                            }}
                            className={`btn btn-sm ${client.active ? "btn-ghost text-danger" : "btn-ok"}`}
                          >
                            {client.active ? "Desactivar" : "Reactivar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Pestaña de Equivalencias SAP */
        <div className="space-y-4">
          <form
            onSubmit={handleAddAlias}
            className="panel p-4 sm:p-5 rounded-2xl border-line/80 space-y-3 bg-gradient-to-br from-card via-surface/60 to-card"
          >
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>⚡</span>
              <span>Nueva regla de equivalencia (&quot;Si en SAP es X ➔ en CAT es Y&quot;)</span>
            </h3>
            <p className="text-xs text-muted">
              Cuando el archivo de SAP contenga esta razón social, el importador asignará automáticamente el cliente seleccionado.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="block">
                <span className="label">Razón Social en SAP</span>
                <input
                  type="text"
                  required
                  value={newAliasText}
                  onChange={(e) => setNewAliasText(e.target.value)}
                  placeholder="Ej: Empresa de Construcción Roque Mocciola"
                  className="field text-sm"
                />
              </label>

              <label className="block">
                <span className="label">Cliente asignado en CAT</span>
                <select
                  required
                  value={newAliasClientId}
                  onChange={(e) => setNewAliasClientId(e.target.value)}
                  className="field text-sm"
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
                className="btn btn-primary btn-sm rounded-xl font-bold px-4"
              >
                {isSavingAlias ? "Guardando…" : "+ Guardar regla de equivalencia"}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-3 pt-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar en equivalencias…"
              className="field max-w-xs"
            />
          </div>

          <div className="panel overflow-hidden rounded-2xl border-line/80">
            <table className="table w-full text-xs">
              <thead>
                <tr>
                  <th>Razón Social en SAP</th>
                  <th>Cliente en CAT</th>
                  <th className="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredAliases.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted">
                      No hay reglas de equivalencia registradas aún. Podés agregarlas acá o se aprenden automáticamente al importar el HTML de SAP.
                    </td>
                  </tr>
                ) : (
                  filteredAliases.map((a) => (
                    <tr key={a.id}>
                      <td className="font-semibold text-foreground">{a.alias}</td>
                      <td>
                        <span className="font-bold text-cat bg-cat/10 px-2 py-0.5 rounded border border-cat/30">
                          {a.client_name ?? "Cliente"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteAlias(a.id)}
                          className="text-muted hover:text-danger font-bold text-xs p-1"
                          title="Eliminar regla"
                        >
                          ✕ Quitar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
