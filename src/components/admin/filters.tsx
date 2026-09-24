"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { Client, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  const activeFiltersCount = [
    params.get("status") && params.get("status") !== "ALL",
    params.get("priority") && params.get("priority") !== "ALL",
    params.get("clientId") && params.get("clientId") !== "ALL",
    params.get("assignee") && params.get("assignee") !== "ALL",
    params.get("closed") === "1",
  ].filter(Boolean).length;

  const [filtersOpen, setFiltersOpen] = useState(activeFiltersCount > 0);

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
      className="panel rounded-2xl border-line/80 shadow-sm p-3.5 sm:p-5 flex flex-col md:grid md:grid-cols-6 gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit(query);
      }}
    >
      <div className="flex items-center gap-2 md:contents">
        <div className="relative flex-1 md:col-span-2">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs" aria-hidden="true">
            🔍
          </span>
          <input
            name="q"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Buscar por número de entrega o últimos dígitos"
            placeholder="Número o destino · Enter"
            className="field pl-8.5 pr-8 rounded-xl shadow-xs"
            autoComplete="off"
            enterKeyHint="search"
          />
          {pending ? (
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cat border-t-transparent" />
            </div>
          ) : query ? (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] text-muted hover:text-foreground hover:bg-white/20 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          ) : null}
        </div>
        <button type="submit" className="btn btn-primary rounded-xl font-bold shadow-xs active:scale-[0.98] px-4" disabled={pending}>
          {pending ? "…" : "Buscar"}
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className={cn(
            "btn btn-ghost rounded-xl px-3 md:hidden font-semibold text-xs flex items-center gap-1.5",
            activeFiltersCount > 0 && "border-cat text-cat bg-cat/10",
          )}
          aria-expanded={filtersOpen}
          aria-label="Mostrar u ocultar filtros avanzados"
        >
          <span>Filtros</span>
          {activeFiltersCount > 0 ? (
            <span className="inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-cat text-ink font-black text-[10px]">
              {activeFiltersCount}
            </span>
          ) : (
            <span className="text-muted text-[10px]">{filtersOpen ? "▲" : "▼"}</span>
          )}
        </button>
      </div>

      <div className={cn("grid gap-3 md:contents", filtersOpen ? "grid-cols-1 sm:grid-cols-2" : "hidden md:contents")}>
        <select aria-label="Filtrar por estado" defaultValue={params.get("status") ?? "ALL"} onChange={(event) => update("status", event.target.value)} className="field rounded-xl shadow-xs">
          <option value="ALL">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filtrar por prioridad" defaultValue={params.get("priority") ?? "ALL"} onChange={(event) => update("priority", event.target.value)} className="field rounded-xl shadow-xs">
          <option value="ALL">Todas las prioridades</option>
          {Object.entries(PRIORITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Filtrar por cliente" defaultValue={params.get("clientId") ?? "ALL"} onChange={(event) => update("clientId", event.target.value)} className="field rounded-xl shadow-xs">
          <option value="ALL">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Filtrar por responsable" defaultValue={params.get("assignee") ?? "ALL"} onChange={(event) => update("assignee", event.target.value)} className="field rounded-xl shadow-xs">
          <option value="ALL">Todos los responsables</option>
          <option value="NONE">Sin asignar</option>
          {pickers.map((picker) => <option key={picker.id} value={picker.id}>{picker.full_name}</option>)}
        </select>
        <label className="check md:col-span-6 text-xs text-muted font-medium flex items-center gap-2 cursor-pointer pt-1 col-span-full">
          <input type="checkbox" checked={params.get("closed") === "1"} onChange={(event) => update("closed", event.target.checked ? "1" : "")} />
          Incluir entregas cerradas
        </label>
      </div>
    </form>
  );
}
