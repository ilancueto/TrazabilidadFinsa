"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MODALITY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { Client, Profile } from "@/lib/types";

export function AdminFilters({ pickers, clients = [] }: { pickers: Profile[]; clients?: Client[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const currentParam = params.get("q") ?? "";
  const [qInput, setQInput] = useState(currentParam);
  const [prevParam, setPrevParam] = useState(currentParam);
  const [isPending, startTransition] = useTransition();

  if (currentParam !== prevParam) {
    setPrevParam(currentParam);
    setQInput(currentParam);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const activeParam = params.get("q") ?? "";
      if (qInput.trim() === activeParam.trim()) return;

      const next = new URLSearchParams(params.toString());
      if (qInput.trim()) {
        next.set("q", qInput.trim());
      } else {
        next.delete("q");
      }
      startTransition(() => {
        router.replace(`/admin?${next.toString()}`);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [qInput, router, params]);

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "ALL") next.delete(name);
    else next.set(name, value);
    startTransition(() => {
      router.replace(`/admin?${next.toString()}`);
    });
  }

  return (
    <form
      className="panel grid gap-2 p-3 md:grid-cols-6"
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams(params.toString());
        const q = qInput.trim();
        if (q) next.set("q", q);
        else next.delete("q");
        startTransition(() => {
          router.replace(`/admin?${next.toString()}`);
        });
      }}
    >
      <div className="relative md:col-span-2">
        <input
          name="q"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          aria-label="Buscar por número de entrega o últimos dígitos"
          placeholder="Número de entrega o destino…"
          className="field w-full pr-8"
          autoComplete="off"
        />
        {isPending ? (
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cat border-t-transparent" />
          </div>
        ) : qInput ? (
          <button
            type="button"
            onClick={() => setQInput("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-muted hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            ✕
          </button>
        ) : null}
      </div>

      <select
        aria-label="Filtrar por estado"
        defaultValue={params.get("status") ?? "ALL"}
        onChange={(event) => update("status", event.target.value)}
        className="field"
      >
        <option value="ALL">Todos los estados</option>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por modalidad"
        defaultValue={params.get("modality") ?? "ALL"}
        onChange={(event) => update("modality", event.target.value)}
        className="field"
      >
        <option value="ALL">Todas las modalidades</option>
        {Object.entries(MODALITY_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por prioridad"
        defaultValue={params.get("priority") ?? "ALL"}
        onChange={(event) => update("priority", event.target.value)}
        className="field"
      >
        <option value="ALL">Todas las prioridades</option>
        {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por cliente"
        defaultValue={params.get("clientId") ?? "ALL"}
        onChange={(event) => update("clientId", event.target.value)}
        className="field"
      >
        <option value="ALL">Todos los clientes</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por responsable"
        defaultValue={params.get("assignee") ?? "ALL"}
        onChange={(event) => update("assignee", event.target.value)}
        className="field"
      >
        <option value="ALL">Todos los responsables</option>
        <option value="NONE">Sin asignar</option>
        {pickers.map((picker) => (
          <option key={picker.id} value={picker.id}>
            {picker.full_name}
          </option>
        ))}
      </select>
      <label className="check md:col-span-6">
        <input
          type="checkbox"
          checked={params.get("closed") === "1"}
          onChange={(event) => update("closed", event.target.checked ? "1" : "")}
        />
        Incluir entregas cerradas
      </label>
    </form>
  );
}

