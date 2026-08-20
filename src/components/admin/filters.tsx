"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { Client, Profile } from "@/lib/types";

export function AdminFilters({
  pickers,
  clients = [],
  query,
  onQueryChange,
  onCommit,
  onClear,
  isPending,
  basePath = "/admin",
}: {
  pickers: Profile[];
  clients?: Client[];
  query: string;
  onQueryChange: (value: string) => void;
  onCommit: (value?: string) => void;
  onClear: () => void;
  isPending: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pending = isPending;

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("section");
    next.delete("modality");
    if (!value || value === "ALL") next.delete(name);
    else next.set(name, value);
    next.delete("page");
    router.replace(`${basePath}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
  }

  return (
    <form
      className="panel grid gap-2 p-3 md:grid-cols-6"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(query);
      }}
    >
      <div className="relative md:col-span-2">
        <input
          name="q"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Buscar por número de entrega o últimos dígitos"
          placeholder="Número o destino · Enter"
          className="field w-full pr-8"
          autoComplete="off"
          enterKeyHint="search"
        />
        {pending ? (
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cat border-t-transparent" />
          </div>
        ) : query ? (
          <button type="button" onClick={onClear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-muted hover:text-foreground" aria-label="Limpiar búsqueda">✕</button>
        ) : null}
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "…" : "Buscar"}</button>

      <select aria-label="Filtrar por estado" defaultValue={params.get("status") ?? "ALL"} onChange={(event) => update("status", event.target.value)} className="field">
        <option value="ALL">Todos los estados</option>
        {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Filtrar por prioridad" defaultValue={params.get("priority") ?? "ALL"} onChange={(event) => update("priority", event.target.value)} className="field">
        <option value="ALL">Todas las prioridades</option>
        {Object.entries(PRIORITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Filtrar por cliente" defaultValue={params.get("clientId") ?? "ALL"} onChange={(event) => update("clientId", event.target.value)} className="field">
        <option value="ALL">Todos los clientes</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select aria-label="Filtrar por responsable" defaultValue={params.get("assignee") ?? "ALL"} onChange={(event) => update("assignee", event.target.value)} className="field">
        <option value="ALL">Todos los responsables</option>
        <option value="NONE">Sin asignar</option>
        {pickers.map((picker) => <option key={picker.id} value={picker.id}>{picker.full_name}</option>)}
      </select>
      <label className="check md:col-span-6">
        <input type="checkbox" checked={params.get("closed") === "1"} onChange={(event) => update("closed", event.target.checked ? "1" : "")} />
        Incluir entregas cerradas
      </label>
    </form>
  );
}
