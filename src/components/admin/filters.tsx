"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MODALITY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { Profile } from "@/lib/types";

export function AdminFilters({ pickers }: { pickers: Profile[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "ALL") next.delete(name);
    else next.set(name, value);
    router.push(`/admin?${next.toString()}`);
  }

  return (
    <form
      className="panel grid gap-2 p-3 md:grid-cols-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const next = new URLSearchParams(params.toString());
        const q = String(data.get("q") ?? "").trim();
        if (q) next.set("q", q);
        else next.delete("q");
        router.push(`/admin?${next.toString()}`);
      }}
    >
      <input
        name="q"
        aria-label="Buscar por número o últimos dígitos"
        defaultValue={params.get("q") ?? ""}
        placeholder="Número o últimos dígitos"
        className="field md:col-span-2"
      />
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
      <label className="check md:col-span-5">
        <input
          type="checkbox"
          checked={params.get("closed") === "1"}
          onChange={(event) => update("closed", event.target.checked ? "1" : "")}
        />
        Incluir cerradas
      </label>
      <button type="submit" className="btn btn-ghost">
        Buscar
      </button>
    </form>
  );
}
