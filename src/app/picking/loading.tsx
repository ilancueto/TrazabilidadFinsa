export default function Loading() {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-6">
      <div className="h-8 w-48 animate-pulse bg-line" />
      <div className="h-24 animate-pulse bg-card" />
      <div className="h-24 animate-pulse bg-card" />
      <p className="text-center text-sm text-muted">Cargando…</p>
    </div>
  );
}
