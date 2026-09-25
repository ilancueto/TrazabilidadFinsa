"use client";

function SearchIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

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
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted" aria-hidden="true">
          <SearchIcon className="w-5 h-5 text-muted/70" />
        </span>
        <input
          id="picking-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar por número o destino…"
          className="field !pl-11 pr-9 text-base font-medium shadow-xs rounded-xl"
          style={{ paddingLeft: "2.75rem" }}
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
