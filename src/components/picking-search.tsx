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
        <input
          id="picking-search"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Número o destino…"
          className="field pr-9 text-base font-medium shadow-xs"
          autoComplete="off"
          enterKeyHint="search"
        />
        {query ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-muted hover:text-foreground"
          >
            ✕
          </button>
        ) : null}
      </div>
      <button type="submit" className="btn btn-primary" disabled={isPending}>
        {isPending ? "…" : "Buscar"}
      </button>
    </form>
  );
}
