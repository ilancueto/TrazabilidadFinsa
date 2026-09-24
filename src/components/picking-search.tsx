"use client";

export function PickingSearch({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  isPending,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  isPending: boolean;
}) {
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <label className="sr-only" htmlFor="picking-search">
          Buscar por número de entrega o destino
        </label>
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm" aria-hidden="true">
          🔍
        </span>
        <input
          id="picking-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar por número o destino…"
          className="field pl-9.5 pr-9 text-base font-medium shadow-xs rounded-xl"
          autoComplete="off"
          enterKeyHint="search"
        />
        {query ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs text-muted hover:text-foreground hover:bg-white/20 transition-colors"
          >
            ✕
          </button>
        ) : null}
      </div>
      <button type="submit" className="btn btn-primary px-5 rounded-xl shadow-xs" disabled={isPending}>
        {isPending ? "…" : "Buscar"}
      </button>
    </form>
  );
}
