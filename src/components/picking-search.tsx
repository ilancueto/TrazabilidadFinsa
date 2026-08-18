"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function PickingSearch({ initialQuery = "" }: { initialQuery?: string; cola?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(currentParam || initialQuery);
  const [prevParam, setPrevParam] = useState(currentParam);
  const [isPending, startTransition] = useTransition();

  if (currentParam !== prevParam) {
    setPrevParam(currentParam);
    setQuery(currentParam);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const activeParam = searchParams.get("q") ?? "";
      if (query.trim() === activeParam.trim()) return;

      const next = new URLSearchParams(searchParams.toString());
      if (query.trim()) {
        next.set("q", query.trim());
      } else {
        next.delete("q");
      }
      next.delete("page"); // resetear a página 1 en nueva búsqueda

      startTransition(() => {
        router.replace(`/picking?${next.toString()}`);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, router, searchParams]);

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="picking-search">
        Buscar por número de entrega o destino
      </label>
      <input
        id="picking-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Escribí número de entrega o destino…"
        className="field pr-9 text-base font-medium shadow-xs"
        autoComplete="off"
      />
      {isPending ? (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cat border-t-transparent" />
        </div>
      ) : query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-muted hover:text-foreground"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
