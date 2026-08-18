"use client";

import { useState, useActionState, useTransition } from "react";
import { saveClientAction, toggleClientStatusAction, type ClientActionState } from "@/lib/actions/clients";
import type { Client } from "@/lib/types";

export function ClientManager({ clients }: { clients: Client[] }) {
  const [filter, setFilter] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [, startTransition] = useTransition();

  const [state, action, pending] = useActionState(async (prev: ClientActionState, formData: FormData) => {
    const res = await saveClientAction(prev, formData);
    if (res.success && !res.error) {
      setEditingClient(null);
      setIsCreating(false);
    }
    return res;
  }, {} as ClientActionState);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(filter.toLowerCase().trim()),
  );

  return (
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
              Ingresá el nombre de la empresa o base (ej: &quot;Halliburton Añelo&quot;, &quot;SLB&quot;).
            </p>

            {editingClient && <input type="hidden" name="id" value={editingClient.id} />}

            <label className="block">
              <span className="label">Nombre del cliente</span>
              <input
                name="name"
                required
                defaultValue={editingClient?.name ?? ""}
                placeholder="Ej: Halliburton Añelo"
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-muted">
                  No se encontraron clientes.
                </td>
              </tr>
            ) : (
              filtered.map((client) => (
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
  );
}
